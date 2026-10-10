/**
 * Eliminating players, at dawn or by day, with everything that follows from it
 * (Narrator Guide R6 and R8): chain deaths, the Bodyguard, and effects recorded for later.
 */
import { createRng } from '@/engine/setup';
import { isWolf, neighbours, type GameState, type Player } from '@/engine/state';
import { MEM } from './memory';
import { getRole } from './roles';

export type DeathCause =
  | 'pack'
  | 'loneHunt'
  | 'poison'
  | 'sword'
  | 'hero'
  | 'heroSelf'
  | 'thug'
  | 'catScratch'
  | 'trap'
  | 'guest'
  | 'plague'
  | 'lover'
  | 'lawyer'
  | 'hunter'
  | 'execution'
  | 'coup'
  | 'ruleBreak'
  | 'parrotWord';

export interface Death {
  seat: number;
  cause: DeathCause;
}

/** Things the narrator must ask a player right away (Narrator Guide R8). */
export type Prompt =
  | { kind: 'hunterShot'; seat: number }
  | { kind: 'catScratchNow'; seat: number }
  | { kind: 'sheepNames'; seat: number }
  | { kind: 'mayorSuccession'; seat: number; mode: 'name' | 'election' };

export interface EliminationResult {
  state: GameState;
  deaths: Death[];
  prompts: Prompt[];
}

const flag = (p: Player, key: string) => p.memory[key] === true;
const num = (p: Player, key: string) => (typeof p.memory[key] === 'number' ? (p.memory[key] as number) : null);

function update(state: GameState, seat: number, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)) };
}
function updateMemory(state: GameState, seat: number, patch: Player['memory']): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, memory: { ...p.memory, ...patch } } : p)),
  };
}

function currentNight(state: GameState): number {
  return state.phase.kind === 'night' ? state.phase.night : state.phase.kind === 'day' ? state.phase.day : 0;
}

/** The weakest living wolf for the Witcher's trap: a plain Werewolf if one lives, else any wolf, at random. */
export function weakestWolf(state: GameState, salt: number): number | null {
  const wolves = state.players.filter((p) => p.alive && (isWolf(p, getRole) || p.roleId === 'lonely_wolf'));
  if (wolves.length === 0) return null;
  const plain = wolves.filter((p) => p.roleId === 'werewolf' && !p.infected && !p.turned);
  const pool = plain.length > 0 ? plain : wolves;
  const rng = createRng(state.seed * 7919 + salt);
  return (pool[Math.floor(rng() * pool.length)] as Player).seat;
}

/**
 * Eliminate players and follow every consequence, in this order:
 * 1. Bodyguard steps in for a Prince eliminated by execution, coup or Hunter shot (once).
 * 2. Chain deaths, repeated until nothing new: Lovers die together; the Lawyer dies when both clients are dead.
 * 3. Effects recorded for the next night: Thug unlocked, Apprentice Seer promoted, Musketeer becomes Prince,
 *    Wild Child turns, Dream Wolf wakes.
 * 4. Prompts in seat order from the mayor's left: Hunter / Triple Face shot, Cat scratch, Sheep, mayor.
 * A rule-break elimination is clean: no abilities trigger (but a Lover's partner still dies).
 */
export function eliminate(state: GameState, initial: Death[]): EliminationResult {
  let s = state;
  const deaths: Death[] = [];
  const dead = new Set<number>();
  // Neighbours are taken as they were before anyone died ("a neighbour at that moment").
  const neighboursBefore = new Map(s.players.map((p) => [p.seat, neighbours(s, p.seat)]));

  const queue: Death[] = [];
  for (const d of initial) {
    let target = d;
    const victim = s.players[d.seat];
    if (victim?.roleId === 'prince' && ['execution', 'coup', 'hunter'].includes(d.cause)) {
      const guard = s.players.find((p) => p.alive && p.roleId === 'bodyguard' && !flag(p, MEM.used) && !p.abilitiesRemoved);
      if (guard) {
        s = updateMemory(s, guard.seat, { [MEM.used]: true });
        target = { seat: guard.seat, cause: d.cause };
      }
    }
    queue.push(target);
  }

  while (queue.length > 0) {
    const d = queue.shift() as Death;
    const p = s.players[d.seat];
    if (!p || !p.alive || dead.has(d.seat)) continue;
    dead.add(d.seat);
    deaths.push(d);
    s = update(s, d.seat, { alive: false });

    // Lovers die together.
    if (p.loverSeat !== null && s.players[p.loverSeat]?.alive) {
      queue.push({ seat: p.loverSeat, cause: 'lover' });
    }
    // The Lawyer dies with his second client.
    for (const lawyer of s.players.filter((x) => x.alive && x.roleId === 'lawyer')) {
      const a = num(lawyer, 'pickA');
      const b = num(lawyer, 'pickB');
      if (a === null || b === null) continue;
      if (!s.players[a]?.alive && !s.players[b]?.alive) {
        queue.push({ seat: lawyer.seat, cause: 'lawyer' });
        s = updateMemory(s, lawyer.seat, { diedWithClients: true });
      }
    }
  }

  const night = currentNight(s);
  const clean = (d: Death) => d.cause === 'ruleBreak' || d.cause === 'parrotWord';

  for (const d of deaths) {
    const p = s.players[d.seat] as Player;
    // Thug: a neighbour (at that moment) was eliminated, any way.
    for (const thug of s.players.filter((x) => x.alive && x.roleId === 'thug' && !flag(x, MEM.unlocked))) {
      const nb = neighboursBefore.get(thug.seat);
      if (nb && (nb.left === d.seat || nb.right === d.seat)) s = updateMemory(s, thug.seat, { [MEM.unlocked]: true });
    }
    // Apprentice Seer: promoted when the Seer is eliminated (any way).
    if (p.roleId === 'seer') {
      for (const ap of s.players.filter((x) => x.alive && x.roleId === 'apprentice_seer')) {
        s = updateMemory(s, ap.seat, { [MEM.promoted]: true });
      }
    }
    // Musketeer becomes the Prince; the Bodyguard is shown the new Prince the next night.
    if (p.roleId === 'prince') {
      const musketeer = s.players.find((x) => x.alive && x.roleId === 'musketeer' && !x.abilitiesRemoved);
      if (musketeer) {
        s = update(s, musketeer.seat, { roleId: 'prince' });
        for (const bg of s.players.filter((x) => x.alive && x.roleId === 'bodyguard')) {
          s = updateMemory(s, bg.seat, { [MEM.newPrinceNight]: night + 1 });
        }
      }
    }
    // Wild Child turns when the father is eliminated (any way).
    for (const child of s.players.filter((x) => x.alive && x.roleId === 'wild_child' && !x.turned)) {
      if (num(child, 'father') === d.seat) {
        s = update(s, child.seat, { turned: true, team: child.team === 'lovers' ? 'lovers' : 'werewolf' });
        s = updateMemory(s, child.seat, { toldTurnedNight: night + 1 });
      }
    }
  }

  // Dream Wolf wakes once no other wolf is left to wake with the pack.
  for (const dream of s.players.filter((x) => x.alive && x.roleId === 'dream_wolf' && !flag(x, MEM.awake))) {
    const others = s.players.filter(
      (x) => x.alive && x.seat !== dream.seat && (x.infected || x.turned || getRole(x.roleId).wakesWithPack),
    );
    if (others.length === 0) s = updateMemory(s, dream.seat, { [MEM.awake]: true });
  }

  // Prompts, in seat order starting left of the mayor.
  const prompts: Prompt[] = [];
  const n = s.players.length;
  const start = s.mayorSeat === null ? 0 : (s.mayorSeat + 1) % n;
  const ordered = [...deaths].sort((x, y) => ((x.seat - start + n) % n) - ((y.seat - start + n) % n));
  for (const d of ordered) {
    const p = s.players[d.seat] as Player;
    if (clean(d) || p.abilitiesRemoved) {
      // A clean removal still needs a new mayor.
    } else {
      const hunterShot =
        (p.roleId === 'hunter' && !flag(p, MEM.shotUsed)) ||
        (p.roleId === 'triple_face' && night >= 3 && !flag(p, MEM.shotUsed));
      if (hunterShot) prompts.push({ kind: 'hunterShot', seat: p.seat });
      if (p.roleId === 'cat' && flag(p, MEM.scratchPending)) prompts.push({ kind: 'catScratchNow', seat: p.seat });
      if (flag(p, 'sheep')) prompts.push({ kind: 'sheepNames', seat: p.seat });
    }
    if (s.mayorSeat === p.seat) {
      const villageMayor = p.team === 'village' && s.settings.reveal === 'revealed';
      prompts.push({ kind: 'mayorSuccession', seat: p.seat, mode: villageMayor ? 'name' : 'election' });
    }
  }

  return { state: s, deaths, prompts };
}

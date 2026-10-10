/**
 * Dawn: resolving the night (Narrator Guide, section 4, R0–R9).
 * Pure function: takes the state and the night's record, returns the new state,
 * the deaths, the announcements in reading order, the prompts, and the winner if any.
 */
import { isWolf, neighbours, type GameState, type Player, type WinResult } from '@/engine/state';
import { eliminate, weakestWolf, type Death, type DeathCause, type Prompt } from './elimination';
import { MEM, PACK } from './memory';
import type { NightRecord } from './nightActions';
import { getRole } from './roles';
import { checkWinner } from './win';

type AttackSource = 'pack' | 'loneHunt' | 'poison' | 'sword' | 'hero' | 'thug';

interface Attack {
  source: AttackSource;
  target: number;
  infect: boolean;
}

export type Announcement =
  | { kind: 'quietNight' }
  | { kind: 'deaths'; deaths: { seat: number; plague: boolean }[] }
  | { kind: 'catAttacked' }
  | { kind: 'paralysed'; seat: number }
  | { kind: 'bear'; growls: boolean };

export interface DawnResult {
  state: GameState;
  deaths: Death[];
  announcements: Announcement[];
  prompts: Prompt[];
  winner: WinResult | null;
}

const flag = (p: Player, key: string) => p.memory[key] === true;
const num = (p: Player, key: string) => (typeof p.memory[key] === 'number' ? (p.memory[key] as number) : null);

function patchPlayer(state: GameState, seat: number, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)) };
}
function patchMemory(state: GameState, seat: number, patch: Player['memory']): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, memory: { ...p.memory, ...patch } } : p)),
  };
}

/** A Lover whose team changed is silently re-checked: different teams now → cross-team Lovers. */
function recheckLovers(state: GameState, seat: number): GameState {
  const p = state.players[seat];
  if (!p || p.loverSeat === null) return state;
  const partner = state.players[p.loverSeat];
  if (!partner || p.team === 'lovers') return state;
  if (p.team !== partner.team) {
    let s = patchPlayer(state, p.seat, { team: 'lovers' });
    s = patchPlayer(s, partner.seat, { team: 'lovers' });
    return s;
  }
  return state;
}

export function resolveDawn(state: GameState, record: NightRecord): DawnResult {
  const night = record.night;
  const prayed = record.facts.prayed;
  let s = state;
  const unstoppable: Death[] = [];
  const announcements: Announcement[] = [];
  let catAttacked = false;

  // ── R1: gather the night attacks and apply the Troublemaker's swap ──
  const attacks: Attack[] = [];
  if (record.pack && !prayed) attacks.push({ source: 'pack', target: record.pack.target, infect: record.pack.infect });
  if (record.loneHunt && !prayed) attacks.push({ source: 'loneHunt', target: record.loneHunt.target, infect: false });
  for (const pz of record.poisons) attacks.push({ source: 'poison', target: pz.target, infect: false });
  for (const sw of record.swordStrikes) attacks.push({ source: 'sword', target: sw.target, infect: false });
  if (record.heroStrike) attacks.push({ source: 'hero', target: record.heroStrike.target, infect: false });
  if (record.thugStrike) attacks.push({ source: 'thug', target: record.thugStrike.target, infect: false });
  if (record.swap) {
    const [a, b] = record.swap;
    for (const at of attacks) {
      if (at.target === a) at.target = b;
      else if (at.target === b) at.target = a;
    }
  }

  // An infection attempt spends the Alpha's use, whatever happens to it.
  if (record.pack?.infect && !prayed) {
    const alpha = s.players.find((p) => p.alive && p.roleId === 'alpha_wolf');
    if (alpha) s = patchMemory(s, alpha.seat, { infectionsUsed: (num(alpha, 'infectionsUsed') ?? 0) + 1 });
  }

  // ── R2: each attack through the attack order ──
  const landed: { seat: number; source: AttackSource }[] = [];
  let trapB = false;

  const resolve = (at: Attack, seat: number, redirected: boolean): void => {
    const t = s.players[seat];
    if (!t || !t.alive) return;
    if (prayed) return;
    if (t.roleId === 'prince' && !t.abilitiesRemoved) return;
    if (record.facts.jailed === seat) return;
    if (record.protect === seat) return;
    if ((num(t, MEM.shields) ?? 0) > 0) {
      s = patchMemory(s, seat, { [MEM.shields]: (num(t, MEM.shields) ?? 0) - 1 });
      return;
    }
    if (!redirected && record.guard && record.guard.target === seat && record.guard.knight !== seat) {
      resolve(at, record.guard.knight, true);
      return;
    }
    const fromPack = at.source === 'pack';
    if (fromPack && t.roleId === 'wise' && !t.abilitiesRemoved && !flag(t, 'lifeUsed')) {
      s = patchMemory(s, seat, { lifeUsed: true });
      return;
    }
    if (fromPack) {
      const witcher = s.players.find(
        (w) => w.roleId === 'witcher' && num(w, MEM.trapSeat) === seat && !flag(w, MEM.trapFired) && !w.abilitiesRemoved,
      );
      if (witcher) {
        s = patchMemory(s, witcher.seat, { [MEM.trapFired]: true });
        trapB = true;
        return;
      }
    }
    if (fromPack && t.roleId === 'cursed' && !t.turned && !t.abilitiesRemoved) {
      s = patchPlayer(s, seat, { turned: true, team: t.team === 'lovers' ? 'lovers' : 'werewolf' });
      s = patchMemory(s, seat, { toldTurnedNight: night });
      s = recheckLovers(s, seat);
      return;
    }
    if (fromPack && t.roleId === 'cat' && !flag(t, 'catAttacked') && !t.abilitiesRemoved) {
      s = patchMemory(s, seat, { catAttacked: true, [MEM.scratchPending]: true, [MEM.scratchNight]: night + 1 });
      catAttacked = true;
      return;
    }
    if (fromPack && at.infect) {
      const isWolfAlready = isWolf(t, getRole) || t.roleId === 'lonely_wolf';
      if (!isWolfAlready) {
        s = patchPlayer(s, seat, { infected: true, team: t.team === 'lovers' ? 'lovers' : 'werewolf' });
        s = patchMemory(s, seat, { infectedNight: night });
        if (t.roleId === 'wise') s = patchMemory(s, seat, { wisePassiveLost: true });
        if (t.roleId === 'diseased') s = { ...s, packState: { ...s.packState, [PACK.wolvesSickNight]: night + 1 } };
        s = recheckLovers(s, seat);
      }
      return;
    }
    landed.push({ seat, source: at.source });
  };

  for (const at of attacks) resolve(at, at.target, false);

  // ── R3: the Witch's heal cancels a landed pack kill on the player she healed ──
  const healed = record.heal?.target ?? null;
  const finalLanded = landed.filter((l) => !(l.source === 'pack' && l.seat === healed));
  const packLandedOn = new Set(finalLanded.filter((l) => l.source === 'pack').map((l) => l.seat));

  // ── R4: unstoppable deaths ──
  if (record.heroStrike) unstoppable.push({ seat: record.heroStrike.hero, cause: 'heroSelf' });
  if (record.catScratch) {
    unstoppable.push({ seat: record.catScratch.target, cause: 'catScratch' });
    unstoppable.push({ seat: record.catScratch.cat, cause: 'catScratch' });
    s = patchMemory(s, record.catScratch.cat, { [MEM.scratchPending]: false });
  }
  for (const w of s.players.filter((x) => x.roleId === 'witcher' && !flag(x, MEM.trapFired) && !x.abilitiesRemoved)) {
    const trapped = num(w, MEM.trapSeat);
    const tp = trapped === null ? undefined : s.players[trapped];
    if (tp && tp.alive && (isWolf(tp, getRole) || tp.roleId === 'lonely_wolf')) {
      s = patchMemory(s, w.seat, { [MEM.trapFired]: true });
      unstoppable.push({ seat: tp.seat, cause: 'trap' });
    }
  }
  if (trapB) {
    const victim = weakestWolf(s, night);
    if (victim !== null) unstoppable.push({ seat: victim, cause: 'trap' });
  }
  if (record.guest) {
    const host = s.players[record.guest.host];
    if (host && (isWolf(host, getRole) || host.roleId === 'lonely_wolf')) unstoppable.push({ seat: record.guest.guest, cause: 'guest' });
  }
  if (!prayed) {
    for (const p of s.players.filter((x) => x.alive && x.plagueNight !== null)) {
      if (night >= (p.plagueNight as number) + 3) unstoppable.push({ seat: p.seat, cause: 'plague' });
    }
  }

  // ── R5: triggers from landed pack attacks ──
  for (const seat of packLandedOn) {
    const t = s.players[seat] as Player;
    if (t.roleId === 'diseased') s = { ...s, packState: { ...s.packState, [PACK.wolvesSickNight]: night + 1 } };
    if (t.roleId === 'wise' && !flag(t, 'wisePassiveLost')) s = { ...s, packState: { ...s.packState, [PACK.wolfPowersLost]: true } };
  }
  const guestDeaths: Death[] = [];
  if (record.guest) {
    if (packLandedOn.has(record.guest.guest)) guestDeaths.push({ seat: record.guest.host, cause: 'guest' });
    if (packLandedOn.has(record.guest.host)) guestDeaths.push({ seat: record.guest.guest, cause: 'guest' });
  }

  // ── R6 + R8: all deaths together, with chains and effects ──
  const initial: Death[] = [
    ...finalLanded.map((l) => ({ seat: l.seat, cause: l.source as DeathCause })),
    ...unstoppable,
    ...guestDeaths,
  ];
  const elim = eliminate(s, initial);
  s = elim.state;

  // Forger items are handed over at dawn and work from the next night.
  for (const f of record.forged) {
    const key = f.item === 'shield' ? MEM.shields : MEM.swords;
    const holder = s.players[f.target];
    if (holder?.alive) s = patchMemory(s, f.target, { [key]: (num(holder, key) ?? 0) + 1 });
  }
  if (record.paralysed !== null) s = { ...s, packState: { ...s.packState, paralysedSeat: record.paralysed } };

  // ── R7: announcements, in reading order ──
  if (prayed) announcements.push({ kind: 'quietNight' });
  announcements.push({
    kind: 'deaths',
    deaths: elim.deaths.map((d) => ({ seat: d.seat, plague: d.cause === 'plague' })).sort((a, b) => a.seat - b.seat),
  });
  if (catAttacked) announcements.push({ kind: 'catAttacked' });
  if (record.paralysed !== null && s.players[record.paralysed]?.alive) {
    announcements.push({ kind: 'paralysed', seat: record.paralysed });
  }
  const bear = s.players.find((p) => p.roleId === 'bear');
  if (bear) {
    if (bear.alive) {
      const { left, right } = neighbours(s, bear.seat);
      const growls = [left, right].some((seat) => {
        if (seat === null) return false;
        const p = s.players[seat] as Player;
        return p.turned || p.infected || getRole(p.roleId).seenAs.wolfCheck === 'wolf';
      });
      announcements.push({ kind: 'bear', growls });
    } else if (s.settings.reveal === 'anonymous') {
      announcements.push({ kind: 'bear', growls: false });
    }
  }

  // ── R9: win check (re-run after each prompt is answered) ──
  const winner = checkWinner(s);
  return { state: s, deaths: elim.deaths, announcements, prompts: elim.prompts, winner };
}

/** Answer a Hunter (or Triple Face) shot: the target is eliminated, with all consequences. */
export function resolveHunterShot(state: GameState, hunterSeat: number, target: number) {
  const s = patchMemory(state, hunterSeat, { [MEM.shotUsed]: true });
  const result = eliminate(s, [{ seat: target, cause: 'hunter' }]);
  return { ...result, winner: checkWinner(result.state) };
}

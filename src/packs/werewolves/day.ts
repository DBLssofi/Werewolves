/**
 * The day (Rulebook, section 9; Narrator Guide, section 5).
 * The narrator records what happens; these functions apply the rules and return the new state,
 * the deaths, the prompts and the winner if the game is over.
 *
 * Day state kept in GameState.packState:
 * - paralysedSeat: paralysed today (set at dawn, cleared when night falls)
 * - noVoteDay: the day whose vote was cancelled (Judge, Dictator, an oath)
 * - ravenMark / ravenMarkDay: the Raven's +2 for today's vote
 * - firstVoteDay: the first day an execution vote was actually held (for the Angel)
 */
import { isWolf, type GameState, type Player, type WinResult } from '@/engine/state';
import { eliminate, type Death, type Prompt } from './elimination';
import { MEM } from './memory';
import { getRole } from './roles';
import { checkWinner } from './win';

export type DayError =
  | 'noSuchPlayer'
  | 'dead'
  | 'wrongRole'
  | 'used'
  | 'paralysed'
  | 'notSelf'
  | 'noVoteToday'
  | 'notAWolf'
  | 'mustVoteOnce'
  | 'notAVoter'
  | 'notAmongTied'
  | 'notTheSheep';

export interface DayOutcome {
  state: GameState;
  deaths: Death[];
  prompts: Prompt[];
  winner: WinResult | null;
}

const flag = (p: Player, key: string) => p.memory[key] === true;

function setPack(state: GameState, patch: GameState['packState']): GameState {
  return { ...state, packState: { ...state.packState, ...patch } };
}
function setMemory(state: GameState, seat: number, patch: Player['memory']): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, memory: { ...p.memory, ...patch } } : p)),
  };
}

function finish(state: GameState, deaths: Death[], prompts: Prompt[], winner?: WinResult | null): DayOutcome {
  return { state, deaths, prompts, winner: winner === undefined ? checkWinner(state) : winner };
}

function dayOf(state: GameState): number {
  return state.phase.kind === 'day' ? state.phase.day : 0;
}

export function isParalysed(state: GameState, seat: number): boolean {
  return state.packState['paralysedSeat'] === seat;
}

export function isNoVoteDay(state: GameState): boolean {
  return state.packState['noVoteDay'] === dayOf(state);
}

/** Who must vote: every living, non-paralysed player (abstaining is not allowed). */
export function voters(state: GameState, tied: readonly number[] = []): number[] {
  return state.players
    .filter((p) => p.alive && !isParalysed(state, p.seat) && !tied.includes(p.seat))
    .map((p) => p.seat);
}

// ─── setup helpers ─────────────────────────────────────────

/** Pack-specific preparation of a new game: the Sheep card holder starts with the Sheep status. */
export function prepareGame(state: GameState): GameState {
  let s = state;
  for (const p of state.players.filter((x) => x.roleId === 'sheep')) s = setMemory(s, p.seat, { sheep: true });
  return s;
}

export function setMayor(state: GameState, seat: number | null): GameState {
  return { ...state, mayorSeat: seat };
}

/** Day breaks. */
export function startDay(state: GameState, day: number): GameState {
  return { ...state, phase: { kind: 'day', day } };
}

/** Night falls: paralysis ends; an Angel who survived the first voting day becomes a plain Villager. */
export function endDay(state: GameState): GameState {
  let s = setPack(state, { paralysedSeat: null });
  const firstVoteDay = state.packState['firstVoteDay'];
  if (typeof firstVoteDay === 'number' && firstVoteDay <= dayOf(state)) {
    for (const angel of s.players.filter((p) => p.alive && p.roleId === 'angel' && p.team === 'neutral')) {
      s = { ...s, players: s.players.map((p) => (p.seat === angel.seat ? { ...p, roleId: 'villager', team: 'village' } : p)) };
    }
  }
  const next = dayOf(state) + 1;
  return { ...s, phase: { kind: 'night', night: next } };
}

// ─── day powers ────────────────────────────────────────────

/** Raven's nap: mark a player for +2 votes today, or nobody. May mark the same player as yesterday. */
export function ravenMark(state: GameState, ravenSeat: number, target: number | null): GameState | DayError {
  const raven = state.players[ravenSeat];
  if (!raven) return 'noSuchPlayer';
  if (!raven.alive) return 'dead';
  if (raven.roleId !== 'raven' || raven.abilitiesRemoved) return 'wrongRole';
  if (isParalysed(state, ravenSeat)) return 'paralysed';
  if (target !== null) {
    if (target === ravenSeat) return 'notSelf';
    const t = state.players[target];
    if (!t) return 'noSuchPlayer';
    if (!t.alive) return 'dead';
  }
  return setPack(state, { ravenMark: target, ravenMarkDay: dayOf(state) });
}

/** The Judge's secret sign: no vote today. Once per game, not while paralysed. */
export function judgeAdjourns(state: GameState, judgeSeat: number): GameState | DayError {
  const judge = state.players[judgeSeat];
  if (!judge) return 'noSuchPlayer';
  if (!judge.alive) return 'dead';
  if (judge.roleId !== 'judge' || judge.abilitiesRemoved) return 'wrongRole';
  if (flag(judge, MEM.used)) return 'used';
  if (isParalysed(state, judgeSeat)) return 'paralysed';
  if (isNoVoteDay(state)) return 'noVoteToday';
  return setPack(setMemory(state, judgeSeat, { [MEM.used]: true }), { noVoteDay: dayOf(state) });
}

/** A wolf for the Dictator: a werewolf card, the Lonely Wolf, an infected or turned player (not the Lycan or Minion). */
function dictatorSeesWolf(p: Player): boolean {
  return isWolf(p, getRole) || p.roleId === 'lonely_wolf';
}

/** The Dictator's coup: before voting, shoot one player. Wolf → they die and he becomes mayor; else both die. No vote today. */
export function dictatorCoup(state: GameState, dictatorSeat: number, target: number): DayOutcome | DayError {
  const d = state.players[dictatorSeat];
  if (!d) return 'noSuchPlayer';
  if (!d.alive) return 'dead';
  if (d.roleId !== 'dictator' || d.abilitiesRemoved) return 'wrongRole';
  if (flag(d, MEM.coupUsed)) return 'used';
  if (isParalysed(state, dictatorSeat)) return 'paralysed';
  if (isNoVoteDay(state)) return 'noVoteToday';
  if (target === dictatorSeat) return 'notSelf';
  const t = state.players[target];
  if (!t) return 'noSuchPlayer';
  if (!t.alive) return 'dead';

  let s = setPack(setMemory(state, dictatorSeat, { [MEM.coupUsed]: true }), { noVoteDay: dayOf(state) });
  const hit = dictatorSeesWolf(t);
  const initial: Death[] = hit ? [{ seat: target, cause: 'coup' }] : [{ seat: target, cause: 'coup' }, { seat: dictatorSeat, cause: 'coup' }];
  const r = eliminate(s, initial);
  s = r.state;
  if (hit && s.players[dictatorSeat]?.alive) s = setMayor(s, dictatorSeat);
  return finish(s, r.deaths, r.prompts.filter((p) => !(hit && p.kind === 'mayorSuccession')));
}

/**
 * The Parrot Wolf's word, checked when voting starts. If he has not said it (and is not paralysed),
 * he is removed cleanly before the vote, which still takes place.
 */
export function parrotWordCheck(state: GameState, saidWord: boolean): DayOutcome | null {
  if (isNoVoteDay(state)) return null;
  const parrot = state.players.find((p) => p.alive && p.roleId === 'parrot_wolf');
  if (!parrot || saidWord || isParalysed(state, parrot.seat)) return null;
  const r = eliminate(state, [{ seat: parrot.seat, cause: 'parrotWord' }]);
  return finish(r.state, r.deaths, r.prompts);
}

/** A serious rule break: immediate, clean elimination. An oath during the day also cancels the day's vote. */
export function ruleBreak(state: GameState, seat: number, offence: 'role' | 'oath' | 'peek'): DayOutcome {
  let s = state;
  if (offence === 'oath' && state.phase.kind === 'day') s = setPack(s, { noVoteDay: dayOf(state) });
  const r = eliminate(s, [{ seat, cause: 'ruleBreak' }]);
  return finish(r.state, r.deaths, r.prompts);
}

// ─── voting ────────────────────────────────────────────────

export interface Vote {
  voter: number;
  target: number;
}

export interface Tally {
  /** Total per seat: real votes (mayor counted twice) + penalty votes + the Raven's 2. */
  totals: Map<number, number>;
  /** Real votes only (no penalties, no Raven), used for the 3-vote defence-speech threshold. */
  real: Map<number, number>;
}

/**
 * Count a vote. `tied` is set for a revote: only the tied players can be voted for, and they may not vote.
 * The mayor's vote counts twice, except when paralysed or one of the tied players.
 */
export function tallyVotes(
  state: GameState,
  votes: readonly Vote[],
  penalties: Readonly<Record<number, number>> = {},
  tied: readonly number[] = [],
): Tally | DayError {
  if (isNoVoteDay(state)) return 'noVoteToday';
  const allowed = voters(state, tied);
  const seen = new Set<number>();
  for (const v of votes) {
    if (!allowed.includes(v.voter)) return 'notAVoter';
    if (seen.has(v.voter)) return 'mustVoteOnce';
    seen.add(v.voter);
    const t = state.players[v.target];
    if (!t) return 'noSuchPlayer';
    if (!t.alive) return 'dead';
    if (tied.length > 0 && !tied.includes(v.target)) return 'notAmongTied';
  }
  if (seen.size !== allowed.length) return 'mustVoteOnce';

  const totals = new Map<number, number>();
  const real = new Map<number, number>();
  const add = (m: Map<number, number>, seat: number, n: number) => m.set(seat, (m.get(seat) ?? 0) + n);
  for (const v of votes) {
    const weight = v.voter === state.mayorSeat && !tied.includes(v.voter) ? 2 : 1;
    add(real, v.target, weight);
    add(totals, v.target, weight);
  }
  if (tied.length === 0) {
    for (const [seat, n] of Object.entries(penalties)) add(totals, Number(seat), n);
    const mark = state.packState['ravenMark'];
    if (typeof mark === 'number' && state.packState['ravenMarkDay'] === dayOf(state) && state.players[mark]?.alive) {
      add(totals, mark, 2);
    }
  }
  return { totals, real };
}

/** Has this player just reached 3 real votes (the defence-speech threshold, S4)? */
export function reachedDefenceThreshold(tally: Tally, seat: number): boolean {
  return (tally.real.get(seat) ?? 0) >= 3;
}

export type VoteResult =
  | { kind: 'execute'; seat: number }
  | { kind: 'sheep'; seat: number }
  | { kind: 'revote'; tied: number[] }
  | { kind: 'noExecution' };

/** Decide the vote's result (Rulebook, section 9 "Result and ties"). */
export function voteResult(state: GameState, tally: Tally, isRevote: boolean): VoteResult {
  let best = -1;
  let leaders: number[] = [];
  for (const [seat, n] of tally.totals) {
    if (n > best) {
      best = n;
      leaders = [seat];
    } else if (n === best) leaders.push(seat);
  }
  leaders.sort((a, b) => a - b);
  if (leaders.length === 1) return { kind: 'execute', seat: leaders[0] as number };
  if (leaders.length === 0) return { kind: 'noExecution' };

  const sheep = state.players.find((p) => p.alive && flag(p, 'sheep'));
  if (sheep) return { kind: 'sheep', seat: sheep.seat };
  if (isRevote) return { kind: 'noExecution' };
  if (dayOf(state) === 1 && state.settings.day1Tie === 'noExecution') return { kind: 'noExecution' };
  if (voters(state, leaders).length === 0) return { kind: 'noExecution' };
  return { kind: 'revote', tied: leaders };
}

/** Record that an execution vote was actually held today (for the Angel's first voting day). */
export function voteHeld(state: GameState): GameState {
  return typeof state.packState['firstVoteDay'] === 'number' ? state : setPack(state, { firstVoteDay: dayOf(state) });
}

/** Execute the vote's result. The Angel executed on the first voting day wins alone; the game ends. */
export function execute(state: GameState, result: VoteResult): DayOutcome {
  const s = voteHeld(state);
  if (result.kind === 'noExecution' || result.kind === 'revote') return finish(s, [], []);
  const p = s.players[result.seat] as Player;
  if (result.kind === 'execute' && p.roleId === 'angel' && p.team === 'neutral' && s.packState['firstVoteDay'] === dayOf(s)) {
    const r = eliminate(s, [{ seat: p.seat, cause: 'execution' }]);
    return finish(r.state, r.deaths, [], { kind: 'solo', seat: p.seat, roleId: 'angel' });
  }
  const r = eliminate(s, [{ seat: result.seat, cause: 'execution' }]);
  return finish(r.state, r.deaths, r.prompts);
}

// ─── prompt answers ────────────────────────────────────────

/** The eliminated Sheep names the next Sheep (a status: the new holder keeps their role and team). */
export function nameNextSheep(state: GameState, fromSeat: number, nextSeat: number): GameState | DayError {
  const from = state.players[fromSeat];
  const next = state.players[nextSeat];
  if (!from || !next) return 'noSuchPlayer';
  if (!flag(from, 'sheep')) return 'notTheSheep';
  if (!next.alive) return 'dead';
  return setMemory(setMemory(state, fromSeat, { sheep: false }), nextSeat, { sheep: true });
}

/** A Cat eliminated before scratching: she is shown the wolves (village eyes closed) and takes one with her. */
export function catScratchNow(state: GameState, catSeat: number, target: number): DayOutcome | DayError {
  const cat = state.players[catSeat];
  const t = state.players[target];
  if (!cat || !t) return 'noSuchPlayer';
  if (cat.roleId !== 'cat' || !flag(cat, MEM.scratchPending)) return 'wrongRole';
  if (!t.alive) return 'dead';
  if (!dictatorSeesWolf(t)) return 'notAWolf';
  const s = setMemory(state, catSeat, { [MEM.scratchPending]: false });
  const r = eliminate(s, [{ seat: target, cause: 'catScratch' }]);
  return finish(r.state, r.deaths, r.prompts);
}

/**
 * A game in progress: the rules engine contract (App Spec, section 4).
 *
 * The screens send every narrator tap as a Command to `dispatch`, which applies the rules,
 * writes the game log and returns the new session (or the reason the tap is not allowed).
 * The session is plain JSON so it can be saved after every command, and `undo` steps back
 * one command to fix a mis-tap.
 */
import type { NightCall } from '@/engine/night';
import { fromSaveString, isGameState, isRecord, toSaveString, type LoadError } from '@/engine/save';
import type { GameState, WinResult } from '@/engine/state';
import { resolveHunterShot, type Announcement } from './dawn';
import {
  catScratchNow,
  dictatorCoup,
  endDay,
  execute,
  isNoVoteDay,
  judgeAdjourns,
  nameNextSheep,
  parrotWordCheck,
  prepareGame,
  ravenMark,
  ruleBreak,
  setMayor,
  startDay,
  tallyVotes,
  voteResult,
  type DayError,
  type DayOutcome,
  type Vote,
  type VoteResult,
} from './day';
import { resolveDawn } from './dawn';
import type { Death, Prompt } from './elimination';
import {
  applyNightAction,
  markWoken,
  startNightRecord,
  type ActionOk,
  type NightAction,
  type NightError,
  type NightRecord,
} from './nightActions';
import { ghostsAtDawn, isGhostLetter, planNight, startOfNightFacts, startOfNightTaps, type StartTap } from './nightPlan';
import { ROLES } from './roles';
import { checkWinner } from './win';

export const PACK_ID = 'werewolves';

// ─── the log ───────────────────────────────────────────────

/** When something happened. */
export type LogTime = { night: number } | { day: number };

/** What the action showed the narrator (check answers, cards shown, failures). */
export type ActionResult = Pick<ActionOk, 'answer' | 'group' | 'failed' | 'shownRole' | 'linked' | 'tapped'>;

export type LogEvent =
  | { kind: 'mayor'; seat: number | null; how: 'elected' | 'named' }
  | { kind: 'nightStart' }
  | { kind: 'nightAction'; action: NightAction; result: ActionResult }
  | { kind: 'dawn'; deaths: Death[]; announcements: Announcement[] }
  | { kind: 'ghostLetter'; seat: number; letter: string }
  | { kind: 'hunterShot'; seat: number; target: number; deaths: Death[] }
  | { kind: 'catScratch'; seat: number; target: number; deaths: Death[] }
  | { kind: 'sheepNamed'; from: number; to: number }
  | { kind: 'dayStart' }
  | { kind: 'ravenMark'; seat: number; target: number | null }
  | { kind: 'judge'; seat: number }
  | { kind: 'coup'; seat: number; target: number; deaths: Death[] }
  | { kind: 'parrotRemoved'; deaths: Death[] }
  | { kind: 'ruleBreak'; seat: number; offence: 'role' | 'oath' | 'peek'; deaths: Death[] }
  | { kind: 'vote'; votes: Vote[]; penalties: Record<number, number>; tied: number[]; totals: [number, number][]; result: VoteResult }
  | { kind: 'execution'; deaths: Death[] }
  | { kind: 'gameOver'; result: WinResult };

export interface LogEntry {
  at: LogTime;
  event: LogEvent;
}

// ─── the session ───────────────────────────────────────────

export interface Session {
  state: GameState;
  /** Tonight's actions, from nightfall until dawn is resolved; null otherwise. */
  night: NightRecord | null;
  /** Questions the narrator must ask now (Hunter's shot, Cat, Sheep, mayor). */
  prompts: Prompt[];
  /** The players tied in the vote, while a revote is due. */
  revote: number[] | null;
  /** The day whose execution vote is finished. */
  votedDay: number | null;
  log: LogEntry[];
  /** Earlier sessions, for undo. Not saved: undo history starts empty after loading. */
  past: Session[];
}

const UNDO_LIMIT = 50;

/** Start a session from a freshly dealt game, before the mayor election and Night 1. */
export function newSession(game: GameState): Session {
  const state = prepareGame(game);
  return {
    state,
    night: startNightRecord(1, startOfNightFacts(state, 1)),
    prompts: [],
    revote: null,
    votedDay: null,
    log: [{ at: { night: 1 }, event: { kind: 'nightStart' } }],
    past: [],
  };
}

// ─── commands ──────────────────────────────────────────────

export type Command =
  | { kind: 'setMayor'; seat: number | null; how: 'elected' | 'named' }
  | { kind: 'nightAction'; action: NightAction }
  | { kind: 'markWoken'; seats: number[] }
  | { kind: 'resolveDawn' }
  | { kind: 'ghostLetter'; seat: number; letter: string }
  | { kind: 'hunterShot'; seat: number; target: number }
  | { kind: 'catScratchNow'; seat: number; target: number }
  | { kind: 'nameSheep'; seat: number; target: number }
  | { kind: 'startDay' }
  | { kind: 'ravenMark'; seat: number; target: number | null }
  | { kind: 'judge'; seat: number }
  | { kind: 'coup'; seat: number; target: number }
  | { kind: 'parrotCheck'; said: boolean }
  | { kind: 'ruleBreak'; seat: number; offence: 'role' | 'oath' | 'peek' }
  | { kind: 'vote'; votes: Vote[]; penalties?: Record<number, number> }
  | { kind: 'endDay' };

export type SessionError =
  | NightError
  | DayError
  | 'gameOver'
  | 'wrongPhase'
  | 'promptsPending'
  | 'noSuchPrompt'
  | 'revotePending'
  | 'alreadyVoted'
  | 'notAGhost'
  | 'badLetter';

/** Prompts that must be answered before the game moves on (and before the win check). */
const ELIMINATION_PROMPTS = new Set<Prompt['kind']>(['hunterShot', 'catScratchNow']);

function blocking(p: Prompt): boolean {
  return ELIMINATION_PROMPTS.has(p.kind) || p.kind === 'sheepNames' || (p.kind === 'mayorSuccession' && p.mode === 'name');
}

function now(s: GameState): LogTime {
  if (s.phase.kind === 'day') return { day: s.phase.day };
  if (s.phase.kind === 'night') return { night: s.phase.night };
  return { night: 0 };
}

/** Apply one narrator command. */
export function dispatch(session: Session, command: Command): Session | SessionError {
  if (session.state.phase.kind === 'over') return 'gameOver';
  const next = apply(session, command);
  if (typeof next === 'string') return next;
  const past = [...session.past, { ...session, past: [] }].slice(-UNDO_LIMIT);
  return settle({ ...next, past });
}

/** Step back one command. */
export function undo(session: Session): Session {
  const previous = session.past[session.past.length - 1];
  if (!previous) return session;
  return { ...previous, past: session.past.slice(0, -1) };
}

/**
 * After every command: once no shot or scratch is pending, check for a winner (R9).
 * The Angel's win was already decided by the vote.
 */
function settle(s: Session): Session {
  if (s.state.phase.kind === 'over') return s;
  if (s.prompts.some((p) => ELIMINATION_PROMPTS.has(p.kind))) return s;
  const dying = s.log[s.log.length - 1]?.event;
  const anyDeath = dying && 'deaths' in dying && dying.deaths.length > 0;
  if (!anyDeath && dying?.kind !== 'dawn') return s;
  const winner = checkWinner(s.state);
  return winner ? gameOver(s, winner) : s;
}

function gameOver(s: Session, result: WinResult): Session {
  return {
    ...s,
    state: { ...s.state, phase: { kind: 'over', result } },
    night: null,
    log: [...s.log, { at: now(s.state), event: { kind: 'gameOver', result } }],
  };
}

function log(s: Session, event: LogEvent, at: LogTime = now(s.state)): Session {
  return { ...s, log: [...s.log, { at, event }] };
}

/** Use a day outcome: new state, its prompts added, its deaths logged. */
function withOutcome(s: Session, out: DayOutcome, event: LogEvent): Session {
  return log({ ...s, state: out.state, prompts: [...s.prompts, ...out.prompts] }, event);
}

function takePrompt(s: Session, match: (p: Prompt) => boolean): Session | null {
  const i = s.prompts.findIndex(match);
  if (i < 0) return null;
  return { ...s, prompts: [...s.prompts.slice(0, i), ...s.prompts.slice(i + 1)] };
}

function apply(s: Session, c: Command): Session | SessionError {
  const phase = s.state.phase;
  const isNight = phase.kind === 'night';
  const isDay = phase.kind === 'day';

  switch (c.kind) {
    case 'setMayor': {
      if (c.seat !== null && !s.state.players[c.seat]?.alive) return 'dead';
      // Answers a pending succession, if any.
      const answered = takePrompt(s, (p) => p.kind === 'mayorSuccession') ?? s;
      return log({ ...answered, state: setMayor(answered.state, c.seat) }, { kind: 'mayor', seat: c.seat, how: c.how });
    }

    case 'nightAction': {
      if (!isNight || !s.night) return 'wrongPhase';
      const out = applyNightAction(s.state, s.night, c.action);
      if (typeof out === 'string') return out;
      const result: ActionResult = {};
      for (const key of ['answer', 'group', 'failed', 'shownRole', 'linked', 'tapped'] as const) {
        if (out[key] !== undefined) (result as Record<string, unknown>)[key] = out[key];
      }
      return log({ ...s, state: out.state, night: out.record }, { kind: 'nightAction', action: c.action, result });
    }

    case 'markWoken': {
      if (!isNight || !s.night) return 'wrongPhase';
      return { ...s, night: markWoken(s.night, c.seats) };
    }

    case 'resolveDawn': {
      if (!isNight || !s.night) return 'wrongPhase';
      const r = resolveDawn(s.state, s.night);
      return log(
        { ...s, state: r.state, night: null, prompts: [...s.prompts, ...r.prompts] },
        { kind: 'dawn', deaths: r.deaths, announcements: r.announcements },
      );
    }

    case 'ghostLetter': {
      if (!isNight) return 'wrongPhase';
      if (!ghostsAtDawn(s.state, phase.night).includes(c.seat)) return 'notAGhost';
      if (!isGhostLetter(c.letter)) return 'badLetter';
      const already = s.log.some(
        (e) => e.event.kind === 'ghostLetter' && e.event.seat === c.seat && 'night' in e.at && e.at.night === phase.night,
      );
      if (already) return 'used';
      return log(s, { kind: 'ghostLetter', seat: c.seat, letter: c.letter });
    }

    case 'hunterShot': {
      const rest = takePrompt(s, (p) => p.kind === 'hunterShot' && p.seat === c.seat);
      if (!rest) return 'noSuchPrompt';
      const t = s.state.players[c.target];
      if (!t) return 'noSuchPlayer';
      if (!t.alive) return 'dead';
      const r = resolveHunterShot(s.state, c.seat, c.target);
      return log({ ...rest, state: r.state, prompts: [...rest.prompts, ...r.prompts] }, {
        kind: 'hunterShot',
        seat: c.seat,
        target: c.target,
        deaths: r.deaths,
      });
    }

    case 'catScratchNow': {
      const rest = takePrompt(s, (p) => p.kind === 'catScratchNow' && p.seat === c.seat);
      if (!rest) return 'noSuchPrompt';
      const out = catScratchNow(s.state, c.seat, c.target);
      if (typeof out === 'string') return out;
      return withOutcome(rest, out, { kind: 'catScratch', seat: c.seat, target: c.target, deaths: out.deaths });
    }

    case 'nameSheep': {
      const rest = takePrompt(s, (p) => p.kind === 'sheepNames' && p.seat === c.seat);
      if (!rest) return 'noSuchPrompt';
      const state = nameNextSheep(s.state, c.seat, c.target);
      if (typeof state === 'string') return state;
      return log({ ...rest, state }, { kind: 'sheepNamed', from: c.seat, to: c.target });
    }

    case 'startDay': {
      if (!isNight || s.night) return 'wrongPhase';
      if (s.prompts.some(blocking)) return 'promptsPending';
      const day = phase.night;
      return log({ ...s, state: startDay(s.state, day) }, { kind: 'dayStart' }, { day });
    }

    case 'ravenMark': {
      if (!isDay) return 'wrongPhase';
      const state = ravenMark(s.state, c.seat, c.target);
      if (typeof state === 'string') return state;
      return log({ ...s, state }, { kind: 'ravenMark', seat: c.seat, target: c.target });
    }

    case 'judge': {
      if (!isDay) return 'wrongPhase';
      if (s.votedDay === phase.day || s.revote) return 'alreadyVoted';
      const state = judgeAdjourns(s.state, c.seat);
      if (typeof state === 'string') return state;
      return log({ ...s, state }, { kind: 'judge', seat: c.seat });
    }

    case 'coup': {
      if (!isDay) return 'wrongPhase';
      if (s.votedDay === phase.day || s.revote) return 'alreadyVoted';
      const out = dictatorCoup(s.state, c.seat, c.target);
      if (typeof out === 'string') return out;
      return withOutcome(s, out, { kind: 'coup', seat: c.seat, target: c.target, deaths: out.deaths });
    }

    case 'parrotCheck': {
      if (!isDay) return 'wrongPhase';
      const out = parrotWordCheck(s.state, c.said);
      if (!out) return s;
      return withOutcome(s, out, { kind: 'parrotRemoved', deaths: out.deaths });
    }

    case 'ruleBreak': {
      if (!isDay && !isNight) return 'wrongPhase';
      const t = s.state.players[c.seat];
      if (!t) return 'noSuchPlayer';
      if (!t.alive) return 'dead';
      const out = ruleBreak(s.state, c.seat, c.offence);
      return withOutcome(s, out, { kind: 'ruleBreak', seat: c.seat, offence: c.offence, deaths: out.deaths });
    }

    case 'vote': {
      if (!isDay) return 'wrongPhase';
      if (s.prompts.some(blocking)) return 'promptsPending';
      if (s.votedDay === phase.day) return 'alreadyVoted';
      if (isNoVoteDay(s.state)) return 'noVoteToday';
      const tied = s.revote ?? [];
      const penalties = c.penalties ?? {};
      const tally = tallyVotes(s.state, c.votes, penalties, tied);
      if (typeof tally === 'string') return tally;
      const result = voteResult(s.state, tally, s.revote !== null);
      const logged = log(s, { kind: 'vote', votes: c.votes, penalties, tied, totals: [...tally.totals.entries()], result });
      if (result.kind === 'revote') return { ...logged, revote: result.tied };
      const out = execute(logged.state, result);
      const done = withOutcome({ ...logged, revote: null, votedDay: phase.day }, out, { kind: 'execution', deaths: out.deaths });
      // The Angel's win ends the game at once.
      if (out.winner?.kind === 'solo' && out.winner.roleId === 'angel') return gameOver(done, out.winner);
      return done;
    }

    case 'endDay': {
      if (!isDay) return 'wrongPhase';
      if (s.revote) return 'revotePending';
      if (s.prompts.some(blocking)) return 'promptsPending';
      const state = endDay(s.state);
      const night = phase.day + 1;
      return log({ ...s, state, night: startNightRecord(night, startOfNightFacts(state, night)) }, { kind: 'nightStart' }, { night });
    }
  }
}

// ─── what the screens show ─────────────────────────────────

/** Tonight's calls, in order, given what has happened so far (prayer, Devil Wolf block, jail). */
export function currentCalls(s: Session): NightCall[] {
  if (s.state.phase.kind !== 'night' || !s.night) return [];
  return planNight(s.state, s.night.night, s.night.facts);
}

/** Players tapped at the start of tonight (step 0). */
export function currentTaps(s: Session): StartTap[] {
  if (s.state.phase.kind !== 'night' || !s.night) return [];
  return startOfNightTaps(s.state, s.night.night);
}

// ─── saving ────────────────────────────────────────────────

type SavedSession = Omit<Session, 'past'>;

export function saveSession(s: Session): string {
  const { past: _past, ...saved } = s;
  return toSaveString<SavedSession>(PACK_ID, saved);
}

const knownRole = (id: string) => ROLES.some((r) => r.id === id);

function isNightRecord(x: unknown): x is NightRecord {
  if (!isRecord(x) || typeof x['night'] !== 'number' || !isRecord(x['facts'])) return false;
  const template = startNightRecord(1, startOfNightFacts({ packState: {} } as GameState, 1));
  return Object.entries(template).every(([key, value]) => {
    const v = x[key];
    if (Array.isArray(value)) return Array.isArray(v);
    // Optional fields: nothing yet, a seat, or a choice.
    if (value === null) return v === null || typeof v === 'number' || isRecord(v);
    return typeof v === typeof value;
  });
}

function checkSession(x: unknown): Session | null {
  if (!isRecord(x)) return null;
  if (!isGameState(x['state'], knownRole)) return null;
  if (x['night'] !== null && !isNightRecord(x['night'])) return null;
  if (!Array.isArray(x['prompts']) || !x['prompts'].every((p) => isRecord(p) && typeof p['kind'] === 'string')) return null;
  if (x['revote'] !== null && !Array.isArray(x['revote'])) return null;
  if (x['votedDay'] !== null && typeof x['votedDay'] !== 'number') return null;
  if (!Array.isArray(x['log']) || !x['log'].every((e) => isRecord(e) && isRecord(e['at']) && isRecord(e['event']))) return null;
  return { ...(x as unknown as SavedSession), past: [] };
}

export function loadSession(text: string): Session | LoadError {
  return fromSaveString(text, PACK_ID, checkSession);
}

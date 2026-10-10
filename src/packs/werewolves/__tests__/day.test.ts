import type { GameState } from '@/engine/state';
import {
  catScratchNow,
  dictatorCoup,
  endDay,
  execute,
  judgeAdjourns,
  nameNextSheep,
  parrotWordCheck,
  prepareGame,
  ravenMark,
  reachedDefenceThreshold,
  ruleBreak,
  setMayor,
  startDay,
  tallyVotes,
  voteResult,
  voters,
  type Tally,
  type Vote,
} from '../day';
import { gameOf, withPlayer } from './fixtures';

const CORE = ['werewolf', 'werewolf', 'seer', 'witch', 'salvator', 'hunter', 'villager', 'villager'];

const dayGame = (roles: string[], day = 2): GameState => startDay(prepareGame(gameOf(roles)), day);
const withPack = (s: GameState, patch: GameState['packState']): GameState => ({ ...s, packState: { ...s.packState, ...patch } });

/** Everyone in `voters` votes for `target`, unless overridden. */
function ballot(state: GameState, target: number, overrides: Record<number, number> = {}, tied: number[] = []): Vote[] {
  return voters(state, tied).map((voter) => ({ voter, target: overrides[voter] ?? target }));
}
function tally(state: GameState, votes: Vote[], penalties: Record<number, number> = {}, tied: number[] = []): Tally {
  const t = tallyVotes(state, votes, penalties, tied);
  if (typeof t === 'string') throw new Error(`tally refused: ${t}`);
  return t;
}
function ok<T>(x: T | string): T {
  if (typeof x === 'string') throw new Error(`refused: ${x}`);
  return x;
}

describe('voters', () => {
  test('every living player votes; the paralysed and the dead do not', () => {
    let g = dayGame(CORE);
    g = { ...g, players: g.players.map((p) => (p.seat === 7 ? { ...p, alive: false } : p)) };
    g = withPack(g, { paralysedSeat: 3 });
    expect(voters(g)).toEqual([0, 1, 2, 4, 5, 6]);
  });

  test('in a revote the tied players do not vote', () => {
    expect(voters(dayGame(CORE), [0, 6])).toEqual([1, 2, 3, 4, 5, 7]);
  });
});

describe('counting votes', () => {
  test("the mayor's vote counts twice", () => {
    const g = setMayor(dayGame(CORE), 2);
    const t = tally(g, ballot(g, 0, { 2: 1 }));
    expect(t.totals.get(1)).toBe(2);
    expect(t.totals.get(0)).toBe(7);
  });

  test('every voter must vote exactly once', () => {
    const g = dayGame(CORE);
    const votes = ballot(g, 0);
    expect(tallyVotes(g, votes.slice(1))).toBe('mustVoteOnce');
    expect(tallyVotes(g, [...votes, { voter: 2, target: 1 }])).toBe('mustVoteOnce');
  });

  test('a paralysed or dead player cannot vote, and nobody can vote for the dead', () => {
    const g = withPack(dayGame(CORE), { paralysedSeat: 3 });
    expect(tallyVotes(g, [...ballot(g, 0), { voter: 3, target: 0 }])).toBe('notAVoter');
    const dead = { ...dayGame(CORE), players: dayGame(CORE).players.map((p) => (p.seat === 7 ? { ...p, alive: false } : p)) };
    expect(tallyVotes(dead, ballot(dead, 7))).toBe('dead');
  });

  test('penalty votes and the Raven count only in the first vote, and not towards the defence threshold', () => {
    const g = ok(ravenMark(dayGame([...CORE, 'raven']), 8, 6));
    const votes = ballot(g, 0, { 2: 6, 3: 6 });
    const t = tally(g, votes, { 6: 1 });
    expect(t.totals.get(6)).toBe(5);
    expect(t.real.get(6)).toBe(2);
    expect(reachedDefenceThreshold(t, 6)).toBe(false);
    expect(reachedDefenceThreshold(t, 0)).toBe(true);
    // Revote between 0 and 6: no penalty, no Raven.
    const re = tally(g, ballot(g, 6, {}, [0, 6]), { 6: 1 }, [0, 6]);
    expect(re.totals.get(6)).toBe(7);
  });

  test("yesterday's Raven mark does not count today", () => {
    const marked = ok(ravenMark(dayGame([...CORE, 'raven'], 2), 8, 6));
    const tomorrow = startDay(marked, 3);
    const t = tally(tomorrow, ballot(tomorrow, 0));
    expect(t.totals.get(6)).toBeUndefined();
  });

  test('the Raven cannot mark himself or act while paralysed', () => {
    const g = dayGame([...CORE, 'raven']);
    expect(ravenMark(g, 8, 8)).toBe('notSelf');
    expect(ravenMark(withPack(g, { paralysedSeat: 8 }), 8, 6)).toBe('paralysed');
    expect(ravenMark(g, 2, 6)).toBe('wrongRole');
  });

  test('in a revote only the tied players can be voted for', () => {
    const g = dayGame(CORE);
    expect(tallyVotes(g, ballot(g, 1, {}, [0, 6]), {}, [0, 6])).toBe('notAmongTied');
  });
});

describe('result and ties', () => {
  const tieVotes = (g: GameState) => {
    // 8 voters: 4 for seat 0, 4 for seat 6.
    const v = voters(g);
    return v.map((voter, i) => ({ voter, target: i < 4 ? 6 : 0 }));
  };

  test('a clear leader is executed', () => {
    const g = dayGame(CORE);
    expect(voteResult(g, tally(g, ballot(g, 0, { 0: 6 })), false)).toEqual({ kind: 'execute', seat: 0 });
  });

  test('a Day 1 tie: no execution by default (S5), a revote otherwise', () => {
    const g1 = dayGame(CORE, 1);
    expect(voteResult(g1, tally(g1, tieVotes(g1)), false)).toEqual({ kind: 'noExecution' });
    const revote = { ...g1, settings: { ...g1.settings, day1Tie: 'revote' as const } };
    expect(voteResult(revote, tally(revote, tieVotes(revote)), false)).toEqual({ kind: 'revote', tied: [0, 6] });
  });

  test('a later tie goes to a revote; a tied revote means no execution', () => {
    const g = dayGame(CORE, 2);
    expect(voteResult(g, tally(g, tieVotes(g)), false)).toEqual({ kind: 'revote', tied: [0, 6] });
    const re = tally(g, voters(g, [0, 6]).map((voter, i) => ({ voter, target: i < 3 ? 0 : 6 })), {}, [0, 6]);
    expect(voteResult(g, re, true)).toEqual({ kind: 'noExecution' });
  });

  test('the Sheep takes any tie, even on Day 1', () => {
    const g = dayGame([...CORE.slice(0, 7), 'sheep'], 1);
    expect(g.players[7]?.memory.sheep).toBe(true);
    expect(voteResult(g, tally(g, tieVotes(g)), false)).toEqual({ kind: 'sheep', seat: 7 });
  });

  test('the eliminated Sheep names the next Sheep, who keeps role and team', () => {
    const g = dayGame([...CORE.slice(0, 7), 'sheep']);
    const out = execute(g, { kind: 'sheep', seat: 7 });
    expect(out.prompts).toContainEqual({ kind: 'sheepNames', seat: 7 });
    const s = ok(nameNextSheep(out.state, 7, 2));
    expect(s.players[2]?.memory.sheep).toBe(true);
    expect(s.players[2]?.roleId).toBe('seer');
    expect(nameNextSheep(out.state, 6, 2)).toBe('notTheSheep');
    expect(nameNextSheep(out.state, 7, 7)).toBe('dead');
  });

  test('execution triggers the Hunter', () => {
    const g = dayGame(CORE);
    const out = execute(g, { kind: 'execute', seat: 5 });
    expect(out.prompts).toEqual([{ kind: 'hunterShot', seat: 5 }]);
  });
});

describe('the Angel', () => {
  const ANGEL = ['werewolf', 'werewolf', 'seer', 'witch', 'angel', 'villager', 'villager', 'villager'];

  test('executed on the first voting day, the Angel wins alone', () => {
    const out = execute(dayGame(ANGEL, 1), { kind: 'execute', seat: 4 });
    expect(out.winner).toEqual({ kind: 'solo', seat: 4, roleId: 'angel' });
  });

  test('the first voting day is the first day a vote was held, not Day 1', () => {
    // Day 1 had no vote (Judge); the Angel is executed on Day 2, the first vote.
    const out = execute(dayGame(ANGEL, 2), { kind: 'execute', seat: 4 });
    expect(out.winner).toEqual({ kind: 'solo', seat: 4, roleId: 'angel' });
  });

  test('after surviving the first vote, the Angel becomes a villager at nightfall', () => {
    const d1 = execute(dayGame(ANGEL, 1), { kind: 'execute', seat: 5 });
    const night = endDay(d1.state);
    expect(night.players[4]?.roleId).toBe('villager');
    expect(night.players[4]?.team).toBe('village');
    expect(night.phase).toEqual({ kind: 'night', night: 2 });
    const d2 = execute(startDay(night, 2), { kind: 'execute', seat: 4 });
    expect(d2.winner).toBeNull();
  });

  test('a day without a vote does not use up the Angel', () => {
    const night = endDay(dayGame(ANGEL, 1));
    expect(night.players[4]?.roleId).toBe('angel');
  });
});

describe('day powers', () => {
  test('the Judge cancels the vote once', () => {
    const g = dayGame([...CORE, 'judge']);
    const s = ok(judgeAdjourns(g, 8));
    expect(tallyVotes(s, ballot(s, 0))).toBe('noVoteToday');
    expect(judgeAdjourns(startDay(s, 3), 8)).toBe('used');
  });

  test('Dictator hits a wolf: the wolf dies, he becomes mayor, no vote today', () => {
    const g = setMayor(dayGame([...CORE, 'dictator']), 2);
    const out = ok(dictatorCoup(g, 8, 0));
    expect(out.deaths.map((d) => d.seat)).toEqual([0]);
    expect(out.state.mayorSeat).toBe(8);
    expect(tallyVotes(out.state, ballot(out.state, 1))).toBe('noVoteToday');
    expect(dictatorCoup(startDay(out.state, 3), 8, 1)).toBe('used');
  });

  test('Dictator misses: both die', () => {
    const out = ok(dictatorCoup(dayGame([...CORE, 'dictator']), 8, 6));
    expect(out.deaths.map((d) => d.seat).sort()).toEqual([6, 8]);
  });

  test('a coup on the Prince hits the Bodyguard instead', () => {
    const g = dayGame(['werewolf', 'werewolf', 'prince', 'bodyguard', 'seer', 'villager', 'villager', 'dictator']);
    const out = ok(dictatorCoup(g, 7, 2));
    const dead = out.deaths.map((d) => d.seat).sort();
    expect(dead).toEqual([3, 7]);
    expect(out.state.players[2]?.alive).toBe(true);
  });

  test('no coup while paralysed or on a day with no vote', () => {
    const g = dayGame([...CORE, 'dictator', 'judge']);
    expect(dictatorCoup(withPack(g, { paralysedSeat: 8 }), 8, 0)).toBe('paralysed');
    expect(dictatorCoup(ok(judgeAdjourns(g, 9)), 8, 0)).toBe('noVoteToday');
  });

  test("the Parrot Wolf who didn't say his word is removed cleanly before the vote", () => {
    const g = dayGame(['parrot_wolf', 'werewolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']);
    expect(parrotWordCheck(g, true)).toBeNull();
    expect(parrotWordCheck(withPack(g, { paralysedSeat: 0 }), false)).toBeNull();
    const out = parrotWordCheck(g, false);
    expect(out?.deaths).toEqual([{ seat: 0, cause: 'parrotWord' }]);
    // The vote still takes place.
    expect(typeof tallyVotes(out!.state, ballot(out!.state, 1))).toBe('object');
  });

  test('a rule-break removal is clean; an oath also cancels the vote', () => {
    const g = dayGame(CORE);
    const role = ruleBreak(g, 5, 'role');
    expect(role.prompts).toEqual([]);
    expect(typeof tallyVotes(role.state, ballot(role.state, 0))).toBe('object');
    const oath = ruleBreak(g, 6, 'oath');
    expect(tallyVotes(oath.state, ballot(oath.state, 0))).toBe('noVoteToday');
  });

  test('a clean removal of the mayor still asks for a successor', () => {
    const out = ruleBreak(setMayor(dayGame(CORE), 5), 5, 'peek');
    expect(out.prompts).toEqual([{ kind: 'mayorSuccession', seat: 5, mode: 'name' }]);
  });
});

describe('the Cat', () => {
  const CAT = ['werewolf', 'werewolf', 'seer', 'witch', 'cat', 'villager', 'villager', 'villager'];

  test('a Cat executed before scratching is prompted and takes a wolf with her', () => {
    const g = withPlayer(dayGame(CAT), 4, { memory: { scratchPending: true } });
    const out = execute(g, { kind: 'execute', seat: 4 });
    expect(out.prompts).toContainEqual({ kind: 'catScratchNow', seat: 4 });
    expect(catScratchNow(out.state, 4, 5)).toBe('notAWolf');
    const scratched = ok(catScratchNow(out.state, 4, 1));
    expect(scratched.deaths).toEqual([{ seat: 1, cause: 'catScratch' }]);
    expect(catScratchNow(scratched.state, 4, 0)).toBe('wrongRole');
  });
});

describe('nightfall', () => {
  test('paralysis ends when night falls', () => {
    const s = endDay(withPack(dayGame(CORE), { paralysedSeat: 3 }));
    expect(s.packState['paralysedSeat']).toBeNull();
    expect(voters(startDay(s, 3))).toContain(3);
  });
});

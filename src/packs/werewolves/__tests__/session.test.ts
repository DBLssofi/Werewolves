import { toSaveString } from '@/engine/save';
import { gameOf } from './fixtures';
import { currentCalls, dispatch, loadSession, newSession, saveSession, undo, type Command, type Session } from '../session';

const CORE = ['werewolf', 'werewolf', 'seer', 'witch', 'salvator', 'hunter', 'villager', 'villager'];

/** Run commands in order; any refused command fails the test with its reason. */
function run(session: Session, commands: Command[]): Session {
  let s = session;
  for (const c of commands) {
    const next = dispatch(s, c);
    if (typeof next === 'string') throw new Error(`${c.kind} refused: ${next}`);
    s = next;
  }
  return s;
}

/** A night with no death: the wolves choose `victim` and the Salvator (seat 4) protects them. */
const savedNight = (victim: number): Command[] => [
  { kind: 'nightAction', action: { kind: 'protect', seat: 4, target: victim } },
  { kind: 'nightAction', action: { kind: 'packVictim', target: victim, infect: false } },
  { kind: 'resolveDawn' },
];

/** Everyone who must vote votes for `target`. */
function everyoneVotes(s: Session, target: number, except: Record<number, number> = {}): Command {
  const tied = s.revote ?? [];
  const voters = s.state.players
    .filter((p) => p.alive && s.state.packState['paralysedSeat'] !== p.seat && !tied.includes(p.seat))
    .map((p) => p.seat);
  return { kind: 'vote', votes: voters.map((voter) => ({ voter, target: except[voter] ?? target })) };
}

describe('a whole core game', () => {
  const start = newSession(gameOf(CORE));

  const afterDay1 = (() => {
    let s = run(start, [
      { kind: 'setMayor', seat: 2, how: 'elected' },
      { kind: 'nightAction', action: { kind: 'protect', seat: 4, target: 6 } },
      { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
      { kind: 'nightAction', action: { kind: 'seerCheck', seat: 2, target: 0 } },
      { kind: 'resolveDawn' },
      { kind: 'startDay' },
    ]);
    s = run(s, [everyoneVotes(s, 0, { 0: 2, 1: 2 }), { kind: 'endDay' }]);
    return s;
  })();

  test('night 1, dawn and the execution are applied and logged', () => {
    expect(afterDay1.state.players[7]?.alive).toBe(false);
    expect(afterDay1.state.players[0]?.alive).toBe(false);
    expect(afterDay1.state.phase).toEqual({ kind: 'night', night: 2 });
    const kinds = afterDay1.log.map((e) => e.event.kind);
    expect(kinds).toEqual(['nightStart', 'mayor', 'nightAction', 'nightAction', 'nightAction', 'dawn', 'dayStart', 'vote', 'execution', 'nightStart']);
    const check = afterDay1.log.find((e) => e.event.kind === 'nightAction' && e.event.action.kind === 'seerCheck');
    expect(check?.event).toMatchObject({ result: { answer: 'thumbDown' } });
    expect(afterDay1.log.find((e) => e.event.kind === 'execution')?.event).toEqual({
      kind: 'execution',
      deaths: [{ seat: 0, cause: 'execution' }],
    });
  });

  test('the winner is checked only after the Hunter has shot', () => {
    const dawn = run(afterDay1, [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 5, infect: false } },
      { kind: 'resolveDawn' },
    ]);
    expect(dawn.prompts).toEqual([{ kind: 'hunterShot', seat: 5 }]);
    expect(dispatch(dawn, { kind: 'startDay' })).toBe('promptsPending');
    const over = run(dawn, [{ kind: 'hunterShot', seat: 5, target: 1 }]);
    expect(over.state.phase).toEqual({ kind: 'over', result: { kind: 'team', team: 'village' } });
    expect(over.log[over.log.length - 1]?.event).toEqual({ kind: 'gameOver', result: { kind: 'team', team: 'village' } });
    expect(dispatch(over, { kind: 'startDay' })).toBe('gameOver');
  });

  test('even when the last wolf is dead at dawn, the game waits for the Hunter’s shot', () => {
    const dawn = run(afterDay1, [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 5, infect: false } },
      { kind: 'nightAction', action: { kind: 'poison', seat: 3, target: 1 } },
      { kind: 'resolveDawn' },
    ]);
    expect(dawn.state.players.filter((p) => p.alive).map((p) => p.seat)).toEqual([2, 3, 4, 6]);
    expect(dawn.state.phase.kind).toBe('night');
    const over = run(dawn, [{ kind: 'hunterShot', seat: 5, target: 6 }]);
    expect(over.state.phase).toEqual({ kind: 'over', result: { kind: 'team', team: 'village' } });
  });

  test('every death is in the log with its cause', () => {
    const over = run(afterDay1, [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 5, infect: false } },
      { kind: 'resolveDawn' },
      { kind: 'hunterShot', seat: 5, target: 1 },
    ]);
    const deaths = over.log.flatMap((e) => ('deaths' in e.event ? e.event.deaths : []));
    expect(deaths).toEqual([
      { seat: 7, cause: 'pack' },
      { seat: 0, cause: 'execution' },
      { seat: 5, cause: 'pack' },
      { seat: 1, cause: 'hunter' },
    ]);
  });
});

describe('commands in the wrong place are refused', () => {
  const s = newSession(gameOf(CORE));

  test('no voting at night, no night action by day', () => {
    expect(dispatch(s, everyoneVotes(s, 0))).toBe('wrongPhase');
    const day = run(s, [...savedNight(7), { kind: 'startDay' }]);
    expect(dispatch(day, { kind: 'nightAction', action: { kind: 'seerCheck', seat: 2, target: 0 } })).toBe('wrongPhase');
  });

  test('a refused night action passes on its reason', () => {
    expect(dispatch(s, { kind: 'nightAction', action: { kind: 'seerCheck', seat: 2, target: 2 } })).toBe('notSelf');
  });

  test('one execution vote per day', () => {
    const day = run(s, [...savedNight(7), { kind: 'startDay' }]);
    const voted = run(day, [everyoneVotes(day, 6)]);
    expect(dispatch(voted, everyoneVotes(voted, 7))).toBe('alreadyVoted');
  });
});

describe('calls that must be answered', () => {
  test('the wolves must choose a victim before dawn', () => {
    const s = newSession(gameOf(CORE));
    expect(dispatch(s, { kind: 'resolveDawn' })).toBe('mustAct');
    const chosen = run(s, [{ kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } }]);
    expect(typeof dispatch(chosen, { kind: 'resolveDawn' })).toBe('object');
  });

  test('not when the wolves cannot kill tonight (Priest night)', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'priest', 'villager', 'villager', 'villager']);
    let s = run(newSession(g), [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
      { kind: 'resolveDawn' },
      { kind: 'startDay' },
      { kind: 'endDay' },
      { kind: 'nightAction', action: { kind: 'pray', seat: 4 } },
    ]);
    expect(typeof dispatch(s, { kind: 'resolveDawn' })).toBe('object');
  });

  test('the Cat must scratch a wolf on her scratch night', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'cat', 'villager', 'villager', 'villager']);
    let s = run(newSession(g), [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 4, infect: false } },
      { kind: 'resolveDawn' },
      { kind: 'startDay' },
      { kind: 'endDay' },
      { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
    ]);
    expect(dispatch(s, { kind: 'resolveDawn' })).toBe('mustAct');
    s = run(s, [{ kind: 'nightAction', action: { kind: 'catScratch', seat: 4, target: 0 } }]);
    expect(typeof dispatch(s, { kind: 'resolveDawn' })).toBe('object');
  });
});

describe('ties', () => {
  test('a tie on Day 2 needs a revote before night falls', () => {
    let s = run(newSession(gameOf(CORE)), [...savedNight(7), { kind: 'startDay' }, { kind: 'endDay' }]);
    s = run(s, [...savedNight(6), { kind: 'startDay' }]);
    const tie = everyoneVotes(s, 6, { 0: 7, 1: 7, 2: 7, 3: 7 });
    s = run(s, [tie]);
    expect(s.revote).toEqual([6, 7]);
    expect(dispatch(s, { kind: 'endDay' })).toBe('revotePending');
    s = run(s, [everyoneVotes(s, 7)]);
    expect(s.revote).toBeNull();
    expect(s.state.players[7]?.alive).toBe(false);
  });
});

describe('the Angel', () => {
  test('voted out on the first voting day: the game ends at once', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'angel', 'villager', 'villager', 'villager']);
    let s = run(newSession(g), [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
      { kind: 'nightAction', action: { kind: 'heal', seat: 3, target: 7 } },
      { kind: 'resolveDawn' },
      { kind: 'startDay' },
    ]);
    s = run(s, [everyoneVotes(s, 4, { 4: 0 })]);
    expect(s.state.phase).toEqual({ kind: 'over', result: { kind: 'solo', seat: 4, roleId: 'angel' } });
  });
});

describe('the Ghost', () => {
  test('one letter per dawn', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'ghost', 'villager', 'villager', 'villager']);
    let s = run(newSession(g), [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 4, infect: false } },
      { kind: 'resolveDawn' },
    ]);
    expect(dispatch(s, { kind: 'ghostLetter', seat: 4, letter: 'R' })).toBe('notAGhost');
    s = run(s, [{ kind: 'startDay' }, { kind: 'endDay' }, { kind: 'ghostLetter', seat: 4, letter: 'R' }]);
    expect(dispatch(s, { kind: 'ghostLetter', seat: 4, letter: 'S' })).toBe('used');
    expect(dispatch(s, { kind: 'ghostLetter', seat: 4, letter: 'ST' })).toBe('badLetter');
  });
});

describe('undo', () => {
  test('steps back one command at a time', () => {
    const s0 = newSession(gameOf(CORE));
    const s1 = run(s0, [{ kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } }]);
    const s2 = run(s1, [{ kind: 'resolveDawn' }]);
    expect(s2.state.players[7]?.alive).toBe(false);
    const back = undo(s2);
    expect(back.state.players[7]?.alive).toBe(true);
    expect(back.night?.pack).toEqual({ target: 7, infect: false });
    expect(undo(back).night?.pack).toBeNull();
    expect(undo(undo(back))).toEqual(undo(back));
  });

  test('a mis-tap is fixed by undo and a new choice', () => {
    const s = run(newSession(gameOf(CORE)), [{ kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } }]);
    const fixed = run(undo(s), [{ kind: 'nightAction', action: { kind: 'packVictim', target: 6, infect: false } }]);
    expect(fixed.night?.pack?.target).toBe(6);
    expect(fixed.log.filter((e) => e.event.kind === 'nightAction')).toHaveLength(1);
  });
});

describe('calls', () => {
  test('tonight’s calls follow what has happened (a Priest night)', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'priest', 'villager', 'villager', 'villager']);
    let s = run(newSession(g), [
      { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
      { kind: 'resolveDawn' },
      { kind: 'startDay' },
      { kind: 'endDay' },
    ]);
    expect(currentCalls(s).some((c) => c.callId === 'witch')).toBe(true);
    s = run(s, [{ kind: 'nightAction', action: { kind: 'pray', seat: 4 } }]);
    expect(currentCalls(s).some((c) => c.callId === 'witch')).toBe(false);
  });
});

describe('saving and loading', () => {
  const s = run(newSession(gameOf(CORE)), [
    { kind: 'setMayor', seat: 2, how: 'elected' },
    { kind: 'nightAction', action: { kind: 'packVictim', target: 7, infect: false } },
  ]);

  test('a saved game loads back exactly, with an empty undo history', () => {
    const loaded = loadSession(saveSession(s));
    expect(loaded).toEqual({ ...s, past: [] });
    // And play continues from it.
    const next = dispatch(loaded as Session, { kind: 'resolveDawn' });
    expect(typeof next).toBe('object');
  });

  test('bad files are refused with a reason', () => {
    expect(loadSession('{not json')).toBe('notJson');
    expect(loadSession('{"hello":1}')).toBe('notASave');
    const newer = JSON.parse(saveSession(s));
    newer.version = 99;
    expect(loadSession(JSON.stringify(newer))).toBe('newerVersion');
    expect(loadSession(toSaveString('mafia', {}))).toBe('wrongPack');
    const broken = JSON.parse(saveSession(s));
    broken.session.state.players[3].alive = 'yes';
    expect(loadSession(JSON.stringify(broken))).toBe('damaged');
    const unknownRole = JSON.parse(saveSession(s));
    unknownRole.session.state.players[3].roleId = 'dragon';
    expect(loadSession(JSON.stringify(unknownRole))).toBe('damaged');
  });
});

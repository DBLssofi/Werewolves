import { NO_FACTS } from '@/engine/night';
import { applyNightAction, markWoken, startNightRecord, witchSees } from '../nightActions';
import { gameOf, kill, withPlayer } from './fixtures';
import { act, refusal } from './helpers';

const CORE = ['werewolf', 'werewolf', 'seer', 'witch', 'salvator', 'hunter', 'villager', 'villager'];

describe('limits on choices', () => {
  test('Salvator may protect himself, but not the same player 2 nights in a row', () => {
    const g = gameOf(CORE);
    const n1 = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'protect', seat: 4, target: 4 }]);
    expect(refusal(n1.state, { kind: 'protect', seat: 4, target: 4 }, 2)).toBe('sameAsLastNight');
    expect(refusal(n1.state, { kind: 'protect', seat: 4, target: 6 }, 2)).toBe('ok');
    expect(refusal(n1.state, { kind: 'protect', seat: 4, target: 4 }, 3)).toBe('ok');
  });

  test('the Knight and the Warden cannot choose themselves', () => {
    const g = gameOf([...CORE, 'knight', 'warden']);
    expect(refusal(g, { kind: 'guard', seat: 8, target: 8 })).toBe('notSelf');
    expect(refusal(g, { kind: 'jail', seat: 9, target: 9 })).toBe('notSelf');
  });

  test('targets must be alive', () => {
    expect(refusal(kill(gameOf(CORE), 6), { kind: 'protect', seat: 4, target: 6 })).toBe('targetDead');
  });

  test('a role can only do its own action', () => {
    expect(refusal(gameOf(CORE), { kind: 'protect', seat: 2, target: 6 })).toBe('wrongRole');
  });

  test('the pack cannot attack a wolf', () => {
    expect(refusal(gameOf(CORE), { kind: 'packVictim', target: 1, infect: false })).toBe('targetIsWolf');
  });

  test('infecting needs a living Alpha Wolf with an infection left (S7)', () => {
    expect(refusal(gameOf(CORE), { kind: 'packVictim', target: 6, infect: true })).toBe('wrongRole');
    const alpha = gameOf(['alpha_wolf', ...CORE.slice(1)]);
    expect(refusal(alpha, { kind: 'packVictim', target: 6, infect: true })).toBe('ok');
    const spent = withPlayer(alpha, 0, { memory: { infectionsUsed: 1 } });
    expect(refusal(spent, { kind: 'packVictim', target: 6, infect: true })).toBe('used');
  });

  test('the Priest cannot pray on Night 1, and only once', () => {
    const g = gameOf([...CORE, 'priest']);
    expect(refusal(g, { kind: 'pray', seat: 8 }, 1)).toBe('notTonight');
    expect(refusal(g, { kind: 'pray', seat: 8 }, 2)).toBe('ok');
    expect(refusal(withPlayer(g, 8, { memory: { used: true } }), { kind: 'pray', seat: 8 }, 3)).toBe('used');
  });

  test('Dark Cupid cannot choose himself; Cupid can', () => {
    expect(refusal(gameOf([...CORE, 'dark_cupid']), { kind: 'bind', seat: 8, a: 8, b: 6 })).toBe('notSelf');
    expect(refusal(gameOf([...CORE, 'cupid']), { kind: 'bind', seat: 8, a: 8, b: 6 })).toBe('ok');
  });

  test('a player can be in only one pair of Lovers', () => {
    const g = gameOf([...CORE, 'cupid', 'dark_cupid']);
    const { state } = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'bind', seat: 8, a: 6, b: 7 }]);
    expect(refusal(state, { kind: 'bind', seat: 9, a: 6, b: 2 })).toBe('alreadyALover');
  });

  test('cross-team Lovers form the Lovers team; same-team Lovers keep theirs', () => {
    const g = gameOf([...CORE, 'cupid']);
    const cross = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'bind', seat: 8, a: 0, b: 6 }]);
    expect(cross.state.players[0]?.team).toBe('lovers');
    expect(cross.state.players[6]?.team).toBe('lovers');
    const same = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'bind', seat: 8, a: 2, b: 6 }]);
    expect(same.state.players[2]?.team).toBe('village');
  });
});

describe('Witch', () => {
  const g = gameOf(CORE);
  const start = () => act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'packVictim', target: 6, infect: false }]);

  test('can heal only the player shown to her', () => {
    const { state, record } = start();
    expect(applyNightAction(state, record, { kind: 'heal', seat: 3, target: 7 })).toBe('notShownToWitch');
    expect(typeof applyNightAction(state, record, { kind: 'heal', seat: 3, target: 6 })).toBe('object');
  });

  test('only one potion per night; never poison herself', () => {
    const { state, record } = start();
    const healed = act(state, record, [{ kind: 'heal', seat: 3, target: 6 }]);
    expect(applyNightAction(healed.state, healed.record, { kind: 'poison', seat: 3, target: 0 })).toBe('onePotionPerNight');
    expect(applyNightAction(state, record, { kind: 'poison', seat: 3, target: 3 })).toBe('notSelf');
  });

  test('is shown "nobody" when the victim is protected, and the Knight when he takes the attack', () => {
    const { state, record } = start();
    expect(witchSees(state, record)).toBe(6);
    expect(witchSees(state, { ...record, protect: [6] })).toBeNull();
    expect(witchSees(state, { ...record, guard: [{ knight: 5, target: 6 }] })).toBe(5);
    expect(witchSees(state, { ...record, pack: { target: 6, infect: true } })).toBeNull();
  });
});

describe('what the checks see', () => {
  const g = gameOf(['werewolf', 'sneaky_wolf', 'seer', 'lycan', 'minion', 'villager', 'cursed', 'aura_seer', 'pi', 'witch']);
  const seer = (s = g, target: number) => act({ ...s, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'seerCheck', seat: 2, target }]).results[0]?.answer;

  test('Seer: thumb down = wolf, thumb up = not a wolf', () => {
    expect(seer(g, 0)).toBe('thumbDown');
    expect(seer(g, 1)).toBe('thumbUp'); // Sneaky Wolf
    expect(seer(g, 3)).toBe('thumbDown'); // Lycan
    expect(seer(g, 4)).toBe('thumbUp'); // Minion
    expect(seer(g, 5)).toBe('thumbUp');
  });

  test('Seer: infected players look innocent; a turned Cursed looks like a wolf', () => {
    expect(seer(withPlayer(g, 5, { infected: true, team: 'werewolf' }), 5)).toBe('thumbUp');
    expect(seer(withPlayer(g, 6, { turned: true, team: 'werewolf' }), 6)).toBe('thumbDown');
  });

  test('Seer: once the wolves killed the Wise, the Sneaky Wolf is seen as a wolf', () => {
    expect(seer({ ...g, packState: { wolfPowersLost: true } }, 1)).toBe('thumbDown');
  });

  test('Aura Seer: plain Werewolf and Lycan have no ability; a Witch with no potions still has one', () => {
    const aura = (s: typeof g, target: number) =>
      act({ ...s, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'auraCheck', seat: 7, target }]).results[0]?.answer;
    expect(aura(g, 0)).toBe('thumbDown');
    expect(aura(g, 3)).toBe('thumbDown');
    expect(aura(g, 1)).toBe('thumbUp');
    expect(aura(withPlayer(g, 9, { memory: { healUsed: true, poisonUsed: true } }), 9)).toBe('thumbUp');
  });

  test('P.I.: checks the target and both living neighbours; Sneaky Wolf counts as a wolf', () => {
    const r = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'piCheck', seat: 8, target: 5 }]).results[0];
    expect(r?.group).toEqual([4, 5, 6]);
    expect(r?.answer).toBe('thumbUp');
    const r2 = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'piCheck', seat: 8, target: 2 }]).results[0];
    expect(r2?.answer).toBe('thumbDown');
    expect(refusal(g, { kind: 'piCheck', seat: 8, target: 2 }, 2)).toBe('notTonight');
  });
});

describe('other checks', () => {
  test('Mystic Wolf finds the Seer (not Triple Face) and then has no more answers', () => {
    const g = gameOf(['mystic_wolf', 'werewolf', 'seer', 'triple_face', 'villager', 'villager', 'villager', 'villager']);
    const night = { ...g, phase: { kind: 'night' as const, night: 2 } };
    const miss = act(night, startNightRecord(2, NO_FACTS), [{ kind: 'mysticCheck', seat: 0, target: 3 }]);
    expect(miss.results[0]?.answer).toBe('thumbDown');
    const hit = act(night, startNightRecord(2, NO_FACTS), [{ kind: 'mysticCheck', seat: 0, target: 2 }]);
    expect(hit.results[0]?.answer).toBe('thumbUp');
    expect(refusal(hit.state, { kind: 'mysticCheck', seat: 0, target: 4 }, 3)).toBe('used');
  });

  test('Doctor cures the plague the same night it was caught', () => {
    const g = gameOf([...CORE, 'rat', 'doctor']);
    const n = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [
      { kind: 'plague', seat: 8, target: 6 },
      { kind: 'examine', seat: 9, target: 6 },
    ]);
    expect(n.results[1]?.answer).toBe('thumbUp');
    expect(n.state.players[6]?.plagueNight).toBeNull();
  });

  test('Owl: thumb up for anyone who opened their eyes for a role, including crossed arms', () => {
    const g = gameOf([...CORE, 'owl']);
    const r = markWoken(startNightRecord(1, NO_FACTS), [4, 0, 1]);
    const out = act({ ...g, phase: { kind: 'night', night: 1 } }, r, [
      { kind: 'owlCheck', seat: 8, target: 4 },
      { kind: 'owlCheck', seat: 8, target: 6 },
    ]);
    expect(out.results.map((x) => x.answer)).toEqual(['thumbUp', 'thumbDown']);
  });

  test('the Sect Leader recruits at once; a recruit cannot be recruited twice', () => {
    const g = gameOf([...CORE, 'sect_leader']);
    const n = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [{ kind: 'recruit', seat: 8, target: 6 }]);
    expect(n.state.players[6]?.cult).toBe(true);
    expect(refusal(n.state, { kind: 'recruit', seat: 8, target: 6 }, 2)).toBe('alreadyInCult');
  });
});

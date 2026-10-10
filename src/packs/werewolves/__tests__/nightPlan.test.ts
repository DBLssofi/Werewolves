import { NO_FACTS, type NightCall, type NightFacts } from '@/engine/night';
import { planNight } from '../nightPlan';
import { gameOf, kill, withPlayer } from './fixtures';
import type { GameState } from '@/engine/state';

const call = (calls: NightCall[], id: string, step?: number) =>
  calls.find((c) => c.callId === id && (step === undefined || c.step === step));
const ids = (calls: NightCall[]) => calls.map((c) => c.callId);
const facts = (f: Partial<NightFacts>): NightFacts => ({ ...NO_FACTS, ...f });
const anonymous = (g: GameState): GameState => ({ ...g, settings: { ...g.settings, reveal: 'anonymous' } });

const CORE = ['werewolf', 'werewolf', 'seer', 'witch', 'salvator', 'hunter', 'villager', 'villager'];

describe('order and who is called', () => {
  test('a core game calls Salvator → wolves → Witch → Seer, in step order', () => {
    const calls = planNight(gameOf(CORE), 1, NO_FACTS);
    expect(ids(calls)).toEqual(['salvator', 'pack', 'witch', 'seer']);
    const steps = calls.map((c) => c.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  test('the pack wakes together; roles never woken (Hunter, Villager) are not called', () => {
    const pack = call(planNight(gameOf(CORE), 1, NO_FACTS), 'pack');
    expect(pack).toEqual({ step: 16, callId: 'pack', acting: [0, 1], crossed: [], aloudOnly: false });
  });

  test('the Owl is the last call of the night', () => {
    const calls = planNight(gameOf([...CORE, 'owl', 'troublemaker']), 2, NO_FACTS);
    expect(calls.at(-1)?.callId).toBe('owl');
  });

  test('the Minion and the Beholder are called on Night 1 only', () => {
    const g = gameOf([...CORE, 'minion', 'beholder']);
    expect(ids(planNight(g, 1, NO_FACTS))).toEqual(expect.arrayContaining(['minion', 'beholder']));
    expect(ids(planNight(g, 2, NO_FACTS))).not.toEqual(expect.arrayContaining(['minion']));
    expect(ids(planNight(g, 2, NO_FACTS))).not.toContain('beholder');
  });

  test('Masons are called together on Night 1', () => {
    const c = call(planNight(gameOf([...CORE, 'mason', 'mason']), 1, NO_FACTS), 'mason');
    expect(c?.acting).toEqual([8, 9]);
  });

  test('the P.I. is called on odd nights only', () => {
    const g = gameOf([...CORE, 'pi']);
    expect(call(planNight(g, 3, NO_FACTS), 'pi')).toBeDefined();
    expect(call(planNight(g, 4, NO_FACTS), 'pi')).toBeUndefined();
  });
});

describe('call policy: called every night of the window, even when used up', () => {
  test('Cupid: called Nights 1–3, crossed arms after choosing, not called from Night 4', () => {
    const g = gameOf([...CORE, 'cupid']);
    expect(call(planNight(g, 1, NO_FACTS), 'cupid')?.acting).toEqual([8]);
    const used = withPlayer(g, 8, { memory: { used: true } });
    expect(call(planNight(used, 2, NO_FACTS), 'cupid')).toMatchObject({ acting: [], crossed: [8] });
    expect(call(planNight(used, 4, NO_FACTS), 'cupid')).toBeUndefined();
  });

  test('a Witch with both potions used is still called, with crossed arms', () => {
    const g = withPlayer(gameOf(CORE), 3, { memory: { healUsed: true, poisonUsed: true } });
    expect(call(planNight(g, 3, NO_FACTS), 'witch')).toMatchObject({ acting: [], crossed: [3] });
  });

  test('the Priest: crossed arms on Night 1, can pray from Night 2, crossed arms after praying', () => {
    const g = gameOf([...CORE, 'priest']);
    expect(call(planNight(g, 1, NO_FACTS), 'priest')).toMatchObject({ crossed: [8] });
    expect(call(planNight(g, 2, NO_FACTS), 'priest')).toMatchObject({ acting: [8] });
    expect(call(planNight(withPlayer(g, 8, { memory: { used: true } }), 3, NO_FACTS), 'priest')).toMatchObject({ crossed: [8] });
  });

  test('the Thug is crossed arms until unlocked', () => {
    const g = gameOf([...CORE, 'thug']);
    expect(call(planNight(g, 2, NO_FACTS), 'thug')).toMatchObject({ crossed: [8] });
    expect(call(planNight(withPlayer(g, 8, { memory: { unlocked: true } }), 2, NO_FACTS), 'thug')).toMatchObject({ acting: [8] });
  });

  test('the Doppelganger acts on even nights, crossed arms on odd nights', () => {
    const g = gameOf([...CORE, 'doppelganger']);
    expect(call(planNight(g, 1, NO_FACTS), 'doppelganger')).toMatchObject({ crossed: [8] });
    expect(call(planNight(g, 2, NO_FACTS), 'doppelganger')).toMatchObject({ acting: [8] });
  });

  test('the Sword holder is called every night once the Forger is dealt, even with no sword', () => {
    const g = gameOf([...CORE, 'forger']);
    expect(call(planNight(g, 1, NO_FACTS), 'swordHolder')).toMatchObject({ acting: [], aloudOnly: true });
    const armed = withPlayer(g, 6, { memory: { swords: 1 } });
    expect(call(planNight(armed, 2, NO_FACTS), 'swordHolder')).toMatchObject({ acting: [6], aloudOnly: false });
  });
});

describe('dead roles', () => {
  test('Revealed games: a dead role is not called', () => {
    const g = kill(gameOf(CORE), 3);
    expect(call(planNight(g, 2, NO_FACTS), 'witch')).toBeUndefined();
  });

  test('Anonymous games: a dead role is called aloud, nobody wakes', () => {
    const g = anonymous(kill(gameOf(CORE), 3));
    expect(call(planNight(g, 2, NO_FACTS), 'witch')).toEqual({ step: 25, callId: 'witch', acting: [], crossed: [], aloudOnly: true });
  });

  test("a promoted Apprentice Seer is called in the Seer's slot", () => {
    let g = kill(gameOf([...CORE, 'apprentice_seer']), 2);
    g = withPlayer(g, 8, { memory: { promoted: true } });
    expect(call(planNight(g, 3, NO_FACTS), 'seer')).toMatchObject({ acting: [8], aloudOnly: false });
  });
});

describe('Seer and Guest take turns', () => {
  const g = gameOf([...CORE, 'guest']);

  test('Seer on odd nights, Guest on even nights', () => {
    expect(call(planNight(g, 1, NO_FACTS), 'seer')).toBeDefined();
    expect(call(planNight(g, 1, NO_FACTS), 'guest')).toBeUndefined();
    expect(call(planNight(g, 2, NO_FACTS), 'seer')).toBeUndefined();
    expect(call(planNight(g, 2, NO_FACTS), 'guest')).toBeDefined();
  });

  test('on an even Priest night the Guest is skipped and the Seer is called instead', () => {
    const calls = planNight(g, 2, facts({ prayed: true }));
    expect(call(calls, 'guest')).toBeUndefined();
    expect(call(calls, 'seer')).toMatchObject({ acting: [2] });
  });

  test('without the Guest, the Seer is called every night', () => {
    expect(call(planNight(gameOf(CORE), 2, NO_FACTS), 'seer')).toBeDefined();
  });
});

describe('Priest night', () => {
  const g = gameOf([
    'werewolf', 'dark_wolf', 'avenger_wolf', 'lonely_wolf', 'seer', 'witch', 'hero', 'thug', 'cat', 'forger', 'rat', 'villager',
  ]);
  const prepared = withPlayer(withPlayer(g, 2, { memory: { revengeNight: 3 } }), 8, { memory: { scratchNight: 3 } });
  const calls = planNight(prepared, 3, facts({ prayed: true }));

  test('killing roles and the Witch are skipped completely', () => {
    for (const id of ['witch', 'hero', 'thug', 'cat', 'avenger_wolf', 'lonely_wolf', 'swordHolder']) {
      expect(call(calls, id)).toBeUndefined();
    }
  });

  test('the wolves wake without a victim; the Dark Wolf, Seer and Rat still act', () => {
    expect(call(calls, 'pack')).toMatchObject({ restriction: 'noKill' });
    expect(call(calls, 'dark_wolf', 18)).toMatchObject({ acting: [1] });
    expect(call(calls, 'seer')).toBeDefined();
    expect(call(calls, 'rat')).toBeDefined();
  });

  test('on a normal night those killing roles are called', () => {
    const normal = planNight(prepared, 3, NO_FACTS);
    for (const id of ['witch', 'hero', 'thug', 'cat', 'avenger_wolf', 'lonely_wolf', 'swordHolder']) {
      expect(call(normal, id)).toBeDefined();
    }
  });
});

describe('blocked and jailed players are woken and shown crossed arms', () => {
  const g = gameOf(['werewolf', 'werewolf', 'devil_wolf', 'warden', 'seer', 'salvator', 'witch', 'villager']);

  test('a Devil Wolf block applies to later steps', () => {
    const calls = planNight(g, 2, facts({ devilBlocked: [4] }));
    expect(call(calls, 'seer')).toMatchObject({ acting: [], crossed: [4] });
  });

  test('the Devil Wolf blocking the Warden stops tonight\'s jail', () => {
    const calls = planNight(g, 2, facts({ devilBlocked: [3] }));
    expect(call(calls, 'warden')).toMatchObject({ acting: [], crossed: [3] });
  });

  test('a jailed wolf wakes with the pack but takes no part', () => {
    const calls = planNight(g, 2, facts({ jailed: 0 }));
    expect(call(calls, 'pack')).toMatchObject({ acting: [1, 2], crossed: [0] });
  });

  test('jail does not reach back to steps before the Warden', () => {
    const calls = planNight(g, 2, facts({ jailed: 2 }));
    expect(call(calls, 'devil_wolf', 2)).toMatchObject({ acting: [2] });
  });
});

describe('the night after the wolves ate the Diseased', () => {
  test('every wolf power is blocked, including infected players\' old abilities', () => {
    let g = gameOf(['werewolf', 'dark_wolf', 'devil_wolf', 'seer', 'witch', 'villager', 'villager', 'villager']);
    g = withPlayer(g, 3, { infected: true, team: 'werewolf' });
    const calls = planNight(g, 3, facts({ wolvesSick: true }));
    expect(call(calls, 'pack')).toMatchObject({ acting: [], crossed: expect.arrayContaining([0, 1, 2, 3]) });
    expect(call(calls, 'dark_wolf', 18)).toMatchObject({ acting: [], crossed: [1] });
    expect(call(calls, 'devil_wolf', 2)).toMatchObject({ acting: [], crossed: [2] });
    expect(call(calls, 'seer')).toMatchObject({ acting: [], crossed: [3] });
    expect(call(calls, 'witch')).toMatchObject({ acting: [4] });
  });
});

describe('special cases', () => {
  test('Triple Face: Seer slot on Night 1, Witch slot on Night 2, never after', () => {
    const g = gameOf([...CORE, 'triple_face']);
    expect(call(planNight(g, 1, NO_FACTS), 'triple_face')?.step).toBe(26);
    expect(call(planNight(g, 2, NO_FACTS), 'triple_face')?.step).toBe(25);
    expect(call(planNight(g, 3, NO_FACTS), 'triple_face')).toBeUndefined();
  });

  test('the Dream Wolf does not wake with the pack until awake', () => {
    const g = gameOf(['werewolf', 'dream_wolf', ...CORE.slice(2)]);
    expect(call(planNight(g, 2, NO_FACTS), 'pack')?.acting).toEqual([0]);
    const awake = withPlayer(kill(g, 0), 1, { memory: { awake: true } });
    expect(call(planNight(awake, 3, NO_FACTS), 'pack')?.acting).toEqual([1]);
  });

  test('the Lonely Wolf wakes with the pack, and alone on odd nights', () => {
    const g = gameOf(['werewolf', 'lonely_wolf', ...CORE.slice(2)]);
    expect(call(planNight(g, 1, NO_FACTS), 'pack')?.acting).toEqual([0, 1]);
    expect(call(planNight(g, 1, NO_FACTS), 'lonely_wolf')).toMatchObject({ step: 22, acting: [1] });
    expect(call(planNight(g, 2, NO_FACTS), 'lonely_wolf')).toBeUndefined();
  });

  test('the permanent Devil Wolf (S6) wakes alone only on Nights 1–3', () => {
    const g = gameOf(['werewolf', 'devil_wolf', ...CORE.slice(2)]);
    const permanent = { ...g, settings: { ...g.settings, devilWolf: 'permanent' as const } };
    expect(call(planNight(permanent, 3, NO_FACTS), 'devil_wolf', 2)).toBeDefined();
    expect(call(planNight(permanent, 4, NO_FACTS), 'devil_wolf', 2)).toBeUndefined();
    expect(call(planNight(g, 4, NO_FACTS), 'devil_wolf', 2)).toBeDefined();
  });

  test('the Cat and the Avenger Wolf are called only on their trigger night', () => {
    let g = gameOf(['werewolf', 'avenger_wolf', 'cat', ...CORE.slice(2)]);
    expect(call(planNight(g, 2, NO_FACTS), 'cat')).toBeUndefined();
    g = withPlayer(withPlayer(g, 2, { memory: { scratchNight: 2 } }), 1, { memory: { revengeNight: 2 } });
    expect(call(planNight(g, 2, NO_FACTS), 'cat')).toMatchObject({ acting: [2] });
    expect(call(planNight(g, 2, NO_FACTS), 'avenger_wolf')).toMatchObject({ acting: [1] });
  });

  test('an infected player is woken with the pack', () => {
    const g = withPlayer(gameOf(CORE), 6, { infected: true, team: 'werewolf' });
    expect(call(planNight(g, 2, NO_FACTS), 'pack')?.acting).toEqual([0, 1, 6]);
  });
});

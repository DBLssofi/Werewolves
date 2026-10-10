import { NO_FACTS, type NightCall } from '@/engine/night';
import type { GameState } from '@/engine/state';
import { execute, startDay } from '../day';
import { eliminate } from '../elimination';
import { applyNightAction, startNightRecord } from '../nightActions';
import { ghostsAtDawn, isGhostLetter, planNight, startOfNightTaps } from '../nightPlan';
import { gameOf, kill, withPlayer } from './fixtures';
import { deadSeats, playNight, refusal } from './helpers';

const call = (calls: NightCall[], id: string, step?: number) =>
  calls.find((c) => c.callId === id && (step === undefined || c.step === step));
const permanent = (g: GameState): GameState => ({ ...g, settings: { ...g.settings, devilWolf: 'permanent' } });

describe('Devil Wolf, permanent version (S6)', () => {
  const g = permanent(gameOf(['devil_wolf', 'werewolf', 'seer', 'witch', 'prince', 'hunter', 'villager', 'villager']));

  test('once, in Nights 1–3: the target loses every ability for good, and is blocked tonight', () => {
    const r = playNight(g, 1, [{ kind: 'devilBlock', seat: 0, target: 2 }]);
    expect(r.state.players[2]?.abilitiesRemoved).toBe(true);
    expect(r.record.facts.devilBlocked).toEqual([2]);
    expect(call(planNight(r.state, 2, NO_FACTS), 'seer')?.crossed).toEqual([2]);
    expect(refusal(r.state, { kind: 'devilBlock', seat: 0, target: 3 }, 2)).toBe('used');
    expect(refusal(g, { kind: 'devilBlock', seat: 0, target: 3 }, 4)).toBe('notTonight');
  });

  test('passive abilities go too: the Prince can then be killed, the Hunter has no shot', () => {
    const r = playNight(g, 1, [{ kind: 'devilBlock', seat: 0, target: 4 }]);
    expect(deadSeats(playNight(r.state, 2, [{ kind: 'packVictim', target: 4, infect: false }]))).toEqual([4]);
    const h = playNight(g, 1, [{ kind: 'devilBlock', seat: 0, target: 5 }]);
    expect(playNight(h.state, 2, [{ kind: 'packVictim', target: 5, infect: false }]).prompts).toEqual([]);
  });
});

describe('blocked players', () => {
  const g = gameOf(['devil_wolf', 'dark_wolf', 'seer', 'witch', 'warden', 'villager', 'villager', 'villager']);

  test('a Devil-blocked or jailed player cannot act', () => {
    expect(applyNightAction(g, startNightRecord(2, { ...NO_FACTS, devilBlocked: [2] }), { kind: 'seerCheck', seat: 2, target: 0 })).toBe('blocked');
    expect(applyNightAction(g, startNightRecord(2, { ...NO_FACTS, jailed: [2] }), { kind: 'seerCheck', seat: 2, target: 0 })).toBe('blocked');
    expect(applyNightAction(g, startNightRecord(2, { ...NO_FACTS, devilBlocked: [4] }), { kind: 'jail', seat: 4, target: 0 })).toBe('blocked');
  });

  test('the night after eating the Diseased, the wolves can do nothing', () => {
    const sick = startNightRecord(2, { ...NO_FACTS, wolvesSick: true });
    expect(applyNightAction(g, sick, { kind: 'paralyse', seat: 1, target: 2 })).toBe('blocked');
    expect(applyNightAction(g, sick, { kind: 'packVictim', target: 2, infect: false })).toBe('blocked');
  });
});

describe('the Wise', () => {
  const g = gameOf(['dark_wolf', 'mystic_wolf', 'wise', 'seer', 'hunter', 'witch', 'villager', 'villager']);

  test('killed by the wolves after his first life: every special wolf power is lost', () => {
    const lost = withPlayer(g, 2, { memory: { lifeUsed: true } });
    const r = playNight(lost, 2, [{ kind: 'packVictim', target: 2, infect: false }]);
    expect(r.state.packState['wolfPowersLost']).toBe(true);
    expect(call(planNight(r.state, 3, NO_FACTS), 'dark_wolf')?.crossed).toEqual([0]);
    expect(refusal(r.state, { kind: 'paralyse', seat: 0, target: 3 }, 3)).toBe('powersLost');
    expect(refusal(r.state, { kind: 'mysticCheck', seat: 1, target: 3 }, 3)).toBe('powersLost');
  });

  test('executed: every village-team player loses their ability for good', () => {
    const out = execute(startDay(g, 1), { kind: 'execute', seat: 2 });
    expect(out.state.players.filter((p) => p.alive && p.team === 'village').every((p) => p.abilitiesRemoved)).toBe(true);
    expect(out.state.players[0]?.abilitiesRemoved).toBe(false);
    // The Hunter has lost his shot.
    expect(execute(startDay(out.state, 2), { kind: 'execute', seat: 4 }).prompts).toEqual([]);
  });

  test('an infected Wise has lost his passive: executing him does nothing', () => {
    const inf = withPlayer(g, 2, { infected: true, team: 'werewolf', memory: { wisePassiveLost: true } });
    const out = execute(startDay(inf, 1), { kind: 'execute', seat: 2 });
    expect(out.state.players[3]?.abilitiesRemoved).toBe(false);
  });
});

describe('Shadow Wolf', () => {
  const g = gameOf(['shadow_wolf', 'alpha_wolf', 'dark_wolf', 'mystic_wolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);

  test('gains a fallen wolf’s power with the uses left, is tapped the next night', () => {
    const used = withPlayer(g, 1, { memory: { infectionsUsed: 1 } });
    const s = eliminate(startDay(used, 1), [{ seat: 1, cause: 'execution' }]).state;
    expect(s.players[0]?.memory).toMatchObject({ shadowPowers: 'alpha_wolf', infectionsUsed: 1 });
    expect(startOfNightTaps(s, 2)).toEqual([{ seat: 0, kind: 'shadowPower', powers: ['alpha_wolf'] }]);
    expect(refusal(s, { kind: 'packVictim', target: 6, infect: true }, 2)).toBe('used');
  });

  test('a gained infection works for the pack and is spent from the Shadow Wolf', () => {
    const s = eliminate(startDay(g, 1), [{ seat: 1, cause: 'execution' }]).state;
    const r = playNight(s, 2, [{ kind: 'packVictim', target: 6, infect: true }]);
    expect(r.record.pack?.by).toBe(0);
    expect(r.state.players[6]?.infected).toBe(true);
    expect(r.state.players[0]?.memory.infectionsUsed).toBe(1);
  });

  test('powers stack; gained paralysis and search are used at step 20', () => {
    let s = eliminate(startDay(g, 1), [{ seat: 2, cause: 'execution' }]).state;
    s = eliminate(startDay(s, 2), [{ seat: 3, cause: 'execution' }]).state;
    expect(s.players[0]?.memory.shadowPowers).toBe('dark_wolf,mystic_wolf');
    expect(call(planNight(s, 3, NO_FACTS), 'shadow_wolf', 20)?.acting).toEqual([0]);
    expect(refusal(s, { kind: 'paralyse', seat: 0, target: 4 }, 3)).toBe('ok');
    expect(refusal(s, { kind: 'mysticCheck', seat: 0, target: 4 }, 3)).toBe('ok');
  });

  test('a gained Devil Wolf block is used at step 2', () => {
    const d = gameOf(['shadow_wolf', 'devil_wolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']);
    const s = eliminate(startDay(d, 1), [{ seat: 1, cause: 'execution' }]).state;
    expect(call(planNight(s, 2, NO_FACTS), 'shadow_wolf', 2)?.acting).toEqual([0]);
  });

  test('a gained Sneaky Wolf hiding hides him from the Seer, until the Wise is eaten', () => {
    const d = gameOf(['shadow_wolf', 'sneaky_wolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']);
    const s = eliminate(startDay(d, 1), [{ seat: 1, cause: 'execution' }]).state;
    const check = (st: GameState) => applyNightAction(st, startNightRecord(2, NO_FACTS), { kind: 'seerCheck', seat: 2, target: 0 });
    expect(check(d)).toMatchObject({ answer: 'thumbDown' });
    expect(check(s)).toMatchObject({ answer: 'thumbUp' });
    expect(check({ ...s, packState: { ...s.packState, wolfPowersLost: true } })).toMatchObject({ answer: 'thumbDown' });
  });

  test('gains nothing from a plain Werewolf or an infected player', () => {
    const p = withPlayer(gameOf(['shadow_wolf', 'werewolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']), 2, {
      infected: true,
      team: 'werewolf',
    });
    const s = eliminate(p, [{ seat: 1, cause: 'execution' }, { seat: 2, cause: 'execution' }]).state;
    expect(s.players[0]?.memory.shadowPowers).toBeUndefined();
  });
});

describe('Avenger Wolf', () => {
  const g = gameOf(['avenger_wolf', 'werewolf', 'seer', 'witch', 'priest', 'puppeteer', 'villager', 'villager']);
  const poisoned = playNight(g, 1, [{ kind: 'poison', seat: 3, target: 1 }]);

  test('a poison that kills another wolf gives him guesses the next night', () => {
    expect(deadSeats(poisoned)).toEqual([1]);
    expect(poisoned.state.players[0]?.memory).toMatchObject({ revengeNight: 2, revengeOn: '3' });
    expect(call(planNight(poisoned.state, 2, NO_FACTS), 'avenger_wolf')?.acting).toEqual([0]);
  });

  test('two guesses, one at a time; a right guess kills the poisoner at dawn, unstoppable', () => {
    const r = playNight(poisoned.state, 2, [
      { kind: 'revengeGuess', seat: 0, target: 2 },
      { kind: 'revengeGuess', seat: 0, target: 3 },
    ]);
    expect(r.record.revengeGuesses.map((x) => x.right)).toEqual([false, true]);
    expect(deadSeats(r)).toEqual([3]);
    const three = playNight(poisoned.state, 2, [
      { kind: 'revengeGuess', seat: 0, target: 2 },
      { kind: 'revengeGuess', seat: 0, target: 6 },
    ]);
    expect(applyNightAction(three.state, three.record, { kind: 'revengeGuess', seat: 0, target: 3 })).toBe('used');
  });

  test('a Priest night delays the guesses one night', () => {
    const r = playNight(poisoned.state, 2, [{ kind: 'pray', seat: 4 }]);
    expect(r.state.players[0]?.memory.revengeNight).toBe(3);
    expect(call(planNight(r.state, 3, NO_FACTS), 'avenger_wolf')?.acting).toEqual([0]);
  });

  test('no guesses if the poisoner is already dead', () => {
    expect(call(planNight(kill(poisoned.state, 3), 2, NO_FACTS), 'avenger_wolf')).toBeUndefined();
  });

  test('a poison forced by the Puppeteer counts against the Witch', () => {
    const r = playNight(g, 1, [{ kind: 'puppet', seat: 5, mode: 'poison', target: 1 }]);
    expect(r.state.players[0]?.memory.revengeOn).toBe('3');
  });

  test('his own death by poison does not trigger it', () => {
    const r = playNight(g, 1, [{ kind: 'poison', seat: 3, target: 0 }]);
    expect(r.state.players[0]?.memory.revengeNight).toBeUndefined();
  });
});

describe('Ghost', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'ghost', 'villager', 'villager', 'villager']);

  test('whispers from the dawn after the elimination', () => {
    const r = playNight(g, 1, [{ kind: 'packVictim', target: 4, infect: false }]);
    expect(ghostsAtDawn(r.state, 1)).toEqual([]);
    expect(ghostsAtDawn(r.state, 2)).toEqual([4]);
    const day = eliminate(startDay(g, 2), [{ seat: 4, cause: 'execution' }]).state;
    expect(ghostsAtDawn(day, 3)).toEqual([4]);
  });

  test('not after a rule break', () => {
    const s = eliminate(startDay(g, 2), [{ seat: 4, cause: 'ruleBreak' }]).state;
    expect(ghostsAtDawn(s, 3)).toEqual([]);
  });

  test('one letter at a time', () => {
    expect(isGhostLetter('R')).toBe(true);
    expect(isGhostLetter('ع')).toBe(true);
    expect(isGhostLetter('RS')).toBe(false);
    expect(isGhostLetter(' ')).toBe(false);
  });
});

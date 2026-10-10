import { NO_FACTS } from '@/engine/night';
import { callSpec, toAction } from '../callForms';
import { applyNightAction, startNightRecord } from '../nightActions';
import { NIGHT_ORDER } from '../nightPlan';
import { gameOf } from './fixtures';

describe('call forms', () => {
  test('every call in the night order has a form or something to show', () => {
    for (const { callIds } of NIGHT_ORDER) {
      for (const id of callIds) {
        const spec = callSpec(id);
        expect(spec.forms.length + (spec.info ? 1 : 0)).toBeGreaterThan(0);
      }
    }
  });

  test('forms turn into actions the engine accepts', () => {
    const g = gameOf(['werewolf', 'alpha_wolf', 'seer', 'witch', 'salvator', 'cupid', 'troublemaker', 'forger', 'villager', 'villager']);
    const r = startNightRecord(1, NO_FACTS);
    const ok = (a: ReturnType<typeof toAction>) => expect(typeof applyNightAction(g, r, a)).toBe('object');
    ok(toAction('protect', 4, [8]));
    ok(toAction('seerCheck', 2, [0]));
    ok(toAction('bind', 5, [8, 9]));
    ok(toAction('swap', 6, [8, 9]));
    ok(toAction('forgeShield', 7, [8]));
    ok(toAction('packVictim', -1, [8]));
    ok(toAction('packInfect', -1, [8]));
  });

  test('the pack offers the infection only with an Alpha; Triple Face changes face by night', () => {
    const plain = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']);
    expect(callSpec('pack', { state: plain, night: 1, step: 16 }).forms.map((f) => f.id)).toEqual(['packVictim']);
    const tf = gameOf(['werewolf', 'werewolf', 'triple_face', 'witch', 'villager', 'villager', 'villager', 'villager']);
    expect(callSpec('triple_face', { state: tf, night: 1, step: 26 }).forms.map((f) => f.id)).toEqual(['seerCheck']);
    expect(callSpec('triple_face', { state: tf, night: 2, step: 25 }).forms.map((f) => f.id)).toEqual(['heal', 'poison']);
  });

  test('the Shadow Wolf is offered only the powers he gained, each in its own slot', () => {
    const g = gameOf(['shadow_wolf', 'werewolf', 'seer', 'witch', 'villager', 'villager', 'villager', 'villager']);
    const s = { ...g, players: g.players.map((p) => (p.seat === 0 ? { ...p, memory: { shadowPowers: 'devil_wolf,dark_wolf' } } : p)) };
    expect(callSpec('shadow_wolf', { state: s, night: 2, step: 2, seat: 0 }).forms.map((f) => f.id)).toEqual(['devilBlock']);
    expect(callSpec('shadow_wolf', { state: s, night: 2, step: 20, seat: 0 }).forms.map((f) => f.id)).toEqual(['paralyse']);
  });
});

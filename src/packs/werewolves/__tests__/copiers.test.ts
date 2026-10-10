import { NO_FACTS, type NightCall } from '@/engine/night';
import type { GameState } from '@/engine/state';
import { execute, startDay } from '../day';
import { eliminate } from '../elimination';
import { applyNightAction, foolOffer, startNightRecord, type ActionOk, type NightAction } from '../nightActions';
import { planNight, startOfNightTaps } from '../nightPlan';
import { getRole } from '../roles';
import { gameOf, kill, withPlayer } from './fixtures';
import { act, deadSeats, playNight, refusal } from './helpers';

const call = (calls: NightCall[], id: string) => calls.find((c) => c.callId === id);

/** Apply one action at night n and return the result (fails the test if refused). */
function one(state: GameState, action: NightAction, night = 1): ActionOk {
  const out = applyNightAction({ ...state, phase: { kind: 'night', night } }, startNightRecord(night, NO_FACTS), action);
  if (typeof out === 'string') throw new Error(`${action.kind} refused: ${out}`);
  return out;
}

describe('Robber', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'robber', 'minion', 'angel', 'villager', 'musketeer', 'prince']);

  test('steals a village role with an ability; the victim becomes a plain Villager', () => {
    const r = one(g, { kind: 'steal', seat: 4, target: 2 });
    expect(r.state.players[4]?.roleId).toBe('seer');
    expect(r.state.players[2]?.roleId).toBe('villager');
    expect(r.shownRole).toBe('seer');
    expect(r.tapped).toBe(2);
  });

  test('keeps only the uses left', () => {
    const used = withPlayer(g, 3, { memory: { healUsed: true } });
    const r = one(used, { kind: 'steal', seat: 4, target: 3 }, 2);
    expect(r.state.players[4]?.memory).toMatchObject({ healUsed: true });
    expect(r.state.players[4]?.memory.poisonUsed).toBeUndefined();
  });

  test('fails on a wolf, Minion, Neutral, infected player or plain Villager, and the attempt is not spent', () => {
    for (const target of [0, 5, 6, 7]) {
      const r = one(g, { kind: 'steal', seat: 4, target });
      expect(r.failed).toBe(true);
      expect(r.state.players[4]?.roleId).toBe('robber');
    }
    const infected = withPlayer(g, 2, { infected: true, team: 'werewolf' });
    expect(one(infected, { kind: 'steal', seat: 4, target: 2 }).failed).toBe(true);
    expect(refusal(g, { kind: 'steal', seat: 4, target: 2 }, 4)).toBe('notTonight');
  });

  test('the stolen role works from the next night; the Robber is still woken (crossed arms) through Night 3', () => {
    const s = one(g, { kind: 'steal', seat: 4, target: 2 }).state;
    expect(call(planNight(s, 1, NO_FACTS), 'seer')).toBeUndefined();
    expect(refusal(s, { kind: 'seerCheck', seat: 4, target: 0 }, 1)).toBe('notTonight');
    expect(call(planNight(s, 2, NO_FACTS), 'seer')?.acting).toEqual([4]);
    expect(call(planNight(s, 2, NO_FACTS), 'robber')?.crossed).toEqual([4]);
  });

  test('links go with the role: a stolen Musketeer is shown the Prince', () => {
    expect(one(g, { kind: 'steal', seat: 4, target: 8 }).linked).toEqual([9]);
  });
});

describe('Faceless Villager', () => {
  const g = gameOf(['alpha_wolf', 'werewolf', 'seer', 'witch', 'faceless_villager', 'minion', 'angel', 'villager']);

  test('copies a village role with fresh uses; the original keeps theirs', () => {
    const used = withPlayer(g, 3, { memory: { healUsed: true } });
    const r = one(used, { kind: 'takeFace', seat: 4, target: 3 });
    expect(r.state.players[4]?.roleId).toBe('witch');
    expect(r.state.players[4]?.memory.healUsed).toBeUndefined();
    expect(r.state.players[3]?.roleId).toBe('witch');
  });

  test('copying a wolf makes a plain Werewolf who joins the pack the next night and is a wolf to the Seer', () => {
    const s = one(g, { kind: 'takeFace', seat: 4, target: 0 }).state;
    expect(s.players[4]).toMatchObject({ roleId: 'werewolf', team: 'werewolf' });
    expect(call(planNight(s, 1, NO_FACTS), 'pack')?.acting).toEqual([0, 1]);
    expect(call(planNight(s, 2, NO_FACTS), 'pack')?.acting).toEqual([0, 1, 4]);
    expect(one(s, { kind: 'seerCheck', seat: 2, target: 4 }, 2).answer).toBe('thumbDown');
  });

  test('copying the Minion: on the werewolf team and shown the wolves', () => {
    const r = one(g, { kind: 'takeFace', seat: 4, target: 5 });
    expect(r.state.players[4]).toMatchObject({ roleId: 'minion', team: 'werewolf' });
    expect(r.linked).toEqual([0, 1]);
  });

  test('copying a Neutral fails and is used up: a plain Villager', () => {
    const r = one(g, { kind: 'takeFace', seat: 4, target: 6 });
    expect(r.failed).toBe(true);
    expect(r.state.players[4]?.roleId).toBe('villager');
    expect(call(planNight(r.state, 2, NO_FACTS), 'faceless_villager')?.crossed).toEqual([4]);
  });
});

describe('The Lady', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'lady', 'hunter', 'villager', 'villager']);
  const married = one(g, { kind: 'marry', seat: 4, target: 5 }).state;

  test('marries once, in the first 3 nights, not herself', () => {
    expect(refusal(married, { kind: 'marry', seat: 4, target: 6 }, 2)).toBe('used');
    expect(refusal(g, { kind: 'marry', seat: 4, target: 4 })).toBe('notSelf');
    expect(refusal(g, { kind: 'marry', seat: 4, target: 5 }, 4)).toBe('notTonight');
  });

  test('inherits her husband’s role when he is eliminated, fresh, and is tapped the next night', () => {
    const r = playNight(married, 2, [{ kind: 'packVictim', target: 5, infect: false }]);
    expect(r.state.players[4]?.roleId).toBe('hunter');
    expect(startOfNightTaps(r.state, 3)).toEqual([{ seat: 4, kind: 'newRole', roleId: 'hunter', linked: [] }]);
  });

  test('a rule-break elimination counts too', () => {
    const s = eliminate(startDay(married, 1), [{ seat: 5, cause: 'ruleBreak' }]).state;
    expect(s.players[4]?.roleId).toBe('hunter');
  });

  test('an infected husband: his role without the infection; a wolf card: she becomes that wolf', () => {
    const inf = withPlayer(married, 5, { infected: true, team: 'werewolf' });
    expect(eliminate(inf, [{ seat: 5, cause: 'execution' }]).state.players[4]).toMatchObject({ roleId: 'hunter', team: 'village', infected: false });
    const wolf = one(g, { kind: 'marry', seat: 4, target: 0 }).state;
    expect(eliminate(wolf, [{ seat: 0, cause: 'execution' }]).state.players[4]).toMatchObject({ roleId: 'werewolf', team: 'werewolf' });
  });

  test('never the bonds: a Lover husband’s partner is not hers', () => {
    const lovers = withPlayer(withPlayer(married, 5, { loverSeat: 6 }), 6, { loverSeat: 5 });
    const s = eliminate(lovers, [{ seat: 5, cause: 'execution' }]).state;
    expect(s.players[4]?.loverSeat).toBeNull();
  });

  test('if she dies first, nothing', () => {
    const s = eliminate(kill(married, 4), [{ seat: 5, cause: 'execution' }]).state;
    expect(s.players[4]?.roleId).toBe('lady');
  });
});

describe('The Fool', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'fool', 'villager', 'villager', 'villager']);

  test('is offered 3 village roles with an ability, not dealt, needing no partner card', () => {
    const offer = foolOffer(g, 4);
    expect(offer).toHaveLength(3);
    for (const id of offer) {
      const r = getRole(id);
      expect(r.team).toBe('village');
      expect(r.seenAs.auraAbility).toBe(true);
      expect(['seer', 'witch', 'musketeer', 'bodyguard', 'apprentice_seer', 'beholder', 'doctor', 'mason']).not.toContain(id);
    }
    expect(foolOffer(g, 4)).toEqual(offer);
  });

  test('picks one of them by Night 3; it works from the next night', () => {
    const [pick] = foolOffer(g, 4) as [string];
    expect(refusal(g, { kind: 'foolChoose', seat: 4, roleId: 'seer' }, 2)).toBe('notOffered');
    expect(refusal(g, { kind: 'foolChoose', seat: 4, roleId: pick }, 4)).toBe('notTonight');
    const s = one(g, { kind: 'foolChoose', seat: 4, roleId: pick }, 2).state;
    expect(s.players[4]).toMatchObject({ roleId: pick, memory: { roleFromNight: 3 } });
  });
});

describe('Drunk', () => {
  const g = startDay(gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'drunk', 'hunter', 'villager', 'villager']), 1);

  test('sobers up at the first village-team elimination and takes that role, fresh', () => {
    const s = execute(g, { kind: 'execute', seat: 5 }).state;
    expect(s.players[4]?.roleId).toBe('hunter');
    expect(startOfNightTaps(s, 2)).toEqual([{ seat: 4, kind: 'newRole', roleId: 'hunter', linked: [] }]);
  });

  test('if a plain Villager falls first, he stays plain all game', () => {
    const s1 = execute(g, { kind: 'execute', seat: 6 }).state;
    expect(s1.players[4]?.roleId).toBe('drunk');
    const s2 = execute(startDay(s1, 2), { kind: 'execute', seat: 5 }).state;
    expect(s2.players[4]?.roleId).toBe('drunk');
  });

  test('a wolf or an infected player does not count', () => {
    const s1 = execute(g, { kind: 'execute', seat: 0 }).state;
    const inf = withPlayer(s1, 2, { infected: true, team: 'werewolf' });
    const s2 = execute(startDay(inf, 2), { kind: 'execute', seat: 2 }).state;
    expect(s2.players[4]?.roleId).toBe('drunk');
    const s3 = execute(startDay(s2, 3), { kind: 'execute', seat: 3 }).state;
    expect(s3.players[4]?.roleId).toBe('witch');
  });
});

describe('Doppelganger', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'doppelganger', 'salvator', 'priest', 'warden', 'villager', 'villager']);

  test('acts only on even nights; called every night', () => {
    expect(refusal(g, { kind: 'mirror', seat: 4, target: 5 }, 1)).toBe('notTonight');
    expect(call(planNight(g, 1, NO_FACTS), 'doppelganger')?.crossed).toEqual([4]);
    expect(call(planNight(g, 2, NO_FACTS), 'doppelganger')?.acting).toEqual([4]);
  });

  test('copies a role for tonight and is called again in its slot, with his own "not twice in a row" record', () => {
    const r = one(g, { kind: 'mirror', seat: 4, target: 5 }, 2);
    expect(r.shownRole).toBe('salvator');
    expect(call(planNight(r.state, 2, NO_FACTS), 'salvator')?.acting).toEqual([4, 5]);
    expect(call(planNight(r.state, 3, NO_FACTS), 'salvator')?.acting).toEqual([5]);
    const night = act({ ...r.state, phase: { kind: 'night', night: 2 } }, startNightRecord(2, NO_FACTS), [
      { kind: 'protect', seat: 5, target: 8 },
      { kind: 'protect', seat: 4, target: 9 },
    ]);
    expect(night.record.protect).toEqual([8, 9]);
  });

  test('both protections hold at dawn', () => {
    const r = one(g, { kind: 'mirror', seat: 4, target: 5 }, 2);
    const dawn = playNight(r.state, 2, [
      { kind: 'protect', seat: 5, target: 8 },
      { kind: 'protect', seat: 4, target: 9 },
      { kind: 'packVictim', target: 8, infect: false },
      { kind: 'poison', seat: 3, target: 9 },
    ]);
    expect(deadSeats(dawn)).toEqual([]);
  });

  test('nothing happens on a wolf, a role with no night ability, or the Priest', () => {
    for (const target of [0, 8, 6]) expect(one(g, { kind: 'mirror', seat: 4, target }, 2).failed).toBe(true);
  });

  test('the Seer cannot be copied when the Guest is in the game', () => {
    const withGuest = gameOf(['werewolf', 'werewolf', 'seer', 'guest', 'doppelganger', 'villager', 'villager', 'villager']);
    expect(one(withGuest, { kind: 'mirror', seat: 4, target: 2 }, 2).failed).toBe(true);
    expect(one(gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'doppelganger', 'villager', 'villager', 'villager']), { kind: 'mirror', seat: 4, target: 2 }, 2).failed).toBeUndefined();
  });

  test('a copied Witch has one potion of his own; the real Witch’s potions are untouched', () => {
    const s = one(g, { kind: 'mirror', seat: 4, target: 3 }, 2).state;
    const n = act({ ...s, phase: { kind: 'night', night: 2 } }, startNightRecord(2, NO_FACTS), [
      { kind: 'packVictim', target: 8, infect: false },
      { kind: 'heal', seat: 4, target: 8 },
    ]);
    expect(applyNightAction(n.state, n.record, { kind: 'poison', seat: 4, target: 0 })).toBe('onePotionPerNight');
    expect(n.state.players[3]?.memory.healUsed).toBeUndefined();
  });

  test('a copied Warden jails right after choosing; both jails hold', () => {
    const s = one(g, { kind: 'mirror', seat: 4, target: 7 }, 2).state;
    const n = act({ ...s, phase: { kind: 'night', night: 2 } }, startNightRecord(2, NO_FACTS), [
      { kind: 'jail', seat: 7, target: 2 },
      { kind: 'jail', seat: 4, target: 3 },
    ]);
    expect(n.record.facts.jailed).toEqual([2, 3]);
  });

  test('the copied role starts fresh each time', () => {
    const s = one(g, { kind: 'mirror', seat: 4, target: 3 }, 2).state;
    const used = withPlayer(s, 4, { memory: { ...s.players[4]?.memory, poisonUsed: true } });
    const again = one(used, { kind: 'mirror', seat: 4, target: 3 }, 4).state;
    expect(again.players[4]?.memory.poisonUsed).toBeUndefined();
  });
});

describe('Puppeteer', () => {
  const g = gameOf(['werewolf', 'werewolf', 'seer', 'witch', 'puppeteer', 'villager', 'villager', 'villager']);

  test('sight: the Seer must check the Puppeteer’s target tonight', () => {
    const n = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [
      { kind: 'puppet', seat: 4, mode: 'sight', target: 0 },
    ]);
    expect(applyNightAction(n.state, n.record, { kind: 'seerCheck', seat: 2, target: 5 })).toBe('controlled');
    expect(applyNightAction(n.state, n.record, { kind: 'seerCheck', seat: 2, target: 0 })).toMatchObject({ answer: 'thumbDown' });
    expect(n.state.players[4]?.memory.used).toBe(true);
  });

  test('poison: the Witch’s poison is spent on his target and she cannot heal tonight', () => {
    const r = playNight(g, 1, [
      { kind: 'puppet', seat: 4, mode: 'poison', target: 0 },
      { kind: 'packVictim', target: 6, infect: false },
    ]);
    expect(deadSeats(r)).toEqual([0, 6]);
    expect(r.state.players[3]?.memory.poisonUsed).toBe(true);
    const n = act({ ...g, phase: { kind: 'night', night: 1 } }, startNightRecord(1, NO_FACTS), [
      { kind: 'puppet', seat: 4, mode: 'poison', target: 0 },
      { kind: 'packVictim', target: 6, infect: false },
    ]);
    expect(applyNightAction(n.state, n.record, { kind: 'heal', seat: 3, target: 6 })).toBe('onePotionPerNight');
  });

  test('fails, not spent, if the role is dead, blocked, out of poison or not acting tonight', () => {
    expect(one(kill(g, 3), { kind: 'puppet', seat: 4, mode: 'poison', target: 0 }).failed).toBe(true);
    expect(one(withPlayer(g, 3, { memory: { poisonUsed: true } }), { kind: 'puppet', seat: 4, mode: 'poison', target: 0 }).failed).toBe(true);
    const jailed = applyNightAction(g, startNightRecord(1, { ...NO_FACTS, jailed: [2] }), { kind: 'puppet', seat: 4, mode: 'sight', target: 0 });
    expect(jailed).toMatchObject({ failed: true });
    const prayed = applyNightAction(g, startNightRecord(2, { ...NO_FACTS, prayed: true }), { kind: 'puppet', seat: 4, mode: 'poison', target: 0 });
    expect(prayed).toMatchObject({ failed: true });
    const failed = one(kill(g, 3), { kind: 'puppet', seat: 4, mode: 'poison', target: 0 });
    expect(failed.state.players[4]?.memory.used).toBeUndefined();
  });
});

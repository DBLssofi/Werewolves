import { classicRoles } from '@/packs/werewolves/classic';
import { getRole } from '@/packs/werewolves/roles';
import { confirmCard, createGame, isDealComplete, nextSeat, peekCard, reviewRole, startDeal, type Deal } from '../deal';
import { isWolf, neighbours } from '../state';
import { DEFAULT_SETTINGS } from '../types';

function must(d: Deal | string): Deal {
  if (typeof d === 'string') throw new Error(d);
  return d;
}

/** Deal every card to players named P0, P1, … taking the first free card each time. */
function dealAll(n: number, seed = 1): Deal {
  let deal = startDeal(classicRoles(n), seed);
  for (let i = 0; i < n; i++) {
    const free = deal.taken.indexOf(false);
    deal = must(confirmCard(deal, free, `P${i}`));
  }
  return deal;
}

describe('pass-the-phone deal', () => {
  test('starts with one face-down card per player, none taken', () => {
    const deal = startDeal(classicRoles(10), 5);
    expect(deal.cards).toHaveLength(10);
    expect(deal.taken.every((t) => !t)).toBe(true);
    expect(nextSeat(deal)).toBe(0);
  });

  test('the same seed lays out the same cards', () => {
    expect(startDeal(classicRoles(12), 9).cards).toEqual(startDeal(classicRoles(12), 9).cards);
  });

  test('each confirmed player takes the next seat and the chosen card', () => {
    let deal = startDeal(classicRoles(8), 3);
    const role = peekCard(deal, 4);
    deal = must(confirmCard(deal, 4, '  Sofi '));
    expect(deal.entries[0]).toEqual({ name: 'Sofi', roleId: role });
    expect(deal.taken[4]).toBe(true);
    expect(nextSeat(deal)).toBe(1);
  });

  test('a taken card cannot be picked again', () => {
    const deal = must(confirmCard(startDeal(classicRoles(8), 3), 0, 'A'));
    expect(peekCard(deal, 0)).toBe('cardTaken');
    expect(confirmCard(deal, 0, 'B')).toBe('cardTaken');
  });

  test('names must not be empty or repeated (case-insensitive)', () => {
    const deal = must(confirmCard(startDeal(classicRoles(8), 3), 0, 'Badi'));
    expect(confirmCard(deal, 1, '   ')).toBe('emptyName');
    expect(confirmCard(deal, 1, 'badi')).toBe('nameInUse');
  });

  test('card indexes outside the deck are rejected', () => {
    const deal = startDeal(classicRoles(8), 3);
    expect(peekCard(deal, -1)).toBe('noSuchCard');
    expect(confirmCard(deal, 8, 'X')).toBe('noSuchCard');
  });

  test('review mode shows a seated player their role again', () => {
    const deal = dealAll(9);
    expect(reviewRole(deal, 3)).toBe(deal.entries[3]?.roleId);
    expect(reviewRole(deal, 20)).toBeNull();
  });

  test('no more cards can be confirmed once everyone has one', () => {
    const deal = dealAll(8);
    expect(isDealComplete(deal)).toBe(true);
    expect(confirmCard(deal, 0, 'Late')).toBe('dealFinished');
  });
});

describe('createGame', () => {
  test('builds players in seat order with their dealt roles, starting at Night 1', () => {
    const deal = dealAll(10, 4);
    const game = createGame(deal, DEFAULT_SETTINGS, 'werewolves', getRole);
    expect(game.players.map((p) => p.name)).toEqual(deal.entries.map((e) => e.name));
    expect(game.players.map((p) => p.roleId)).toEqual(deal.entries.map((e) => e.roleId));
    expect(game.players.every((p) => p.alive && p.startRoleId === p.roleId)).toBe(true);
    expect(game.phase).toEqual({ kind: 'night', night: 1 });
    expect(game.mayorSeat).toBeNull();
  });

  test('players start on their card team; wolves are recognised', () => {
    const game = createGame(dealAll(12, 2), DEFAULT_SETTINGS, 'werewolves', getRole);
    for (const p of game.players) {
      expect(p.team).toBe(getRole(p.roleId).team);
      expect(isWolf(p, getRole)).toBe(getRole(p.roleId).wolfCard);
    }
    expect(game.players.filter((p) => isWolf(p, getRole))).toHaveLength(3);
  });

  test('an unfinished deal cannot start a game', () => {
    expect(() => createGame(startDeal(classicRoles(8), 1), DEFAULT_SETTINGS, 'werewolves', getRole)).toThrow();
  });
});

describe('neighbours (nearest living players, dead seats skipped)', () => {
  const game = createGame(dealAll(8), DEFAULT_SETTINGS, 'werewolves', getRole);

  test('seat 0 sits between seats 7 and 1', () => {
    expect(neighbours(game, 0)).toEqual({ left: 7, right: 1 });
  });

  test('dead seats are skipped', () => {
    const g = { ...game, players: game.players.map((p) => (p.seat === 1 || p.seat === 7 ? { ...p, alive: false } : p)) };
    expect(neighbours(g, 0)).toEqual({ left: 6, right: 2 });
  });

  test('with one other living player, both sides are that player', () => {
    const g = { ...game, players: game.players.map((p) => ({ ...p, alive: p.seat === 0 || p.seat === 5 })) };
    expect(neighbours(g, 0)).toEqual({ left: 5, right: 5 });
  });
});

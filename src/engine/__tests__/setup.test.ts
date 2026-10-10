import { getRole, ROLES } from '@/packs/werewolves/roles';
import { classicRoles } from '@/packs/werewolves/classic';
import {
  balanceTotals,
  buildDeck,
  createRng,
  shuffle,
  suggestedWolves,
  validateSetup,
} from '../setup';
import type { RoleCount } from '../types';

const lookup = (id: string) => ROLES.find((r) => r.id === id);
const total = (roles: RoleCount[]) => roles.reduce((s, r) => s + r.count, 0);

describe('suggested wolves (players ÷ 4, rounded down)', () => {
  test.each([
    [8, 2], [11, 2], [12, 3], [15, 3], [16, 4], [27, 6], [31, 7], [48, 12], [50, 12],
  ])('%i players → %i wolves', (players, wolves) => {
    expect(suggestedWolves(players)).toBe(wolves);
  });
});

describe('validateSetup', () => {
  test('a valid Classic setup has no problems', () => {
    expect(validateSetup(10, classicRoles(10), lookup)).toEqual([]);
  });

  test('player count must be 8–50', () => {
    const p7 = validateSetup(7, [{ roleId: 'villager', count: 7 }], lookup);
    expect(p7).toContainEqual({ kind: 'playerCount', playerCount: 7 });
    const p51 = validateSetup(51, [{ roleId: 'villager', count: 51 }], lookup);
    expect(p51).toContainEqual({ kind: 'playerCount', playerCount: 51 });
  });

  test('the number of cards must equal the number of players', () => {
    const roles = [{ roleId: 'werewolf', count: 2 }, { roleId: 'villager', count: 5 }];
    expect(validateSetup(8, roles, lookup)).toContainEqual({ kind: 'cardCount', cards: 7, players: 8 });
  });

  test('unique roles can appear only once', () => {
    const roles = [{ roleId: 'werewolf', count: 2 }, { roleId: 'seer', count: 2 }, { roleId: 'villager', count: 4 }];
    expect(validateSetup(8, roles, lookup)).toContainEqual({ kind: 'tooManyCopies', roleId: 'seer', count: 2, allowed: 1 });
  });

  test('Masons come in 2 or more', () => {
    const roles = [{ roleId: 'werewolf', count: 2 }, { roleId: 'mason', count: 1 }, { roleId: 'villager', count: 5 }];
    expect(validateSetup(8, roles, lookup)).toContainEqual({ kind: 'tooFewCopies', roleId: 'mason', count: 1, minimum: 2 });
  });

  test.each([
    ['beholder', 'seer'],
    ['musketeer', 'prince'],
    ['bodyguard', 'prince'],
    ['doctor', 'rat'],
  ])('setup ban: %s cannot be dealt without the %s', (role, partner) => {
    const roles = [{ roleId: 'werewolf', count: 2 }, { roleId: role, count: 1 }, { roleId: 'villager', count: 5 }];
    expect(validateSetup(8, roles, lookup)).toContainEqual({ kind: 'missingPartner', roleId: role, requires: partner });
    const withPartner = [...roles.slice(0, 2), { roleId: partner, count: 1 }, { roleId: 'villager', count: 4 }];
    expect(validateSetup(8, withPartner, lookup)).toEqual([]);
  });

  test('unknown role IDs are reported', () => {
    const roles = [{ roleId: 'vampire', count: 1 }, { roleId: 'villager', count: 7 }];
    expect(validateSetup(8, roles, lookup)).toContainEqual({ kind: 'unknownRole', roleId: 'vampire' });
  });
});

describe('Classic mode', () => {
  test.each(Array.from({ length: 43 }, (_, i) => i + 8))('%i players: valid, right card count and wolf count', (n) => {
    const roles = classicRoles(n);
    expect(total(roles)).toBe(n);
    expect(validateSetup(n, roles, lookup)).toEqual([]);
    const wolves = roles
      .filter((r) => getRole(r.roleId).wolfCard)
      .reduce((s, r) => s + r.count, 0);
    expect(wolves).toBe(suggestedWolves(n));
  });

  test('below 12 players only plain Werewolves; from 12, Alpha and Dark Wolf join', () => {
    expect(classicRoles(11).map((r) => r.roleId)).not.toContain('alpha_wolf');
    const twelve = classicRoles(12).map((r) => r.roleId);
    expect(twelve).toContain('alpha_wolf');
    expect(twelve).toContain('dark_wolf');
  });

  test('rejects player counts outside 8–50', () => {
    expect(() => classicRoles(7)).toThrow();
    expect(() => classicRoles(51)).toThrow();
  });
});

describe('balance totals', () => {
  test('8-player Classic: 2 Werewolves (−12) + Seer 7, Witch 4, Salvator 3, Hunter 3 + 2 Villagers = +7', () => {
    expect(balanceTotals(classicRoles(8), lookup)).toEqual({ balance: 7, disruption: 0 });
  });
  test('neutral cards add to disruption, not to balance', () => {
    const roles = [{ roleId: 'rat', count: 1 }, { roleId: 'doctor', count: 1 }];
    expect(balanceTotals(roles, lookup)).toEqual({ balance: 2, disruption: 4 });
  });
});

describe('random deal', () => {
  test('the same seed gives the same shuffle', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(42));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(42));
    expect(a).toEqual(b);
  });

  test('a deck holds exactly the chosen cards', () => {
    const roles = classicRoles(9);
    const deck = buildDeck(roles, createRng(7));
    expect(deck).toHaveLength(9);
    for (const { roleId, count } of roles) {
      expect(deck.filter((d) => d === roleId)).toHaveLength(count);
    }
  });

  test('random numbers stay in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
});

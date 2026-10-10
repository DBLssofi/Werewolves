import { ROLES, getRole } from '../roles';

const ids = ROLES.map((r) => r.id);

describe('Werewolves role definitions', () => {
  test('there are exactly 64 roles with unique IDs', () => {
    expect(ROLES).toHaveLength(64);
    expect(new Set(ids).size).toBe(64);
  });

  test('team sizes match the Role Compendium: 47 village, 11 werewolf team, 6 neutral', () => {
    const count = (team: string) => ROLES.filter((r) => r.team === team).length;
    expect(count('village')).toBe(47);
    expect(count('werewolf')).toBe(11);
    expect(count('neutral')).toBe(6);
  });

  test('setup bans: Beholder needs the Seer, Musketeer and Bodyguard need the Prince, Doctor needs the Rat', () => {
    expect(getRole('beholder').requires).toEqual(['seer']);
    expect(getRole('musketeer').requires).toEqual(['prince']);
    expect(getRole('bodyguard').requires).toEqual(['prince']);
    expect(getRole('doctor').requires).toEqual(['rat']);
    const withBans = ROLES.filter((r) => r.requires).map((r) => r.id).sort();
    expect(withBans).toEqual(['beholder', 'bodyguard', 'doctor', 'musketeer']);
  });

  test('every required partner is a real role', () => {
    for (const r of ROLES) for (const p of r.requires ?? []) expect(ids).toContain(p);
  });

  test('only Villager, Werewolf and Mason allow unlimited copies; Mason needs at least 2', () => {
    const unlimited = ROLES.filter((r) => r.copies === 'unlimited').map((r) => r.id).sort();
    expect(unlimited).toEqual(['mason', 'villager', 'werewolf']);
    expect(getRole('mason').minCopies).toBe(2);
  });

  test('night steps are within the master night order (0–40)', () => {
    for (const r of ROLES) for (const s of r.nightSteps) expect(s >= 0 && s <= 40).toBe(true);
  });

  test('start of the night: Priest (1), then Devil Wolf (2), then Warden (3)', () => {
    expect(getRole('priest').nightSteps).toEqual([1]);
    expect(getRole('devil_wolf').nightSteps[0]).toBe(2);
    expect(getRole('warden').nightSteps).toEqual([3]);
  });

  test('neutral cards score disruption, all others score balance', () => {
    for (const r of ROLES) expect(r.scoreKind).toBe(r.team === 'neutral' ? 'disruption' : 'balance');
  });

  test('every werewolf card except the Dream Wolf wakes with the pack; the Minion does not', () => {
    for (const r of ROLES.filter((x) => x.wolfCard && x.team === 'werewolf')) {
      expect(r.wakesWithPack).toBe(r.id !== 'dream_wolf');
    }
    expect(getRole('minion').wakesWithPack).toBe(false);
    expect(getRole('minion').wolfCard).toBe(false);
    expect(getRole('lonely_wolf').wakesWithPack).toBe(true);
  });

  describe('what the checks see (Narrator Guide, section 6)', () => {
    test('Sneaky Wolf: not a wolf to the Seer, a wolf to the P.I. and Bear', () => {
      expect(getRole('sneaky_wolf').seenAs).toEqual({ seer: 'notWolf', wolfCheck: 'wolf', auraAbility: true });
    });
    test('Lycan: a wolf to every wolf check, no ability, but not a wolf card', () => {
      expect(getRole('lycan').seenAs).toEqual({ seer: 'wolf', wolfCheck: 'wolf', auraAbility: false });
      expect(getRole('lycan').wolfCard).toBe(false);
    });
    test('Minion: not a wolf to any check, no ability', () => {
      expect(getRole('minion').seenAs).toEqual({ seer: 'notWolf', wolfCheck: 'notWolf', auraAbility: false });
    });
    test('Lonely Wolf: a wolf card on the Neutral team, a wolf to every check', () => {
      const r = getRole('lonely_wolf');
      expect(r.team).toBe('neutral');
      expect(r.wolfCard).toBe(true);
      expect(r.seenAs.seer).toBe('wolf');
    });
    test('no ability for the Aura Seer: exactly the roles listed in the Role Compendium', () => {
      const noAbility = ROLES.filter((r) => !r.seenAs.auraAbility).map((r) => r.id).sort();
      expect(noAbility).toEqual(
        [
          'angel', 'beholder', 'cursed', 'dream_wolf', 'drunk', 'faceless_villager', 'fool', 'lady',
          'lycan', 'mason', 'minion', 'parrot_wolf', 'robber', 'villager', 'werewolf',
        ].sort(),
      );
    });
  });

  test('killing abilities for the parity check', () => {
    const yes = ROLES.filter((r) => r.killing === 'yes').map((r) => r.id).sort();
    expect(yes).toEqual(['dictator', 'hero', 'hunter', 'triple_face', 'witch', 'witcher']);
    const conditional = ROLES.filter((r) => r.killing === 'conditional').map((r) => r.id).sort();
    expect(conditional).toEqual(['cat', 'thug']);
  });

  test('getRole throws for an unknown ID', () => {
    expect(() => getRole('vampire')).toThrow('Unknown role id: vampire');
  });
});

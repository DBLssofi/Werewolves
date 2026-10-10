/**
 * The 64 Werewolves role definitions.
 * Source of truth: the Role Compendium and the Narrator Guide (night order, section 3).
 * Scores are provisional until playtested.
 */
import type { RoleDefinition, SeenAs, WakeSchedule } from '@/engine/types';

const EVERY: WakeSchedule = { kind: 'every' };
const NEVER: WakeSchedule = { kind: 'never' };
const NIGHT_1: WakeSchedule = { kind: 'nights', nights: [1] };
const NIGHTS_1_TO_3: WakeSchedule = { kind: 'range', from: 1, to: 3 };
const TRIGGERED: WakeSchedule = { kind: 'triggered' };

/** Not a wolf to any check, has an ability. Most village roles. */
const VILLAGE_ABILITY: SeenAs = { seer: 'notWolf', wolfCheck: 'notWolf', auraAbility: true };
/** Not a wolf to any check, no ability. */
const VILLAGE_PLAIN: SeenAs = { seer: 'notWolf', wolfCheck: 'notWolf', auraAbility: false };
/** A wolf to every check, with an ability. */
const WOLF_ABILITY: SeenAs = { seer: 'wolf', wolfCheck: 'wolf', auraAbility: true };
/** A wolf to every check, no ability. */
const WOLF_PLAIN: SeenAs = { seer: 'wolf', wolfCheck: 'wolf', auraAbility: false };

type Base = Omit<RoleDefinition, 'team' | 'scoreKind' | 'wolfCard' | 'copies' | 'killing' | 'wakesWithPack'> &
  Partial<Pick<RoleDefinition, 'copies' | 'killing' | 'wakesWithPack' | 'wolfCard'>>;

function village(r: Base): RoleDefinition {
  return {
    team: 'village',
    scoreKind: 'balance',
    copies: 1,
    killing: 'no',
    wakesWithPack: false,
    wolfCard: false,
    ...r,
  };
}

function wolf(r: Base): RoleDefinition {
  return {
    team: 'werewolf',
    scoreKind: 'balance',
    copies: 1,
    killing: 'no',
    wakesWithPack: true,
    wolfCard: true,
    ...r,
  };
}

function neutral(r: Base): RoleDefinition {
  return {
    team: 'neutral',
    scoreKind: 'disruption',
    copies: 1,
    killing: 'no',
    wakesWithPack: false,
    wolfCard: false,
    ...r,
  };
}

export const ROLES: readonly RoleDefinition[] = [
  // ── Core set ─────────────────────────────────────────────
  village({ id: 'villager', group: 'core', score: 1, copies: 'unlimited', wakes: NEVER, nightSteps: [], seenAs: VILLAGE_PLAIN }),
  wolf({ id: 'werewolf', group: 'core', score: -6, copies: 'unlimited', wakes: EVERY, nightSteps: [16], seenAs: WOLF_PLAIN }),
  wolf({ id: 'alpha_wolf', group: 'core', score: -8, wakes: EVERY, nightSteps: [16], seenAs: WOLF_ABILITY }),
  wolf({ id: 'dark_wolf', group: 'core', score: -7, wakes: EVERY, nightSteps: [16, 18], seenAs: WOLF_ABILITY }),
  village({ id: 'seer', group: 'core', score: 7, wakes: EVERY, nightSteps: [26], seenAs: VILLAGE_ABILITY }),
  village({ id: 'witch', group: 'core', score: 4, wakes: EVERY, nightSteps: [25], seenAs: VILLAGE_ABILITY, killing: 'yes' }),
  village({ id: 'salvator', group: 'core', score: 3, wakes: EVERY, nightSteps: [13], seenAs: VILLAGE_ABILITY }),
  village({ id: 'hunter', group: 'core', score: 3, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY, killing: 'yes' }),

  // ── Information ──────────────────────────────────────────
  village({ id: 'apprentice_seer', group: 'info', score: 4, wakes: TRIGGERED, nightSteps: [26], seenAs: VILLAGE_ABILITY }),
  village({ id: 'beholder', group: 'info', score: 2, requires: ['seer'], wakes: NIGHT_1, nightSteps: [28], seenAs: VILLAGE_PLAIN }),
  village({ id: 'aura_seer', group: 'info', score: 3, wakes: EVERY, nightSteps: [29], seenAs: VILLAGE_ABILITY }),
  village({ id: 'pi', group: 'info', score: 4, wakes: { kind: 'odd' }, nightSteps: [30], seenAs: VILLAGE_ABILITY }),
  village({ id: 'lycan', group: 'info', score: -1, wakes: NEVER, nightSteps: [], seenAs: WOLF_PLAIN }),
  village({ id: 'mason', group: 'info', score: 2, copies: 'unlimited', minCopies: 2, wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_PLAIN }),
  village({ id: 'little_girl', group: 'info', score: 2, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'bear', group: 'animal', score: 3, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'owl', group: 'animal', score: 2, wakes: EVERY, nightSteps: [40], seenAs: VILLAGE_ABILITY }),

  // ── Protectors ───────────────────────────────────────────
  village({ id: 'prince', group: 'protector', score: 2, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'musketeer', group: 'protector', score: 2, requires: ['prince'], wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),
  village({ id: 'bodyguard', group: 'protector', score: 2, requires: ['prince'], wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),
  village({ id: 'knight', group: 'protector', score: 3, wakes: EVERY, nightSteps: [14], seenAs: VILLAGE_ABILITY }),
  village({ id: 'forger', group: 'protector', score: 4, wakes: EVERY, nightSteps: [15], seenAs: VILLAGE_ABILITY }),
  village({ id: 'priest', group: 'protector', score: 3, wakes: EVERY, nightSteps: [1], seenAs: VILLAGE_ABILITY }),
  village({ id: 'warden', group: 'protector', score: 4, wakes: EVERY, nightSteps: [3], seenAs: VILLAGE_ABILITY }),
  village({ id: 'wise', group: 'protector', score: 2, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'diseased', group: 'protector', score: 2, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),

  // ── Killers and day powers ───────────────────────────────
  village({ id: 'hero', group: 'killer', score: 3, wakes: EVERY, nightSteps: [32], seenAs: VILLAGE_ABILITY, killing: 'yes' }),
  village({ id: 'thug', group: 'killer', score: 2, wakes: EVERY, nightSteps: [33], seenAs: VILLAGE_ABILITY, killing: 'conditional' }),
  village({ id: 'witcher', group: 'killer', score: 4, wakes: NIGHTS_1_TO_3, nightSteps: [12], seenAs: VILLAGE_ABILITY, killing: 'yes' }),
  village({ id: 'dictator', group: 'killer', score: 3, wakes: { kind: 'day' }, nightSteps: [], seenAs: VILLAGE_ABILITY, killing: 'yes' }),
  village({ id: 'guest', group: 'killer', score: 2, wakes: EVERY, nightSteps: [27], seenAs: VILLAGE_ABILITY }),
  village({ id: 'lawyer', group: 'killer', score: -1, wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),
  village({ id: 'judge', group: 'killer', score: 2, wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),

  // ── Copiers ──────────────────────────────────────────────
  village({ id: 'doppelganger', group: 'copier', score: 3, wakes: EVERY, nightSteps: [4], seenAs: VILLAGE_ABILITY }),
  village({ id: 'faceless_villager', group: 'copier', score: 1, wakes: NIGHTS_1_TO_3, nightSteps: [6], seenAs: VILLAGE_PLAIN }),
  village({ id: 'robber', group: 'copier', score: 2, wakes: NIGHTS_1_TO_3, nightSteps: [5], seenAs: VILLAGE_PLAIN }),
  village({ id: 'lady', group: 'copier', score: 2, wakes: NIGHTS_1_TO_3, nightSteps: [7], seenAs: VILLAGE_PLAIN }),
  village({ id: 'fool', group: 'copier', score: 2, wakes: NIGHTS_1_TO_3, nightSteps: [8], seenAs: VILLAGE_PLAIN }),
  village({ id: 'drunk', group: 'copier', score: 1, wakes: TRIGGERED, nightSteps: [0], seenAs: VILLAGE_PLAIN }),
  village({ id: 'triple_face', group: 'copier', score: 4, wakes: { kind: 'nights', nights: [1, 2] }, nightSteps: [25, 26], seenAs: VILLAGE_ABILITY, killing: 'yes' }),

  // ── Bonds and curses ─────────────────────────────────────
  village({ id: 'cupid', group: 'bond', score: 1, wakes: NIGHTS_1_TO_3, nightSteps: [9], seenAs: VILLAGE_ABILITY }),
  village({ id: 'cursed', group: 'bond', score: -2, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_PLAIN }),
  village({ id: 'wild_child', group: 'bond', score: -1, wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),
  village({ id: 'ghost', group: 'bond', score: 2, wakes: { kind: 'dawnWhenDead' }, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'troublemaker', group: 'bond', score: 1, wakes: EVERY, nightSteps: [38], seenAs: VILLAGE_ABILITY }),
  village({ id: 'puppeteer', group: 'bond', score: 1, wakes: EVERY, nightSteps: [24], seenAs: VILLAGE_ABILITY }),

  // ── Animals ──────────────────────────────────────────────
  village({ id: 'raven', group: 'animal', score: 2, wakes: { kind: 'day' }, nightSteps: [], seenAs: VILLAGE_ABILITY }),
  village({ id: 'cat', group: 'animal', score: 3, wakes: TRIGGERED, nightSteps: [31], seenAs: VILLAGE_ABILITY, killing: 'conditional' }),
  village({ id: 'sheep', group: 'animal', score: 1, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_ABILITY }),

  // ── Neutrals and the Doctor ──────────────────────────────
  neutral({ id: 'hoodlum', group: 'neutral', score: 2, wakes: NIGHT_1, nightSteps: [11], seenAs: VILLAGE_ABILITY }),
  neutral({ id: 'angel', group: 'neutral', score: 3, wakes: NEVER, nightSteps: [], seenAs: VILLAGE_PLAIN }),
  neutral({ id: 'sect_leader', group: 'neutral', score: 4, wakes: EVERY, nightSteps: [35], seenAs: VILLAGE_ABILITY }),
  neutral({ id: 'dark_cupid', group: 'neutral', score: 2, wakes: NIGHTS_1_TO_3, nightSteps: [10], seenAs: VILLAGE_ABILITY }),
  neutral({ id: 'rat', group: 'neutral', score: 4, wakes: EVERY, nightSteps: [36], seenAs: VILLAGE_ABILITY }),
  village({ id: 'doctor', group: 'neutral', score: 2, requires: ['rat'], wakes: EVERY, nightSteps: [37], seenAs: VILLAGE_ABILITY }),
  neutral({ id: 'lonely_wolf', group: 'neutral', score: 5, wakes: EVERY, wakesWithPack: true, wolfCard: true, nightSteps: [16, 22], seenAs: WOLF_ABILITY }),

  // ── Special wolves ───────────────────────────────────────
  {
    id: 'minion',
    team: 'werewolf',
    group: 'wolf',
    score: -3,
    scoreKind: 'balance',
    copies: 1,
    wakes: NIGHT_1,
    wakesWithPack: false,
    nightSteps: [17],
    seenAs: VILLAGE_PLAIN,
    wolfCard: false,
    killing: 'no',
  },
  // Score shown for the nightly version (S6); the permanent version scores −6.
  wolf({ id: 'devil_wolf', group: 'wolf', score: -7, wakes: EVERY, nightSteps: [2, 16], seenAs: WOLF_ABILITY }),
  wolf({ id: 'dream_wolf', group: 'wolf', score: -4, wakes: TRIGGERED, wakesWithPack: false, nightSteps: [16], seenAs: WOLF_PLAIN }),
  wolf({ id: 'sneaky_wolf', group: 'wolf', score: -7, wakes: EVERY, nightSteps: [16], seenAs: { seer: 'notWolf', wolfCheck: 'wolf', auraAbility: true } }),
  wolf({ id: 'mystic_wolf', group: 'wolf', score: -7, wakes: EVERY, nightSteps: [16, 19], seenAs: WOLF_ABILITY }),
  wolf({ id: 'parrot_wolf', group: 'wolf', score: -5, wakes: EVERY, nightSteps: [16, 23], seenAs: WOLF_PLAIN }),
  wolf({ id: 'shadow_wolf', group: 'wolf', score: -7, wakes: EVERY, nightSteps: [16, 20], seenAs: WOLF_ABILITY }),
  wolf({ id: 'avenger_wolf', group: 'wolf', score: -6, wakes: EVERY, nightSteps: [16, 21], seenAs: WOLF_ABILITY }),
];

const BY_ID = new Map(ROLES.map((r) => [r.id, r]));

/** Look up a role definition. Throws for an unknown ID, which is always a bug. */
export function getRole(id: string): RoleDefinition {
  const role = BY_ID.get(id);
  if (!role) throw new Error(`Unknown role id: ${id}`);
  return role;
}

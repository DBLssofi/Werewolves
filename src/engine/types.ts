/**
 * Game-independent types for the rules engine.
 * No React, no UI, no user-visible text: text lives in the translation files.
 */

/** Starting team printed on a card. "lovers" only ever arises during play. */
export type Team = 'village' | 'werewolf' | 'neutral';

/** Team a player currently plays for (cross-team Lovers form their own team). */
export type CurrentTeam = Team | 'lovers';

/** Grouping used by the role library and the role picker. */
export type RoleGroup =
  | 'core'
  | 'info'
  | 'protector'
  | 'killer'
  | 'copier'
  | 'bond'
  | 'animal'
  | 'neutral'
  | 'wolf';

/**
 * When the narrator calls a role (Narrator Guide, section 2 "Call policy").
 * - every: every night
 * - odd / even: Nights 1, 3, 5… / 2, 4, 6…
 * - nights: only the listed nights
 * - range: from night `from` to night `to`, inclusive
 * - triggered: only after an event the role card names (e.g. Apprentice Seer after the Seer dies)
 * - day: acts during the day, never called at night
 * - dawnWhenDead: woken at dawn once the player is dead (Ghost)
 * - never: never called
 */
export type WakeSchedule =
  | { kind: 'every' }
  | { kind: 'odd' }
  | { kind: 'even' }
  | { kind: 'nights'; nights: readonly number[] }
  | { kind: 'range'; from: number; to: number }
  | { kind: 'triggered' }
  | { kind: 'day' }
  | { kind: 'dawnWhenDead' }
  | { kind: 'never' };

/** Result of a wolf check: "is this player a wolf?" */
export type WolfCheckResult = 'wolf' | 'notWolf';

/** What the checking roles see for an untouched holder of this role (Narrator Guide, section 6). */
export interface SeenAs {
  /** The Seer, a promoted Apprentice Seer and Triple Face's Night 1 check. */
  seer: WolfCheckResult;
  /** The P.I. and the Bear. */
  wolfCheck: WolfCheckResult;
  /** The Aura Seer: does the card give an ability? */
  auraAbility: boolean;
}

/**
 * Whether the role holds a killing ability for the werewolf parity check (Rulebook, section 2).
 * - yes: while unused (e.g. Witch's poison)
 * - conditional: only in a certain state (Thug once unlocked, Cat with a pending scratch)
 * - no
 */
export type KillingAbility = 'yes' | 'conditional' | 'no';

export interface RoleDefinition {
  /** Stable app ID, e.g. "seer". */
  id: string;
  team: Team;
  group: RoleGroup;
  /**
   * Balance score printed on the card. Village and werewolf cards: + helps the village,
   * − helps the wolves. Neutral cards: how much they disrupt the game (see `scoreKind`).
   */
  score: number;
  scoreKind: 'balance' | 'disruption';
  /** Copies allowed in one game. */
  copies: number | 'unlimited';
  /** Minimum copies when dealt at all (Mason: 2). */
  minCopies?: number;
  /** Setup bans: role IDs that must also be dealt (Beholder needs the Seer). */
  requires?: readonly string[];
  /** When the role is called at night (or acts by day). */
  wakes: WakeSchedule;
  /** True if the role also wakes with the wolf pack (step 16). */
  wakesWithPack: boolean;
  /** Night-order steps where this role is called (Narrator Guide, section 3). */
  nightSteps: readonly number[];
  seenAs: SeenAs;
  /**
   * True for a werewolf card: counts as a wolf for winning, the Dictator, the Witcher trap and the Guest.
   * The Lonely Wolf is a wolf card on the Neutral team; the Minion is not a wolf card.
   */
  wolfCard: boolean;
  killing: KillingAbility;
}

/** Game settings S1–S8 (Rulebook, section 3). */
export interface GameSettings {
  /** S1 */
  reveal: 'revealed' | 'anonymous';
  /** S2 */
  voting: 'open' | 'anonymous';
  /** S3 */
  discussionTimer: 'off' | 'perPerson' | 'wholeDiscussion';
  /** S3a, in seconds. */
  discussionTimerSeconds: number;
  /** S4 (Open voting only) */
  defenceSpeech: boolean;
  /** S4a, in seconds; 0 = no timer. */
  defenceTimerSeconds: number;
  /** S5 */
  day1Tie: 'noExecution' | 'revote';
  /** S6 */
  devilWolf: 'nightly' | 'permanent';
  /** S7 */
  alphaInfections: number;
  /** S8 */
  forgerShields: number;
  forgerSwords: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  reveal: 'revealed',
  voting: 'open',
  discussionTimer: 'off',
  discussionTimerSeconds: 60,
  defenceSpeech: true,
  defenceTimerSeconds: 60,
  day1Tie: 'noExecution',
  devilWolf: 'nightly',
  alphaInfections: 1,
  forgerShields: 1,
  forgerSwords: 1,
};

/** A chosen role and how many copies of it are in the game. */
export interface RoleCount {
  roleId: string;
  count: number;
}

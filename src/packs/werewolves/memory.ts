/**
 * Keys used in Player.memory by the Werewolves pack, and helpers that read them.
 * Keeping the keys in one place stops typos from silently creating new state.
 */
import type { GameState, Player } from '@/engine/state';

export const MEM = {
  /** Witch / Triple Face: poison potion used. */
  poisonUsed: 'poisonUsed',
  /** Witch / Triple Face: heal potion used. */
  healUsed: 'healUsed',
  /** Hunter / Triple Face: last shot used. */
  shotUsed: 'shotUsed',
  /** Dictator: coup used. */
  coupUsed: 'coupUsed',
  /** Hero / Thug / Priest / Puppeteer / Judge: the once-per-game ability used. */
  used: 'used',
  /** Thug: revenge unlocked by a neighbour's elimination. */
  unlocked: 'unlocked',
  /** Witcher: seat of the trapped player, or null. */
  trapSeat: 'trapSeat',
  /** Witcher: the trap has fired. */
  trapFired: 'trapFired',
  /** Cat: survived the attack, scratch not yet made. */
  scratchPending: 'scratchPending',
  /** Forger items held by this player. */
  shields: 'shields',
  swords: 'swords',
  /** Forger: items made so far (limits from setting S8). */
  shieldsMade: 'shieldsMade',
  swordsMade: 'swordsMade',
  /** Mystic Wolf: the Seer has been found. */
  seerFound: 'seerFound',
  /** Apprentice Seer: promoted to Seer. */
  promoted: 'promoted',
  /** Cat: the night on which she scratches. */
  scratchNight: 'scratchNight',
  /** Avenger Wolf: the night on which he gets his guesses. */
  revengeNight: 'revengeNight',
  /** Dream Wolf: awake (no other wolf left to wake with the pack). */
  awake: 'awake',
  /** Avenger Wolf (or a Shadow Wolf with his power): the poisoners to find, as "3,5". */
  revengeOn: 'revengeOn',
  /** Shadow Wolf: the wolf powers gained, as role IDs "dark_wolf,mystic_wolf". */
  shadowPowers: 'shadowPowers',
  /** Shadow Wolf: the night he is tapped and shown a newly gained power. */
  shadowShownNight: 'shadowShownNight',
  /** A gained role works from this night (copiers). */
  roleFromNight: 'roleFromNight',
  /** The night the narrator taps this player and shows their new role card (Lady, Drunk). */
  roleShownNight: 'roleShownNight',
  /** Doppelganger: the role copied tonight, and the night. */
  mirrorRole: 'mirrorRole',
  mirrorNight: 'mirrorNight',
  /** Lady: her husband's seat. */
  husband: 'husband',
  /** Fool: the three roles offered, as "seer,witch,hunter". */
  foolOffer: 'foolOffer',
  /** Ghost: may whisper a letter at each dawn from this night on. */
  ghostFromNight: 'ghostFromNight',
  /** Bodyguard: the night on which he is shown the new Prince. */
  newPrinceNight: 'newPrinceNight',
} as const;

/** Keys used in GameState.packState. */
export const PACK = {
  /** The wolves killed the Wise: every special wolf power is lost for good. */
  wolfPowersLost: 'wolfPowersLost',
  /** The night on which the wolves are sick (the night after eating the Diseased). */
  wolvesSickNight: 'wolvesSickNight',
  /** The Drunk's trigger has happened (the first village-team elimination). */
  drunkResolved: 'drunkResolved',
} as const;

function flag(p: Player, key: string): boolean {
  return p.memory[key] === true;
}

function count(p: Player, key: string): number {
  const v = p.memory[key];
  return typeof v === 'number' ? v : 0;
}

/** The wolf cards whose power the Shadow Wolf can gain. */
export const SHADOW_GAINABLE = ['alpha_wolf', 'dark_wolf', 'devil_wolf', 'mystic_wolf', 'sneaky_wolf', 'avenger_wolf'] as const;

/** The wolf powers a Shadow Wolf holds. */
export function shadowPowers(p: Player): string[] {
  const v = p.memory[MEM.shadowPowers];
  return typeof v === 'string' && v.length > 0 ? v.split(',') : [];
}

/** Seat lists stored as "3,5". */
export function seatList(p: Player, key: string): number[] {
  const v = p.memory[key];
  return typeof v === 'string' && v.length > 0 ? v.split(',').map(Number) : [];
}

/**
 * Does this player hold a werewolf card's special power (its own card, or gained by the Shadow Wolf)?
 * False once the wolves killed the Wise, or when the player's abilities were removed.
 */
export function holdsWolfPower(p: Player, state: GameState, power: string): boolean {
  if (p.abilitiesRemoved || state.packState[PACK.wolfPowersLost] === true) return false;
  if (p.roleId === power) return true;
  return p.roleId === 'shadow_wolf' && shadowPowers(p).includes(power);
}

function currentNight(state: GameState): number {
  return state.phase.kind === 'night' ? state.phase.night : state.phase.kind === 'day' ? state.phase.day : 0;
}

/**
 * Does this player still hold an unused killing ability (Rulebook, section 2)?
 * Used by the werewolves' win check: while a living village-team player has one, the wolves cannot win.
 */
export function hasKillingAbilityLeft(p: Player, state: GameState): boolean {
  if (!p.alive || p.abilitiesRemoved) return false;
  if (count(p, MEM.swords) > 0) return true;
  switch (p.roleId) {
    case 'witch':
      return !flag(p, MEM.poisonUsed);
    case 'hunter':
      return !flag(p, MEM.shotUsed);
    case 'dictator':
      return !flag(p, MEM.coupUsed);
    case 'hero':
      return !flag(p, MEM.used);
    case 'witcher': {
      if (flag(p, MEM.trapFired)) return false;
      const trapSet = typeof p.memory[MEM.trapSeat] === 'number';
      // An unset trap is lost after Night 3.
      return trapSet || currentNight(state) <= 3;
    }
    case 'triple_face': {
      const poisonLeft = currentNight(state) <= 2 && !flag(p, MEM.poisonUsed);
      return poisonLeft || !flag(p, MEM.shotUsed);
    }
    case 'thug':
      return flag(p, MEM.unlocked) && !flag(p, MEM.used);
    case 'cat':
      return flag(p, MEM.scratchPending);
    default:
      return false;
  }
}

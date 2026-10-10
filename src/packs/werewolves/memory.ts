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
  /** Shadow Wolf: holds a gained power that acts after the pack. */
  afterPackPower: 'afterPackPower',
  /** Bodyguard: the night on which he is shown the new Prince. */
  newPrinceNight: 'newPrinceNight',
} as const;

/** Keys used in GameState.packState. */
export const PACK = {
  /** The wolves killed the Wise: every special wolf power is lost for good. */
  wolfPowersLost: 'wolfPowersLost',
  /** The night on which the wolves are sick (the night after eating the Diseased). */
  wolvesSickNight: 'wolvesSickNight',
} as const;

function flag(p: Player, key: string): boolean {
  return p.memory[key] === true;
}

function count(p: Player, key: string): number {
  const v = p.memory[key];
  return typeof v === 'number' ? v : 0;
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

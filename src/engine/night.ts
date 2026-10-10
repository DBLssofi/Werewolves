/** Game-independent types for planning a night. */

/** Facts decided earlier in the same night, which change how later roles are called. */
export interface NightFacts {
  /** The Priest prayed at step 1. */
  prayed: boolean;
  /** Seats blocked by the Devil Wolf at step 2 (affects steps after 2). */
  devilBlocked: number[];
  /** Seats jailed tonight: by the Warden at step 3, or by a Doppelganger copying him at step 4. */
  jailed: number[];
  /** The wolves ate the Diseased last night: every wolf power is blocked tonight. */
  wolvesSick: boolean;
}

export const NO_FACTS: NightFacts = { prayed: false, devilBlocked: [], jailed: [], wolvesSick: false };

/**
 * One call the narrator makes.
 * - acting: seats woken who may use their ability
 * - crossed: seats woken and shown crossed arms (blocked, jailed, used up, nothing to do)
 * - aloudOnly: the narrator says the call so the sounds stay the same, but nobody wakes
 *   (a dead role in an Anonymous game)
 * - restriction "noKill": the wolves wake on a Priest night, without a victim
 */
export interface NightCall {
  step: number;
  /** A role ID, or a group: "pack" (the wolves together), "swordHolder". */
  callId: string;
  acting: number[];
  crossed: number[];
  aloudOnly: boolean;
  restriction?: 'noKill';
}

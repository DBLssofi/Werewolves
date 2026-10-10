/**
 * Plans the narrator's calls for one night (Narrator Guide, sections 2 and 3).
 *
 * Call it at the start of the night with NO_FACTS, and again after steps 1–3 with what
 * happened there (prayer, Devil Wolf block, jail), because those change the later calls.
 * Steps 0 and 39 (narrator taps) and the Lovers' wake-up are consequences of actions,
 * so they are not planned here.
 */
import type { NightCall, NightFacts } from '@/engine/night';
import { inWindow } from '@/engine/schedule';
import type { GameState, Player } from '@/engine/state';
import { MEM, PACK, seatList, shadowPowers } from './memory';
import { roleActive, roleLinks } from './roleChange';
import { getRole } from './roles';

/** The master night order: which calls happen at each step, in order. */
export const NIGHT_ORDER: readonly { step: number; callIds: readonly string[] }[] = [
  { step: 1, callIds: ['priest'] },
  { step: 2, callIds: ['devil_wolf', 'shadow_wolf'] },
  { step: 3, callIds: ['warden'] },
  { step: 4, callIds: ['doppelganger'] },
  { step: 5, callIds: ['robber'] },
  { step: 6, callIds: ['faceless_villager'] },
  { step: 7, callIds: ['lady'] },
  { step: 8, callIds: ['fool'] },
  { step: 9, callIds: ['cupid'] },
  { step: 10, callIds: ['dark_cupid'] },
  { step: 11, callIds: ['mason', 'musketeer', 'bodyguard', 'wild_child', 'lawyer', 'hoodlum', 'judge'] },
  { step: 12, callIds: ['witcher'] },
  { step: 13, callIds: ['salvator'] },
  { step: 14, callIds: ['knight'] },
  { step: 15, callIds: ['forger'] },
  { step: 16, callIds: ['pack'] },
  { step: 17, callIds: ['minion'] },
  { step: 18, callIds: ['dark_wolf'] },
  { step: 19, callIds: ['mystic_wolf'] },
  { step: 20, callIds: ['shadow_wolf'] },
  { step: 21, callIds: ['avenger_wolf'] },
  { step: 22, callIds: ['lonely_wolf'] },
  { step: 23, callIds: ['parrot_wolf'] },
  { step: 24, callIds: ['puppeteer'] },
  { step: 25, callIds: ['witch', 'triple_face'] },
  { step: 26, callIds: ['seer', 'triple_face'] },
  { step: 27, callIds: ['guest'] },
  { step: 28, callIds: ['beholder'] },
  { step: 29, callIds: ['aura_seer'] },
  { step: 30, callIds: ['pi'] },
  { step: 31, callIds: ['cat'] },
  { step: 32, callIds: ['hero'] },
  { step: 33, callIds: ['thug'] },
  { step: 34, callIds: ['swordHolder'] },
  { step: 35, callIds: ['sect_leader'] },
  { step: 36, callIds: ['rat'] },
  { step: 37, callIds: ['doctor'] },
  { step: 38, callIds: ['troublemaker'] },
  { step: 40, callIds: ['owl'] },
];

/** Calls skipped completely on a Priest night (any reveal mode): the killing roles and the Witch. */
export const PRIEST_SKIPS = new Set(['avenger_wolf', 'lonely_wolf', 'witch', 'guest', 'cat', 'hero', 'thug', 'swordHolder']);

/**
 * Roles the Doppelganger can never copy: the Priest (Narrator Guide, copiers), and — provisional,
 * not yet confirmed — the copiers whose ability changes who they are (Robber, Faceless, Lady, Fool).
 */
export const MIRROR_NEVER = new Set(['priest', 'doppelganger', 'robber', 'faceless_villager', 'lady', 'fool']);

/** Calls that are a werewolf card's special power: lost for good when the wolves kill the Wise. */
const SPECIAL_WOLF_CALLS = new Set(['devil_wolf', 'dark_wolf', 'mystic_wolf', 'shadow_wolf', 'avenger_wolf']);

/** Steps whose calls are wolf powers, blocked the night after the wolves ate the Diseased. */
const WOLF_POWER_STEPS = new Set([2, 16, 17, 18, 19, 20, 21, 22, 23]);

const flag = (p: Player, key: string) => p.memory[key] === true;
const num = (p: Player, key: string) => (typeof p.memory[key] === 'number' ? (p.memory[key] as number) : null);

function dealt(state: GameState, roleId: string): boolean {
  return state.players.some((p) => p.roleId === roleId || p.startRoleId === roleId);
}

/** Is this seat blocked (Devil Wolf) or jailed (Warden) at this step? */
function isBlocked(seat: number, step: number, facts: NightFacts): boolean {
  if (step > 2 && facts.devilBlocked.includes(seat)) return true;
  if (step > 3 && facts.jailed.includes(seat)) return true;
  return false;
}

/**
 * Is the role called tonight at all (its window), for this holder?
 * Returns false for "not called"; the used-up check happens separately.
 */
function inRoleWindow(state: GameState, p: Player, callId: string, step: number, night: number): boolean {
  const seerAndGuest = dealt(state, 'seer') && dealt(state, 'guest');
  switch (callId) {
    case 'triple_face':
      return (step === 26 && night === 1) || (step === 25 && night === 2);
    case 'seer':
      return seerAndGuest ? night % 2 === 1 : true;
    case 'guest':
      return seerAndGuest ? night % 2 === 0 : true;
    case 'devil_wolf':
      return state.settings.devilWolf === 'permanent' ? night <= 3 : true;
    case 'shadow_wolf': {
      const powers = shadowPowers(p);
      if (step === 2) return powers.includes('devil_wolf') && (state.settings.devilWolf === 'permanent' ? night <= 3 : true);
      return powers.includes('dark_wolf') || powers.includes('mystic_wolf') || (powers.includes('avenger_wolf') && revengeTonight(state, p, night));
    }
    case 'lonely_wolf':
      return night % 2 === 1;
    case 'bodyguard':
      return night === 1 || num(p, MEM.newPrinceNight) === night;
    case 'cat':
      return num(p, MEM.scratchNight) === night;
    case 'avenger_wolf':
      return revengeTonight(state, p, night);
    default:
      return inWindow(getRole(callId).wakes, night);
  }
}

/** The Avenger's guesses are tonight, and one of the poisoners is still alive. */
function revengeTonight(state: GameState, p: Player, night: number): boolean {
  return num(p, MEM.revengeNight) === night && seatList(p, MEM.revengeOn).some((seat) => state.players[seat]?.alive);
}

/**
 * Can a role act tonight at all (its window, the Priest's prayer)? Used for the Doppelganger's copy
 * and the Puppeteer's control. `holder` is whoever holds the role (for roles with a personal trigger).
 */
export function roleCanActTonight(state: GameState, holder: Player, callId: string, night: number, prayed: boolean): boolean {
  if (prayed && PRIEST_SKIPS.has(callId)) return false;
  const role = getRole(callId);
  if (callId === 'seer' && prayed && night % 2 === 0 && dealt(state, 'seer') && dealt(state, 'guest')) return true;
  const steps = callId === 'seer' ? [26] : role.nightSteps.filter((step) => step > 0);
  return steps.some((step) => inRoleWindow(state, holder, callId, step, night));
}

/** Has this holder nothing left to do tonight (woken, shown crossed arms)? */
function usedUp(state: GameState, p: Player, callId: string, night: number, step: number): boolean {
  if (p.abilitiesRemoved) return true;
  if (SPECIAL_WOLF_CALLS.has(callId) && state.packState[PACK.wolfPowersLost] === true) return true;
  switch (callId) {
    case 'priest':
      return night === 1 || flag(p, MEM.used);
    case 'witch':
      return flag(p, MEM.healUsed) && flag(p, MEM.poisonUsed);
    case 'hero':
    case 'puppeteer':
    case 'cupid':
    case 'dark_cupid':
      return flag(p, MEM.used);
    // Copiers stay woken through Nights 1–3 after using their ability (crossed arms).
    case 'faceless_villager':
    case 'robber':
    case 'lady':
    case 'fool':
      return flag(p, MEM.used) || p.roleId !== callId;
    case 'thug':
      return !flag(p, MEM.unlocked) || flag(p, MEM.used);
    case 'witcher':
      return num(p, MEM.trapSeat) !== null;
    case 'forger':
      return (
        (num(p, MEM.shieldsMade) ?? 0) >= state.settings.forgerShields &&
        (num(p, MEM.swordsMade) ?? 0) >= state.settings.forgerSwords
      );
    case 'mystic_wolf':
      return flag(p, MEM.seerFound);
    case 'devil_wolf':
      return state.settings.devilWolf === 'permanent' && flag(p, MEM.used);
    case 'shadow_wolf': {
      if (step === 2) return state.settings.devilWolf === 'permanent' && flag(p, MEM.used);
      const powers = shadowPowers(p);
      const mysticLeft = powers.includes('mystic_wolf') && !flag(p, MEM.seerFound);
      return !powers.includes('dark_wolf') && !mysticLeft && !(powers.includes('avenger_wolf') && revengeTonight(state, p, night));
    }
    case 'doppelganger':
      return night % 2 === 1;
    default:
      return false;
  }
}

/** Living members of the wolf pack tonight. */
function packMembers(state: GameState, night: number): Player[] {
  return state.players.filter((p) => {
    if (!p.alive) return false;
    if (p.infected || p.turned) return true;
    const role = getRole(p.roleId);
    if (p.roleId === 'dream_wolf') return flag(p, MEM.awake);
    return role.wakesWithPack && roleActive(p, night);
  });
}

const COPIER_CALLS = new Set(['robber', 'faceless_villager', 'lady', 'fool']);

/** A Doppelganger copying this call tonight. */
function mirroring(p: Player, callId: string, night: number): boolean {
  return p.roleId === 'doppelganger' && p.memory[MEM.mirrorNight] === night && p.memory[MEM.mirrorRole] === callId;
}

/**
 * Holders of a role call. The Seer's slot also covers a promoted Apprentice Seer. A copier is called
 * through Nights 1–3 even after taking another role; a gained role is called from the next night.
 * A Doppelganger copying the role tonight is called in its slot.
 */
function holders(state: GameState, callId: string, night: number): Player[] {
  return state.players.filter((p) => {
    if (mirroring(p, callId, night)) return true;
    if (COPIER_CALLS.has(callId) && p.startRoleId === callId) return true;
    const holds =
      p.roleId === callId || (callId === 'seer' && p.roleId === 'apprentice_seer' && flag(p, MEM.promoted));
    return holds && roleActive(p, night);
  });
}

export function planNight(state: GameState, night: number, facts: NightFacts): NightCall[] {
  const calls: NightCall[] = [];
  const anonymous = state.settings.reveal === 'anonymous';
  const seerAndGuest = dealt(state, 'seer') && dealt(state, 'guest');

  for (const { step, callIds } of NIGHT_ORDER) {
    for (const callId of callIds) {
      if (facts.prayed && PRIEST_SKIPS.has(callId)) continue;
      if (facts.prayed && callId === 'triple_face' && step === 25) continue;
      const sick = facts.wolvesSick && WOLF_POWER_STEPS.has(step);

      if (callId === 'pack') {
        const members = packMembers(state, night);
        if (members.length === 0) continue;
        const acting: number[] = [];
        const crossed: number[] = [];
        for (const p of members) {
          if (sick || isBlocked(p.seat, step, facts)) crossed.push(p.seat);
          else acting.push(p.seat);
        }
        calls.push({ step, callId, acting, crossed, aloudOnly: false, ...(facts.prayed ? { restriction: 'noKill' as const } : {}) });
        continue;
      }

      if (callId === 'swordHolder') {
        if (!dealt(state, 'forger')) continue;
        const holdersWithSword = state.players.filter((p) => p.alive && (num(p, MEM.swords) ?? 0) > 0);
        const acting = holdersWithSword.filter((p) => !isBlocked(p.seat, step, facts)).map((p) => p.seat);
        const crossed = holdersWithSword.filter((p) => isBlocked(p.seat, step, facts)).map((p) => p.seat);
        calls.push({ step, callId, acting, crossed, aloudOnly: acting.length + crossed.length === 0 });
        continue;
      }

      const roleHolders = holders(state, callId, night);
      if (roleHolders.length === 0) continue;
      const acting: number[] = [];
      const crossed: number[] = [];
      let aloud = false;
      for (const p of roleHolders) {
        // On an even Priest night with both dealt, the Seer is called instead of the Guest.
        const seerReplacesGuest = callId === 'seer' && seerAndGuest && facts.prayed && night % 2 === 0;
        const copy = mirroring(p, callId, night);
        const window = copy
          ? callId !== 'triple_face' || inRoleWindow(state, p, callId, step, night)
          : seerReplacesGuest || inRoleWindow(state, p, callId, step, night);
        if (!window) continue;
        if (!p.alive) {
          if (anonymous) aloud = true;
          continue;
        }
        const blocked = isBlocked(p.seat, step, facts) || sick || (facts.wolvesSick && p.infected);
        if (blocked || usedUp(state, p, callId, night, step)) crossed.push(p.seat);
        else acting.push(p.seat);
      }
      if (acting.length + crossed.length === 0 && !aloud) continue;
      calls.push({ step, callId, acting, crossed, aloudOnly: acting.length + crossed.length === 0 });
    }
  }
  return calls;
}

/** The facts known at the start of a night, before anyone acts. */
export function startOfNightFacts(state: GameState, night: number): NightFacts {
  return {
    prayed: false,
    devilBlocked: [],
    jailed: [],
    wolvesSick: state.packState['wolvesSickNight'] === night,
  };
}

/** A player the narrator taps at the start of the night (step 0) to show them something new. */
export type StartTap =
  /** The Lady or the Drunk: shown their new role card. */
  | { seat: number; kind: 'newRole'; roleId: string; linked: number[] }
  /** The Shadow Wolf: shown the card whose power he gained. */
  | { seat: number; kind: 'shadowPower'; powers: string[] };

export function startOfNightTaps(state: GameState, night: number): StartTap[] {
  const taps: StartTap[] = [];
  for (const p of state.players.filter((x) => x.alive)) {
    if (num(p, MEM.roleShownNight) === night) taps.push({ seat: p.seat, kind: 'newRole', roleId: p.roleId, linked: roleLinks(state, p.seat) });
    if (num(p, MEM.shadowShownNight) === night) taps.push({ seat: p.seat, kind: 'shadowPower', powers: shadowPowers(p) });
  }
  return taps;
}

/** Dead Ghosts who whisper a letter at this dawn (R0). */
export function ghostsAtDawn(state: GameState, night: number): number[] {
  return state.players
    .filter((p) => !p.alive && p.roleId === 'ghost' && (num(p, MEM.ghostFromNight) ?? Infinity) <= night)
    .map((p) => p.seat);
}

/** A Ghost's letter: exactly one character, not a space (the screen shows an alphabet for the game's language). */
export function isGhostLetter(letter: string): boolean {
  return [...letter].length === 1 && letter.trim().length === 1;
}

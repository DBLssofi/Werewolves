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
import { MEM } from './memory';
import { getRole } from './roles';

/** The master night order: which calls happen at each step, in order. */
export const NIGHT_ORDER: readonly { step: number; callIds: readonly string[] }[] = [
  { step: 1, callIds: ['priest'] },
  { step: 2, callIds: ['devil_wolf'] },
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
const PRIEST_SKIPS = new Set(['avenger_wolf', 'lonely_wolf', 'witch', 'guest', 'cat', 'hero', 'thug', 'swordHolder']);

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
  if (step > 3 && facts.jailed === seat) return true;
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
    case 'lonely_wolf':
      return night % 2 === 1;
    case 'bodyguard':
      return night === 1 || num(p, MEM.newPrinceNight) === night;
    case 'cat':
      return num(p, MEM.scratchNight) === night;
    case 'avenger_wolf':
      return num(p, MEM.revengeNight) === night;
    case 'shadow_wolf':
      return flag(p, MEM.afterPackPower);
    default:
      return inWindow(getRole(callId).wakes, night);
  }
}

/** Has this holder nothing left to do tonight (woken, shown crossed arms)? */
function usedUp(state: GameState, p: Player, callId: string, night: number): boolean {
  if (p.abilitiesRemoved) return true;
  switch (callId) {
    case 'priest':
      return night === 1 || flag(p, MEM.used);
    case 'witch':
      return flag(p, MEM.healUsed) && flag(p, MEM.poisonUsed);
    case 'hero':
    case 'puppeteer':
    case 'cupid':
    case 'dark_cupid':
    case 'faceless_villager':
    case 'robber':
    case 'lady':
    case 'fool':
      return flag(p, MEM.used);
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
    case 'doppelganger':
      return night % 2 === 1;
    default:
      return false;
  }
}

/** Living members of the wolf pack tonight. */
function packMembers(state: GameState): Player[] {
  return state.players.filter((p) => {
    if (!p.alive) return false;
    if (p.infected || p.turned) return true;
    const role = getRole(p.roleId);
    if (p.roleId === 'dream_wolf') return flag(p, MEM.awake);
    return role.wakesWithPack;
  });
}

/** Holders of a role call: the Seer's slot also covers a promoted Apprentice Seer. */
function holders(state: GameState, callId: string): Player[] {
  if (callId === 'seer') {
    return state.players.filter((p) => p.roleId === 'seer' || (p.roleId === 'apprentice_seer' && flag(p, MEM.promoted)));
  }
  return state.players.filter((p) => p.roleId === callId);
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
        const members = packMembers(state);
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

      const roleHolders = holders(state, callId);
      if (roleHolders.length === 0) continue;
      const acting: number[] = [];
      const crossed: number[] = [];
      let aloud = false;
      for (const p of roleHolders) {
        // On an even Priest night with both dealt, the Seer is called instead of the Guest.
        const seerReplacesGuest = callId === 'seer' && seerAndGuest && facts.prayed && night % 2 === 0;
        const window = seerReplacesGuest || inRoleWindow(state, p, callId, step, night);
        if (!window) continue;
        if (!p.alive) {
          if (anonymous) aloud = true;
          continue;
        }
        const blocked = isBlocked(p.seat, step, facts) || sick || (facts.wolvesSick && p.infected);
        if (blocked || usedUp(state, p, callId, night)) crossed.push(p.seat);
        else acting.push(p.seat);
      }
      if (acting.length + crossed.length === 0 && !aloud) continue;
      calls.push({ step, callId, acting, crossed, aloudOnly: acting.length + crossed.length === 0 });
    }
  }
  return calls;
}

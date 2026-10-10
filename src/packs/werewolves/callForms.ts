/**
 * What the narrator enters for each night call (UI-independent).
 * The night screen asks for the inputs of the chosen form, then turns them into a NightAction.
 */
import type { GameState } from '@/engine/state';
import { shadowPowers } from './memory';
import type { NightAction } from './nightActions';

export type FormId =
  | 'pray'
  | 'devilBlock'
  | 'jail'
  | 'mirror'
  | 'steal'
  | 'takeFace'
  | 'marry'
  | 'foolChoose'
  | 'bind'
  | 'chooseFather'
  | 'chooseClients'
  | 'chooseTargets'
  | 'setTrap'
  | 'protect'
  | 'guard'
  | 'forgeShield'
  | 'forgeSword'
  | 'packVictim'
  | 'packInfect'
  | 'littleGirlCaught'
  | 'paralyse'
  | 'mysticCheck'
  | 'revengeGuess'
  | 'loneHunt'
  | 'puppetSight'
  | 'puppetPoison'
  | 'heal'
  | 'poison'
  | 'seerCheck'
  | 'guestVisit'
  | 'auraCheck'
  | 'piCheck'
  | 'catScratch'
  | 'heroStrike'
  | 'thugStrike'
  | 'swordStrike'
  | 'recruit'
  | 'plague'
  | 'examine'
  | 'swap'
  | 'owlCheck';

/** How many seats the form needs: none (a yes), one, two, or a role from the Fool's offer. */
export type FormInput = 'none' | 'one' | 'two' | 'role';

export interface CallForm {
  id: FormId;
  input: FormInput;
  /** Can be used several times in one call (Avenger's 2 guesses). */
  repeatable?: boolean;
}

/** What the narrator only shows or points out (no choice is recorded). */
export type InfoKind = 'packMeets' | 'linked' | 'wolves' | 'seer' | 'word' | 'secretSign';

export interface CallSpec {
  forms: CallForm[];
  info?: InfoKind;
}

const one = (id: FormId): CallForm => ({ id, input: 'one' });
const two = (id: FormId): CallForm => ({ id, input: 'two' });

const SPECS: Record<string, CallSpec> = {
  priest: { forms: [{ id: 'pray', input: 'none' }] },
  devil_wolf: { forms: [one('devilBlock')] },
  warden: { forms: [one('jail')] },
  doppelganger: { forms: [one('mirror')] },
  robber: { forms: [one('steal')] },
  faceless_villager: { forms: [one('takeFace')] },
  lady: { forms: [one('marry')] },
  fool: { forms: [{ id: 'foolChoose', input: 'role' }] },
  cupid: { forms: [two('bind')] },
  dark_cupid: { forms: [two('bind')] },
  mason: { forms: [], info: 'linked' },
  musketeer: { forms: [], info: 'linked' },
  bodyguard: { forms: [], info: 'linked' },
  wild_child: { forms: [one('chooseFather')] },
  lawyer: { forms: [two('chooseClients')] },
  hoodlum: { forms: [two('chooseTargets')] },
  judge: { forms: [], info: 'secretSign' },
  witcher: { forms: [one('setTrap')] },
  salvator: { forms: [one('protect')] },
  knight: { forms: [one('guard')] },
  forger: { forms: [one('forgeShield'), one('forgeSword')] },
  pack: { forms: [one('packVictim'), one('packInfect'), one('littleGirlCaught')], info: 'packMeets' },
  minion: { forms: [], info: 'wolves' },
  dark_wolf: { forms: [one('paralyse')] },
  mystic_wolf: { forms: [one('mysticCheck')] },
  shadow_wolf: { forms: [one('devilBlock'), one('paralyse'), one('mysticCheck'), { id: 'revengeGuess', input: 'one', repeatable: true }] },
  avenger_wolf: { forms: [{ id: 'revengeGuess', input: 'one', repeatable: true }] },
  lonely_wolf: { forms: [one('loneHunt')] },
  parrot_wolf: { forms: [], info: 'word' },
  puppeteer: { forms: [one('puppetSight'), one('puppetPoison')] },
  witch: { forms: [one('heal'), one('poison')] },
  triple_face: { forms: [one('seerCheck'), one('heal'), one('poison')] },
  seer: { forms: [one('seerCheck')] },
  guest: { forms: [one('guestVisit')] },
  beholder: { forms: [], info: 'seer' },
  aura_seer: { forms: [one('auraCheck')] },
  pi: { forms: [one('piCheck')] },
  cat: { forms: [one('catScratch')] },
  hero: { forms: [one('heroStrike')] },
  thug: { forms: [one('thugStrike')] },
  swordHolder: { forms: [one('swordStrike')] },
  sect_leader: { forms: [one('recruit')] },
  rat: { forms: [one('plague')] },
  doctor: { forms: [one('examine')] },
  troublemaker: { forms: [two('swap')] },
  owl: { forms: [one('owlCheck')] },
};

/** Where the call happens, so the forms can follow what the holder can do. */
export interface CallContext {
  state: GameState;
  night: number;
  step: number;
  /** The acting player (for the Shadow Wolf's gained powers). */
  seat?: number;
}

/** The forms for a call. Unknown calls have no forms. */
export function callSpec(callId: string, ctx?: CallContext): CallSpec {
  const spec = SPECS[callId] ?? { forms: [] };
  if (!ctx) return spec;
  if (callId === 'pack') {
    const canInfect = ctx.state.players.some((p) => p.alive && (p.roleId === 'alpha_wolf' || (p.roleId === 'shadow_wolf' && shadowPowers(p).includes('alpha_wolf'))));
    const littleGirl = ctx.state.players.some((p) => p.alive && p.roleId === 'little_girl');
    return { ...spec, forms: spec.forms.filter((f) => (f.id !== 'packInfect' || canInfect) && (f.id !== 'littleGirlCaught' || littleGirl)) };
  }
  if (callId === 'triple_face') {
    return { forms: spec.forms.filter((f) => (ctx.night === 1 ? f.id === 'seerCheck' : f.id !== 'seerCheck')) };
  }
  if (callId === 'shadow_wolf') {
    const holder = ctx.seat === undefined ? undefined : ctx.state.players[ctx.seat];
    const powers = holder ? shadowPowers(holder) : [];
    const byPower: Record<string, FormId> = { devil_wolf: 'devilBlock', dark_wolf: 'paralyse', mystic_wolf: 'mysticCheck', avenger_wolf: 'revengeGuess' };
    const allowed = new Set(powers.map((p) => byPower[p]).filter((f): f is FormId => f !== undefined));
    return { forms: spec.forms.filter((f) => allowed.has(f.id) && (ctx.step === 2) === (f.id === 'devilBlock')) };
  }
  return spec;
}

/** Turn the narrator's input into a night action. `seat` is the acting player (ignored for the pack). */
export function toAction(form: FormId, seat: number, picks: readonly number[], roleId?: string): NightAction {
  const target = picks[0] ?? -1;
  const b = picks[1] ?? -1;
  switch (form) {
    case 'pray':
      return { kind: 'pray', seat };
    case 'foolChoose':
      return { kind: 'foolChoose', seat, roleId: roleId ?? '' };
    case 'bind':
    case 'chooseClients':
    case 'chooseTargets':
    case 'swap':
      return { kind: form, seat, a: target, b };
    case 'forgeShield':
      return { kind: 'forge', seat, item: 'shield', target };
    case 'forgeSword':
      return { kind: 'forge', seat, item: 'sword', target };
    case 'packVictim':
      return { kind: 'packVictim', target, infect: false };
    case 'packInfect':
      return { kind: 'packVictim', target, infect: true };
    case 'littleGirlCaught':
      return { kind: 'littleGirlCaught', target };
    case 'puppetSight':
      return { kind: 'puppet', seat, mode: 'sight', target };
    case 'puppetPoison':
      return { kind: 'puppet', seat, mode: 'poison', target };
    default:
      return { kind: form, seat, target } as NightAction;
  }
}

/**
 * Night actions: the narrator records each role's choice as it happens.
 * Each action is checked against the role's limits; checks (Seer, P.I. …) return their answer
 * immediately, because the narrator shows it during the night.
 * Nothing is resolved here: deaths and other results happen together at dawn (dawn.ts).
 *
 * Role changes caused by eliminations (Lady, Drunk, Shadow Wolf gains, Ghost) happen in elimination.ts.
 */
import type { NightFacts } from '@/engine/night';
import { isWolf, neighbours, type GameState, type Player } from '@/engine/state';
import { MEM, PACK, holdsWolfPower, seatList, shadowPowers } from './memory';
import { MIRROR_NEVER, roleCanActTonight } from './nightPlan';
import { becomeRole, personMemory, roleActive, roleLinks, roleMemory } from './roleChange';
import { ROLES, getRole } from './roles';
import { createRng, shuffle } from '@/engine/setup';

export interface NightRecord {
  night: number;
  facts: NightFacts;
  /** Seats that opened their eyes for a role tonight (for the Owl). */
  woken: number[];
  /** Lists: a Doppelganger copying a role can act alongside the real holder on the same night. */
  protect: number[];
  guard: { knight: number; target: number }[];
  trap: { witcher: number; target: number } | null;
  forged: { forger: number; item: 'shield' | 'sword'; target: number }[];
  /** The pack's victim; `by` is the seat whose infection was used (Alpha Wolf or Shadow Wolf). */
  pack: { target: number; infect: boolean; by?: number } | null;
  paralysed: number | null;
  loneHunt: { wolf: number; target: number } | null;
  heal: { by: number; target: number }[];
  poisons: { by: number; target: number }[];
  guest: { guest: number; host: number }[];
  heroStrike: { hero: number; target: number }[];
  thugStrike: { thug: number; target: number }[];
  swordStrikes: { holder: number; target: number }[];
  catScratch: { cat: number; target: number }[];
  recruits: number[];
  plague: { rat: number; target: number } | null;
  cured: number[];
  swap: [number, number][];
  /** The Puppeteer took control of the Seer's check or the Witch's poison. */
  puppet: { puppeteer: number; mode: 'sight' | 'poison'; target: number } | null;
  /** The Avenger Wolf's guesses tonight. */
  revengeGuesses: { by: number; target: number; right: boolean }[];
  /** A right guess: the poisoner dies at dawn, unstoppable. */
  revenge: { by: number; target: number } | null;
}

export function startNightRecord(night: number, facts: NightFacts): NightRecord {
  return {
    night,
    facts,
    woken: [],
    protect: [],
    guard: [],
    trap: null,
    forged: [],
    pack: null,
    paralysed: null,
    loneHunt: null,
    heal: [],
    poisons: [],
    guest: [],
    heroStrike: [],
    thugStrike: [],
    swordStrikes: [],
    catScratch: [],
    recruits: [],
    plague: null,
    cured: [],
    swap: [],
    puppet: null,
    revengeGuesses: [],
    revenge: null,
  };
}

export type NightAction =
  | { kind: 'pray'; seat: number }
  | { kind: 'devilBlock'; seat: number; target: number }
  | { kind: 'jail'; seat: number; target: number }
  | { kind: 'protect'; seat: number; target: number }
  | { kind: 'guard'; seat: number; target: number }
  | { kind: 'setTrap'; seat: number; target: number }
  | { kind: 'forge'; seat: number; item: 'shield' | 'sword'; target: number }
  | { kind: 'bind'; seat: number; a: number; b: number }
  | { kind: 'chooseFather'; seat: number; target: number }
  | { kind: 'chooseClients'; seat: number; a: number; b: number }
  | { kind: 'chooseTargets'; seat: number; a: number; b: number }
  | { kind: 'packVictim'; target: number; infect: boolean }
  | { kind: 'littleGirlCaught'; target: number }
  | { kind: 'paralyse'; seat: number; target: number }
  | { kind: 'mysticCheck'; seat: number; target: number }
  | { kind: 'loneHunt'; seat: number; target: number }
  | { kind: 'heal'; seat: number; target: number }
  | { kind: 'poison'; seat: number; target: number }
  | { kind: 'seerCheck'; seat: number; target: number }
  | { kind: 'guestVisit'; seat: number; target: number }
  | { kind: 'auraCheck'; seat: number; target: number }
  | { kind: 'piCheck'; seat: number; target: number }
  | { kind: 'catScratch'; seat: number; target: number }
  | { kind: 'heroStrike'; seat: number; target: number }
  | { kind: 'thugStrike'; seat: number; target: number }
  | { kind: 'swordStrike'; seat: number; target: number }
  | { kind: 'recruit'; seat: number; target: number }
  | { kind: 'plague'; seat: number; target: number }
  | { kind: 'examine'; seat: number; target: number }
  | { kind: 'swap'; seat: number; a: number; b: number }
  | { kind: 'owlCheck'; seat: number; target: number }
  | { kind: 'mirror'; seat: number; target: number }
  | { kind: 'steal'; seat: number; target: number }
  | { kind: 'takeFace'; seat: number; target: number }
  | { kind: 'marry'; seat: number; target: number }
  | { kind: 'foolChoose'; seat: number; roleId: string }
  | { kind: 'puppet'; seat: number; mode: 'sight' | 'poison'; target: number }
  | { kind: 'revengeGuess'; seat: number; target: number };

export type NightError =
  | 'noSuchPlayer'
  | 'targetDead'
  | 'notSelf'
  | 'sameAsLastNight'
  | 'wrongRole'
  | 'actorDead'
  | 'used'
  | 'notTonight'
  | 'notAWolf'
  | 'targetIsWolf'
  | 'alreadyAttacked'
  | 'onePotionPerNight'
  | 'noItemLeft'
  | 'alreadyALover'
  | 'notShownToWitch'
  | 'samePlayer'
  | 'alreadyInCult'
  | 'alreadyPlagued'
  | 'blocked'
  | 'powersLost'
  | 'notOffered'
  | 'controlled';

/** Thumb answers: "up"/"down" exactly as the narrator shows them. */
export type CheckAnswer = 'thumbUp' | 'thumbDown';

export interface ActionOk {
  state: GameState;
  record: NightRecord;
  /** For checks: the answer to show. */
  answer?: CheckAnswer;
  /** For the P.I.: the seats in the checked group. */
  group?: number[];
  /** The ability did nothing: the player is shown crossed arms. For the Robber and Puppeteer it is not spent. */
  failed?: boolean;
  /** The role card the narrator silently shows the player (copiers). */
  shownRole?: string;
  /** Players the narrator also points out (a stolen Musketeer's Prince, a new Minion's wolves…). */
  linked?: number[];
  /** A player tapped after the actor sleeps (the Robber's victim: "you are now a plain Villager"). */
  tapped?: number;
}

// ─── helpers ───────────────────────────────────────────────

function player(state: GameState, seat: number): Player | undefined {
  return state.players[seat];
}

function setMemory(state: GameState, seat: number, patch: Player['memory']): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, memory: { ...p.memory, ...patch } } : p)),
  };
}

function setPlayer(state: GameState, seat: number, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)) };
}

const flag = (p: Player, key: string) => p.memory[key] === true;
const num = (p: Player, key: string) => (typeof p.memory[key] === 'number' ? (p.memory[key] as number) : null);

/** Is this player a member of the wolf pack (can't be the pack's victim)? */
function inPack(p: Player): boolean {
  return p.infected || p.turned || getRole(p.roleId).wakesWithPack || p.roleId === 'dream_wolf';
}

/** What the Seer sees (Narrator Guide, section 6). */
export function seerSees(p: Player, state: GameState): 'wolf' | 'notWolf' {
  if (p.turned) return 'wolf';
  if (p.infected) return 'notWolf';
  if (p.roleId === 'sneaky_wolf' && state.packState[PACK.wolfPowersLost] === true) return 'wolf';
  // A Shadow Wolf who gained the Sneaky Wolf's hiding is hidden too.
  if (p.roleId === 'shadow_wolf' && holdsWolfPower(p, state, 'sneaky_wolf')) return 'notWolf';
  return getRole(p.roleId).seenAs.seer;
}

/** What the P.I. and the Bear see. */
export function wolfCheckSees(p: Player): 'wolf' | 'notWolf' {
  if (p.turned || p.infected) return 'wolf';
  return getRole(p.roleId).seenAs.wolfCheck;
}

/** What the Aura Seer sees: an infected player shows their old role (the role ID is unchanged). */
export function auraSees(p: Player): boolean {
  return getRole(p.roleId).seenAs.auraAbility;
}

/** The role a player acts as tonight: a Doppelganger acts as the role he copied. */
export function actingRole(p: Player, night: number): string {
  if (p.roleId === 'doppelganger' && p.memory[MEM.mirrorNight] === night && typeof p.memory[MEM.mirrorRole] === 'string') {
    return p.memory[MEM.mirrorRole] as string;
  }
  return p.roleId;
}

/** A wolf card, or an infected or turned player. */
function isWolfOrInfected(p: Player): boolean {
  return p.infected || p.turned || getRole(p.roleId).wolfCard;
}

/** Roles a Fool may be offered: village roles with an ability, not dealt, needing no partner card. */
const FOOL_NEVER = new Set(['musketeer', 'bodyguard', 'apprentice_seer', 'beholder', 'doctor', 'fool']);

/** The three roles offered to the Fool (fixed for the game: drawn from the seed). */
export function foolOffer(state: GameState, seat: number): string[] {
  const dealt = new Set(state.players.map((p) => p.startRoleId));
  const pool = ROLES.filter(
    (r) =>
      r.team === 'village' &&
      r.seenAs.auraAbility &&
      !r.requires &&
      (r.minCopies ?? 1) <= 1 &&
      !FOOL_NEVER.has(r.id) &&
      !dealt.has(r.id),
  ).map((r) => r.id);
  return shuffle(pool, createRng(state.seed * 7919 + seat * 31 + 8)).slice(0, 3);
}

/** Counts as the Seer for the Mystic Wolf and the Beholder. */
function isSeer(p: Player): boolean {
  return p.roleId === 'seer' || (p.roleId === 'apprentice_seer' && flag(p, MEM.promoted));
}

// ─── the action ────────────────────────────────────────────

/**
 * Apply one night action. Returns the new state and record, or an error explaining what is not allowed.
 * `actorRole` checks are loose on purpose for wolves (any pack member may point for the pack).
 */
export function applyNightAction(state: GameState, record: NightRecord, action: NightAction): ActionOk | NightError {
  const night = record.night;
  const actorSeat = 'seat' in action ? action.seat : null;
  const actor = actorSeat === null ? undefined : player(state, actorSeat);
  if (actorSeat !== null && !actor) return 'noSuchPlayer';
  if (actor && !actor.alive) return 'actorDead';
  if (actor) {
    // A gained role works from the next night.
    if (!roleActive(actor, night)) return 'notTonight';
    if (actor.abilitiesRemoved) return 'blocked';
    // Devil Wolf blocks (step 2) affect later steps; the Warden's jail (step 3) affects later steps.
    const devilBlocked = record.facts.devilBlocked.includes(actor.seat);
    const jailed = record.facts.jailed.includes(actor.seat);
    if (action.kind === 'jail' && devilBlocked) return 'blocked';
    if (action.kind !== 'pray' && action.kind !== 'devilBlock' && action.kind !== 'jail' && (devilBlocked || jailed)) {
      return 'blocked';
    }
    // The night after eating the Diseased, the wolves (and infected players) can do nothing.
    if (record.facts.wolvesSick && isWolfOrInfected(actor)) return 'blocked';
  }

  const targetOf = (seat: number): Player | NightError => {
    const t = player(state, seat);
    if (!t) return 'noSuchPlayer';
    if (!t.alive) return 'targetDead';
    return t;
  };
  const acting = actor ? actingRole(actor, night) : null;
  const needRole = (...ids: string[]): NightError | null => (acting !== null && ids.includes(acting) ? null : 'wrongRole');
  /** A werewolf card's power, held on the card or gained by the Shadow Wolf. */
  const needPower = (power: string): NightError | null => {
    if (!actor) return 'wrongRole';
    if (holdsWolfPower(actor, state, power)) return null;
    const holdsCard = actor.roleId === power || (actor.roleId === 'shadow_wolf' && shadowPowers(actor).includes(power));
    return holdsCard ? 'powersLost' : 'wrongRole';
  };
  /** Rule "not the same player 2 nights in a row", per holder and per ability. */
  const lastKey = `last.${action.kind}`;
  const lastNightKey = `last.${action.kind}.night`;
  const notRepeat = (target: number): NightError | null =>
    actor && num(actor, lastKey) === target && num(actor, lastNightKey) === night - 1 ? 'sameAsLastNight' : null;
  const remember = (s: GameState, target: number) => setMemory(s, actorSeat as number, { [lastKey]: target, [lastNightKey]: night });
  const ok = (s: GameState, r: NightRecord, extra: Partial<ActionOk> = {}): ActionOk => ({ state: s, record: r, ...extra });

  switch (action.kind) {
    case 'pray': {
      const e = needRole('priest');
      if (e) return e;
      if (night === 1) return 'notTonight';
      if (flag(actor as Player, MEM.used)) return 'used';
      return ok(setMemory(state, action.seat, { [MEM.used]: true }), { ...record, facts: { ...record.facts, prayed: true } });
    }

    case 'devilBlock': {
      const permanent = state.settings.devilWolf === 'permanent';
      const e = needPower('devil_wolf') ?? (permanent ? null : notRepeat(action.target));
      if (e) return e;
      if (permanent && night > 3) return 'notTonight';
      if (permanent && flag(actor as Player, MEM.used)) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (isWolf(t, getRole)) return 'targetIsWolf';
      const blockedRecord = {
        ...record,
        facts: { ...record.facts, devilBlocked: [...record.facts.devilBlocked, action.target] },
      };
      if (permanent) {
        // Every ability lost for good (active, passive and unused killing abilities); the team doesn't change.
        const s = setPlayer(setMemory(state, action.seat, { [MEM.used]: true }), action.target, { abilitiesRemoved: true });
        return ok(s, blockedRecord);
      }
      return ok(remember(state, action.target), blockedRecord);
    }

    case 'jail': {
      const e = needRole('warden') ?? notRepeat(action.target);
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(remember(state, action.target), { ...record, facts: { ...record.facts, jailed: [...record.facts.jailed, action.target] } });
    }

    case 'protect': {
      const e = needRole('salvator') ?? notRepeat(action.target);
      if (e) return e;
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(remember(state, action.target), { ...record, protect: [...record.protect, action.target] });
    }

    case 'guard': {
      const e = needRole('knight') ?? notRepeat(action.target);
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(remember(state, action.target), { ...record, guard: [...record.guard, { knight: action.seat, target: action.target }] });
    }

    case 'setTrap': {
      const e = needRole('witcher');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (num(actor as Player, MEM.trapSeat) !== null) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, action.seat, { [MEM.trapSeat]: action.target }), {
        ...record,
        trap: { witcher: action.seat, target: action.target },
      });
    }

    case 'forge': {
      const e = needRole('forger');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      if (record.forged.some((f) => f.forger === action.seat)) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const madeKey = action.item === 'shield' ? MEM.shieldsMade : MEM.swordsMade;
      const limit = action.item === 'shield' ? state.settings.forgerShields : state.settings.forgerSwords;
      const made = num(actor as Player, madeKey) ?? 0;
      if (made >= limit) return 'noItemLeft';
      // Items work from the next night: they are handed over at dawn.
      return ok(setMemory(state, action.seat, { [madeKey]: made + 1 }), {
        ...record,
        forged: [...record.forged, { forger: action.seat, item: action.item, target: action.target }],
      });
    }

    case 'bind': {
      const e = needRole('cupid', 'dark_cupid');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (flag(actor as Player, MEM.used)) return 'used';
      if (action.a === action.b) return 'samePlayer';
      if (actor?.roleId === 'dark_cupid' && (action.a === action.seat || action.b === action.seat)) return 'notSelf';
      const a = targetOf(action.a);
      const b = targetOf(action.b);
      if (typeof a === 'string') return a;
      if (typeof b === 'string') return b;
      if (a.loverSeat !== null || b.loverSeat !== null) return 'alreadyALover';
      let s = setMemory(state, action.seat, { [MEM.used]: true });
      const crossTeam = a.team !== b.team;
      s = setPlayer(s, a.seat, { loverSeat: b.seat, ...(crossTeam ? { team: 'lovers' as const } : {}) });
      s = setPlayer(s, b.seat, { loverSeat: a.seat, ...(crossTeam ? { team: 'lovers' as const } : {}) });
      s = setMemory(s, a.seat, { loverTeam: a.team });
      s = setMemory(s, b.seat, { loverTeam: b.team });
      return ok(s, record);
    }

    case 'chooseFather':
    case 'chooseClients':
    case 'chooseTargets': {
      const role = action.kind === 'chooseFather' ? 'wild_child' : action.kind === 'chooseClients' ? 'lawyer' : 'hoodlum';
      const e = needRole(role);
      if (e) return e;
      if (night !== 1) return 'notTonight';
      const seats = action.kind === 'chooseFather' ? [action.target] : [action.a, action.b];
      if (seats.includes(action.seat)) return 'notSelf';
      if (seats.length === 2 && seats[0] === seats[1]) return 'samePlayer';
      for (const s of seats) {
        const t = targetOf(s);
        if (typeof t === 'string') return t;
      }
      const patch: Player['memory'] =
        action.kind === 'chooseFather'
          ? { father: action.target }
          : { pickA: seats[0] as number, pickB: seats[1] as number };
      return ok(setMemory(state, action.seat, patch), record);
    }

    case 'packVictim': {
      if (record.facts.prayed) return 'notTonight';
      if (record.facts.wolvesSick) return 'blocked';
      if (record.pack) return 'alreadyAttacked';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (inPack(t)) return 'targetIsWolf';
      if (!action.infect) return ok(state, { ...record, pack: { target: action.target, infect: false } });
      // The infection: the Alpha Wolf's, or a Shadow Wolf's who gained it.
      const holders = state.players.filter(
        (p) => p.alive && (p.roleId === 'alpha_wolf' || (p.roleId === 'shadow_wolf' && shadowPowers(p).includes('alpha_wolf'))),
      );
      if (holders.length === 0) return 'wrongRole';
      const usable = holders.filter(
        (p) =>
          holdsWolfPower(p, state, 'alpha_wolf') &&
          (num(p, 'infectionsUsed') ?? 0) < state.settings.alphaInfections &&
          !record.facts.jailed.includes(p.seat) &&
          !record.facts.devilBlocked.includes(p.seat),
      );
      const by = usable[0];
      if (!by) return holders.some((p) => !holdsWolfPower(p, state, 'alpha_wolf')) ? 'powersLost' : 'used';
      return ok(state, { ...record, pack: { target: action.target, infect: true, by: by.seat } });
    }

    case 'littleGirlCaught': {
      // The narrator confirmed she was peeking: she replaces the pack's victim.
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (t.roleId !== 'little_girl') return 'wrongRole';
      if (!record.pack) return ok(state, { ...record, pack: { target: action.target, infect: false } });
      return ok(state, { ...record, pack: { ...record.pack, target: action.target } });
    }

    case 'paralyse': {
      const e = needPower('dark_wolf') ?? notRepeat(action.target);
      if (e) return e;
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(remember(state, action.target), { ...record, paralysed: action.target });
    }

    case 'mysticCheck': {
      const e = needPower('mystic_wolf');
      if (e) return e;
      if (flag(actor as Player, MEM.seerFound)) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (inPack(t)) return 'targetIsWolf';
      const found = isSeer(t);
      const s = found ? setMemory(state, action.seat, { [MEM.seerFound]: true }) : state;
      return ok(s, record, { answer: found ? 'thumbUp' : 'thumbDown' });
    }

    case 'loneHunt': {
      const e = needRole('lonely_wolf');
      if (e) return e;
      if (night % 2 === 0) return 'notTonight';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(state, { ...record, loneHunt: { wolf: action.seat, target: action.target } });
    }

    case 'heal': {
      const e = needRole('witch', 'triple_face');
      if (e) return e;
      const p = actor as Player;
      if (acting === 'triple_face' && night !== 2) return 'notTonight';
      if (flag(p, MEM.healUsed)) return 'used';
      if (acting === 'witch' && record.poisons.some((x) => x.by === p.seat)) return 'onePotionPerNight';
      // She may only heal the pack's victim shown to her.
      if (!record.pack || record.pack.infect || record.pack.target !== action.target) return 'notShownToWitch';
      return ok(setMemory(state, p.seat, { [MEM.healUsed]: true }), { ...record, heal: [...record.heal, { by: p.seat, target: action.target }] });
    }

    case 'poison': {
      const e = needRole('witch', 'triple_face');
      if (e) return e;
      const p = actor as Player;
      if (acting === 'triple_face' && night !== 2) return 'notTonight';
      if (flag(p, MEM.poisonUsed)) return 'used';
      if (action.target === p.seat) return 'notSelf';
      if (acting === 'witch' && record.heal.some((h) => h.by === p.seat)) return 'onePotionPerNight';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, p.seat, { [MEM.poisonUsed]: true }), {
        ...record,
        poisons: [...record.poisons, { by: p.seat, target: action.target }],
      });
    }

    case 'seerCheck': {
      const p = actor as Player;
      const allowed = isSeer(p) || acting === 'seer' || (acting === 'triple_face' && night === 1);
      if (!allowed) return 'wrongRole';
      if (action.target === p.seat) return 'notSelf';
      // The Puppeteer chose tonight's check for the Seer.
      if (record.puppet?.mode === 'sight' && isSeer(p) && record.puppet.target !== action.target) return 'controlled';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(state, record, { answer: seerSees(t, state) === 'wolf' ? 'thumbDown' : 'thumbUp' });
    }

    case 'guestVisit': {
      const e = needRole('guest');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(state, { ...record, guest: [...record.guest, { guest: action.seat, host: action.target }] });
    }

    case 'auraCheck': {
      const e = needRole('aura_seer');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(state, record, { answer: auraSees(t) ? 'thumbUp' : 'thumbDown' });
    }

    case 'piCheck': {
      const e = needRole('pi');
      if (e) return e;
      if (night % 2 === 0) return 'notTonight';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const { left, right } = neighbours(state, t.seat);
      const group = [...new Set([left, t.seat, right].filter((s): s is number => s !== null))];
      const anyWolf = group.some((s) => wolfCheckSees(state.players[s] as Player) === 'wolf');
      return ok(state, record, { answer: anyWolf ? 'thumbDown' : 'thumbUp', group });
    }

    case 'catScratch': {
      const e = needRole('cat');
      if (e) return e;
      if (actor?.roleId === 'cat' && num(actor, MEM.scratchNight) !== night) return 'notTonight';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (!isWolf(t, getRole) && !(t.roleId === 'lonely_wolf')) return 'notAWolf';
      return ok(state, { ...record, catScratch: [...record.catScratch, { cat: action.seat, target: action.target }] });
    }

    case 'heroStrike': {
      const e = needRole('hero');
      if (e) return e;
      if (flag(actor as Player, MEM.used)) return 'used';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, action.seat, { [MEM.used]: true }), {
        ...record,
        heroStrike: [...record.heroStrike, { hero: action.seat, target: action.target }],
      });
    }

    case 'thugStrike': {
      const e = needRole('thug');
      if (e) return e;
      const p = actor as Player;
      if (!flag(p, MEM.unlocked) || flag(p, MEM.used)) return 'used';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, p.seat, { [MEM.used]: true }), { ...record, thugStrike: [...record.thugStrike, { thug: p.seat, target: action.target }] });
    }

    case 'swordStrike': {
      const swords = num(actor as Player, MEM.swords) ?? 0;
      if (swords <= 0) return 'noItemLeft';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, action.seat, { [MEM.swords]: swords - 1 }), {
        ...record,
        swordStrikes: [...record.swordStrikes, { holder: action.seat, target: action.target }],
      });
    }

    case 'recruit': {
      const e = needRole('sect_leader');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (t.cult) return 'alreadyInCult';
      // Recruiting is not an attack: it takes effect at once.
      return ok(setPlayer(state, t.seat, { cult: true }), { ...record, recruits: [...record.recruits, t.seat] });
    }

    case 'plague': {
      const e = needRole('rat');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (t.plagueNight !== null) return 'alreadyPlagued';
      return ok(setPlayer(state, t.seat, { plagueNight: night }), { ...record, plague: { rat: action.seat, target: t.seat } });
    }

    case 'examine': {
      const e = needRole('doctor');
      if (e) return e;
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      if (t.plagueNight === null) return ok(state, record, { answer: 'thumbDown' });
      return ok(setPlayer(state, t.seat, { plagueNight: null }), { ...record, cured: [...record.cured, t.seat] }, { answer: 'thumbUp' });
    }

    case 'swap': {
      const e = needRole('troublemaker');
      if (e) return e;
      if (action.a === action.b) return 'samePlayer';
      const a = targetOf(action.a);
      const b = targetOf(action.b);
      if (typeof a === 'string') return a;
      if (typeof b === 'string') return b;
      return ok(state, { ...record, swap: [...record.swap, [action.a, action.b]] });
    }

    case 'owlCheck': {
      const e = needRole('owl');
      if (e) return e;
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(state, record, { answer: record.woken.includes(t.seat) ? 'thumbUp' : 'thumbDown' });
    }

    // ─── copiers ───────────────────────────────────────────

    case 'mirror': {
      if (actor?.roleId !== 'doppelganger') return 'wrongRole';
      if (night % 2 === 1) return 'notTonight';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const callId = t.roleId === 'apprentice_seer' && flag(t, MEM.promoted) ? 'seer' : t.roleId;
      const copyable =
        !t.infected &&
        !t.turned &&
        !t.abilitiesRemoved &&
        getRole(t.roleId).team === 'village' &&
        !MIRROR_NEVER.has(callId) &&
        roleCanActTonight(state, t, callId, night, record.facts.prayed);
      // Fresh uses for tonight only: the copied role's memory starts empty every time.
      const base = personMemory(actor);
      if (!copyable) {
        return ok({ ...state, players: state.players.map((p) => (p.seat === actor.seat ? { ...p, memory: base } : p)) }, record, {
          failed: true,
        });
      }
      const memory = { ...base, [MEM.mirrorRole]: callId, [MEM.mirrorNight]: night };
      const s = { ...state, players: state.players.map((p) => (p.seat === actor.seat ? { ...p, memory } : p)) };
      return ok(s, record, { shownRole: t.roleId });
    }

    case 'steal': {
      const e = needRole('robber');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const role = getRole(t.roleId);
      const stealable = role.team === 'village' && role.seenAs.auraAbility && !t.infected && !t.turned && !t.abilitiesRemoved;
      // A failed attempt is not spent.
      if (!stealable) return ok(state, record, { failed: true });
      let s = becomeRole(state, action.seat, { roleId: t.roleId, uses: roleMemory(t), fromNight: night + 1, shownNight: null });
      s = becomeRole(s, t.seat, { roleId: 'villager', uses: 'fresh', fromNight: night + 1, shownNight: null });
      return ok(s, record, { shownRole: t.roleId, linked: roleLinks(s, action.seat), tapped: t.seat });
    }

    case 'takeFace': {
      const e = needRole('faceless_villager');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const role = getRole(t.roleId);
      const change = (roleId: string) =>
        becomeRole(state, action.seat, { roleId, uses: 'fresh', fromNight: night + 1, shownNight: null });
      if (isWolfOrInfected(t)) {
        // A wolf is copied as a plain Werewolf: no special power.
        const s = change('werewolf');
        return ok(s, record, { shownRole: t.roleId });
      }
      if (role.team === 'neutral') {
        // The copy fails and is used up: a plain Villager.
        return ok(change('villager'), record, { shownRole: t.roleId, failed: true });
      }
      const s = change(t.roleId);
      return ok(s, record, { shownRole: t.roleId, linked: roleLinks(s, action.seat) });
    }

    case 'marry': {
      const e = needRole('lady');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (flag(actor as Player, MEM.used)) return 'used';
      if (action.target === action.seat) return 'notSelf';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      return ok(setMemory(state, action.seat, { [MEM.used]: true, [MEM.husband]: t.seat }), record);
    }

    case 'foolChoose': {
      const e = needRole('fool');
      if (e) return e;
      if (night > 3) return 'notTonight';
      if (!foolOffer(state, action.seat).includes(action.roleId)) return 'notOffered';
      const s = becomeRole(state, action.seat, { roleId: action.roleId, uses: 'fresh', fromNight: night + 1, shownNight: null });
      return ok(s, record, { shownRole: action.roleId, linked: roleLinks(s, action.seat) });
    }

    case 'puppet': {
      const e = needRole('puppeteer');
      if (e) return e;
      if (flag(actor as Player, MEM.used)) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const free = (p: Player) =>
        p.alive && !p.abilitiesRemoved && roleActive(p, night) && !record.facts.devilBlocked.includes(p.seat) && !record.facts.jailed.includes(p.seat);
      const failed = () => ok(state, record, { failed: true });
      const spend = (s: GameState) => setMemory(s, action.seat, { [MEM.used]: true });
      if (action.mode === 'sight') {
        const seerActsTonight = roleCanActTonight(state, actor as Player, 'seer', night, record.facts.prayed);
        const seer = state.players.find((p) => isSeer(p) && free(p));
        if (!seer || !seerActsTonight) return failed();
        return ok(spend(state), { ...record, puppet: { puppeteer: action.seat, mode: 'sight', target: t.seat } });
      }
      if (record.facts.prayed) return failed();
      const witch = state.players.find((p) => p.roleId === 'witch' && free(p) && !flag(p, MEM.poisonUsed));
      if (!witch) return failed();
      // The Witch's poison is spent on his target; she cannot heal tonight.
      const s = setMemory(spend(state), witch.seat, { [MEM.poisonUsed]: true });
      return ok(s, {
        ...record,
        puppet: { puppeteer: action.seat, mode: 'poison', target: t.seat },
        poisons: [...record.poisons, { by: witch.seat, target: t.seat }],
      });
    }

    case 'revengeGuess': {
      const e = needPower('avenger_wolf');
      if (e) return e;
      const p = actor as Player;
      if (record.facts.prayed || num(p, MEM.revengeNight) !== night) return 'notTonight';
      const mine = record.revengeGuesses.filter((g) => g.by === p.seat);
      if (mine.length >= 2 || mine.some((g) => g.right)) return 'used';
      const t = targetOf(action.target);
      if (typeof t === 'string') return t;
      const right = seatList(p, MEM.revengeOn).includes(t.seat);
      const r = { ...record, revengeGuesses: [...record.revengeGuesses, { by: p.seat, target: t.seat, right }] };
      return ok(state, right ? { ...r, revenge: { by: p.seat, target: t.seat } } : r, { answer: right ? 'thumbUp' : 'thumbDown' });
    }
  }
}

/** The app reports which seats opened their eyes for a call (acting and crossed-arms seats). */
export function markWoken(record: NightRecord, seats: readonly number[]): NightRecord {
  return { ...record, woken: [...new Set([...record.woken, ...seats])] };
}

/** The player the Witch is shown tonight (the pack's victim), or null for "nobody". */
export function witchSees(state: GameState, record: NightRecord): number | null {
  if (!record.pack || record.pack.infect) return null;
  const t = state.players[record.pack.target];
  if (!t) return null;
  // Stopped or absorbed attacks show "nobody" (Prince, jail, Salvator, shield, Wise's first, Cursed, Cat's first).
  if (t.roleId === 'prince' || record.facts.jailed.includes(t.seat) || record.protect.includes(t.seat)) return null;
  if ((num(t, MEM.shields) ?? 0) > 0) return null;
  if (t.roleId === 'wise' && !flag(t, 'lifeUsed')) return null;
  if (t.roleId === 'cursed' && !t.turned) return null;
  if (t.roleId === 'cat' && !flag(t, 'catAttacked')) return null;
  const guard = record.guard.find((g) => g.target === t.seat && g.knight !== t.seat);
  if (guard) return guard.knight;
  return t.seat;
}

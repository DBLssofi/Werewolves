/**
 * Game state: players and the game as a whole.
 * Plain data only, so a game can be saved and restored as JSON.
 */
import type { CurrentTeam, GameSettings, RoleDefinition } from './types';

export interface Player {
  /** 0-based, clockwise from the narrator's left (the order the phone was passed in the deal). */
  seat: number;
  name: string;
  /** Current role (can change: Robber, Lady, Faceless, Drunk…). */
  roleId: string;
  /** Role dealt at the start. */
  startRoleId: string;
  alive: boolean;
  team: CurrentTeam;
  /** Infected by the Alpha Wolf. */
  infected: boolean;
  /** A Cursed or Wild Child who has turned into a wolf. */
  turned: boolean;
  /** Seat of the Lover partner, if any. */
  loverSeat: number | null;
  /** All abilities removed for good (Wise executed, permanent Devil Wolf block). */
  abilitiesRemoved: boolean;
  /** In the Sect Leader's cult. */
  cult: boolean;
  /** Night on which the plague was caught, or null. */
  plagueNight: number | null;
  /**
   * Per-role memory: uses left, last target, unlocked flags… Keys are defined by the game pack.
   * Values are JSON-safe.
   */
  memory: Record<string, number | boolean | string | null>;
}

export type Phase =
  | { kind: 'night'; night: number }
  | { kind: 'day'; day: number }
  | { kind: 'over'; result: WinResult };

/** Who won. "draw" = everyone was eliminated at the same moment. */
export type WinResult =
  | { kind: 'team'; team: 'village' | 'werewolf' | 'lovers' }
  | { kind: 'solo'; seat: number; roleId: string }
  | { kind: 'draw' };

export interface GameState {
  /** Save-format version, bumped when the shape changes. */
  version: 1;
  packId: string;
  seed: number;
  settings: GameSettings;
  players: Player[];
  mayorSeat: number | null;
  phase: Phase;
}

export type RoleLookup = (id: string) => RoleDefinition;

/** A new player at the start of the game. */
export function newPlayer(seat: number, name: string, roleId: string, lookup: RoleLookup): Player {
  return {
    seat,
    name,
    roleId,
    startRoleId: roleId,
    alive: true,
    team: lookup(roleId).team,
    infected: false,
    turned: false,
    loverSeat: null,
    abilitiesRemoved: false,
    cult: false,
    plagueNight: null,
    memory: {},
  };
}

/** Is this player a wolf right now (for the wolves' parity check, Dictator, Witcher trap, Guest)? */
export function isWolf(p: Player, lookup: RoleLookup): boolean {
  if (p.infected || p.turned) return true;
  const role = lookup(p.roleId);
  return role.wolfCard && p.team === 'werewolf';
}

/** Living players, in seat order. */
export function living(state: GameState): Player[] {
  return state.players.filter((p) => p.alive);
}

/** The nearest living player on each side (Rulebook glossary, "Neighbour"). */
export function neighbours(state: GameState, seat: number): { left: number | null; right: number | null } {
  const n = state.players.length;
  const find = (dir: 1 | -1): number | null => {
    for (let k = 1; k < n; k++) {
      const s = (((seat + dir * k) % n) + n) % n;
      if (s === seat) return null;
      if (state.players[s]?.alive) return s;
    }
    return null;
  };
  // With only one other living player, both sides are the same player.
  return { left: find(-1), right: find(1) };
}

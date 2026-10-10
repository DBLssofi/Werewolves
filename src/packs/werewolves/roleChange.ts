/**
 * Changing a player's role (Role Compendium, "Copiers", shared rules).
 *
 * A player's memory holds two kinds of keys:
 * - person keys belong to the player whatever their role (items held, the Sheep status, lover data,
 *   when they were told something, their own "not 2 nights in a row" history);
 * - every other key belongs to the role (uses left, links like the Wild Child's father).
 * A gained role starts fresh (role keys cleared) or keeps the uses left (Robber: role keys copied).
 */
import type { CurrentTeam } from '@/engine/types';
import type { GameState, Player } from '@/engine/state';
import { MEM } from './memory';
import { getRole } from './roles';

const PERSON_KEYS = new Set<string>([
  MEM.shields,
  MEM.swords,
  'sheep',
  'loverTeam',
  'infectedNight',
  'toldTurnedNight',
  MEM.roleFromNight,
  MEM.roleShownNight,
  MEM.shadowShownNight,
  MEM.ghostFromNight,
]);

/** Person keys stay with the player; "not 2 nights in a row" histories are per holder. */
function isPersonKey(key: string): boolean {
  return PERSON_KEYS.has(key) || key.startsWith('last.');
}

export function personMemory(p: Player): Player['memory'] {
  return Object.fromEntries(Object.entries(p.memory).filter(([k]) => isPersonKey(k)));
}

export function roleMemory(p: Player): Player['memory'] {
  return Object.fromEntries(Object.entries(p.memory).filter(([k]) => !isPersonKey(k)));
}

/** The team a player has after taking a new role: Lovers and infected/turned players keep theirs. */
export function teamAfterRoleChange(p: Player, newRoleId: string): CurrentTeam {
  if (p.team === 'lovers') return 'lovers';
  if (p.infected || p.turned) return 'werewolf';
  return getRole(newRoleId).team;
}

export function patchPlayer(state: GameState, seat: number, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...patch } : p)) };
}

export function patchMemory(state: GameState, seat: number, patch: Player['memory']): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, memory: { ...p.memory, ...patch } } : p)),
  };
}

/** A Lover whose team changed is silently re-checked: different teams now → cross-team Lovers. */
export function recheckLovers(state: GameState, seat: number): GameState {
  const p = state.players[seat];
  if (!p || p.loverSeat === null || p.team === 'lovers') return state;
  const partner = state.players[p.loverSeat];
  if (!partner || p.team === partner.team) return state;
  return patchPlayer(patchPlayer(state, p.seat, { team: 'lovers' }), partner.seat, { team: 'lovers' });
}

export interface RoleChange {
  roleId: string;
  /** "fresh": as if just dealt. Otherwise the role memory to keep (the uses left). */
  uses: 'fresh' | Player['memory'];
  /** The night the role starts working (the next night). */
  fromNight: number;
  /** The night the narrator taps the player and shows the card, or null if shown at once. */
  shownNight: number | null;
}

/** Give a player a new role. The team follows the role, except for Lovers and infected/turned players. */
export function becomeRole(state: GameState, seat: number, change: RoleChange): GameState {
  const p = state.players[seat];
  if (!p) return state;
  const memory: Player['memory'] = {
    ...personMemory(p),
    ...(change.uses === 'fresh' ? {} : change.uses),
    [MEM.roleFromNight]: change.fromNight,
    ...(change.shownNight === null ? {} : { [MEM.roleShownNight]: change.shownNight }),
  };
  const s = patchPlayer(state, seat, { roleId: change.roleId, team: teamAfterRoleChange(p, change.roleId), memory });
  return recheckLovers(s, seat);
}

/** A gained role works from the next night: is this player's role active tonight? */
export function roleActive(p: Player, night: number): boolean {
  const from = p.memory[MEM.roleFromNight];
  return typeof from !== 'number' || from <= night;
}

/**
 * Players the narrator points out with a gained role: a Musketeer or Bodyguard is shown the Prince,
 * a Mason the other Masons, a Minion the wolves.
 */
export function roleLinks(state: GameState, seat: number): number[] {
  const p = state.players[seat];
  if (!p) return [];
  const others = state.players.filter((x) => x.alive && x.seat !== seat);
  switch (p.roleId) {
    case 'musketeer':
    case 'bodyguard':
      return others.filter((x) => x.roleId === 'prince').map((x) => x.seat);
    case 'mason':
      return others.filter((x) => x.roleId === 'mason').map((x) => x.seat);
    case 'minion':
      return others.filter((x) => x.infected || x.turned || (getRole(x.roleId).wolfCard && x.team === 'werewolf')).map((x) => x.seat);
    default:
      return [];
  }
}

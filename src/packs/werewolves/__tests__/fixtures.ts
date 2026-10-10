/** Test helpers: build a game directly from a list of roles (seat = position in the list). */
import { newPlayer, type GameState, type Player } from '@/engine/state';
import { DEFAULT_SETTINGS } from '@/engine/types';
import { getRole } from '../roles';

export function gameOf(roleIds: string[], night = 1): GameState {
  return {
    version: 1,
    packId: 'werewolves',
    seed: 1,
    settings: DEFAULT_SETTINGS,
    players: roleIds.map((id, seat) => newPlayer(seat, `P${seat}`, id, getRole)),
    mayorSeat: null,
    phase: { kind: 'night', night },
  };
}

/** Return a copy of the game with one player changed. */
export function withPlayer(state: GameState, seat: number, change: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.seat === seat ? { ...p, ...change } : p)) };
}

/** Kill several seats at once. */
export function kill(state: GameState, ...seats: number[]): GameState {
  return { ...state, players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)) };
}

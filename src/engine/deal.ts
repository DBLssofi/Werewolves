/**
 * The pass-the-phone deal (App Spec, section 5, step 7).
 * The phone goes clockwise from the narrator's left, so the order of entry is the seat order.
 * For each player: pick a face-down card → enter name → reveal (UI) → confirm.
 */
import { buildDeck, createRng } from './setup';
import { newPlayer, type GameState, type RoleLookup } from './state';
import type { GameSettings, RoleCount } from './types';

export interface DealEntry {
  name: string;
  roleId: string;
}

export interface Deal {
  seed: number;
  /** The face-down cards, in their shuffled positions on screen. */
  cards: string[];
  /** Which cards have been taken. */
  taken: boolean[];
  /** Confirmed players, in seat order. */
  entries: DealEntry[];
}

export function startDeal(roles: readonly RoleCount[], seed: number): Deal {
  const cards = buildDeck(roles, createRng(seed));
  return { seed, cards, taken: cards.map(() => false), entries: [] };
}

export type DealError = 'cardTaken' | 'noSuchCard' | 'emptyName' | 'nameInUse' | 'dealFinished';

/** Seat of the next player to receive a card. */
export function nextSeat(deal: Deal): number {
  return deal.entries.length;
}

export function isDealComplete(deal: Deal): boolean {
  return deal.entries.length === deal.cards.length;
}

/** The role on a face-down card (shown only during the private reveal). */
export function peekCard(deal: Deal, cardIndex: number): string | DealError {
  if (cardIndex < 0 || cardIndex >= deal.cards.length) return 'noSuchCard';
  if (deal.taken[cardIndex]) return 'cardTaken';
  return deal.cards[cardIndex] as string;
}

/**
 * The player confirms their card: it is taken, and they get the next seat.
 * Names are trimmed and must be unique (case-insensitive) so the narrator can tell players apart.
 */
export function confirmCard(deal: Deal, cardIndex: number, rawName: string): Deal | DealError {
  if (isDealComplete(deal)) return 'dealFinished';
  const roleId = peekCard(deal, cardIndex);
  if (roleId === 'noSuchCard' || roleId === 'cardTaken') return roleId;
  const name = rawName.trim();
  if (name.length === 0) return 'emptyName';
  if (deal.entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) return 'nameInUse';
  const taken = [...deal.taken];
  taken[cardIndex] = true;
  return { ...deal, taken, entries: [...deal.entries, { name, roleId: roleId as string }] };
}

/** Review mode: the role of one seated player, shown again privately. */
export function reviewRole(deal: Deal, seat: number): string | null {
  return deal.entries[seat]?.roleId ?? null;
}

/** Turn a finished deal into a game, starting at Night 1 (the mayor is elected before it). */
export function createGame(deal: Deal, settings: GameSettings, packId: string, lookup: RoleLookup): GameState {
  if (!isDealComplete(deal)) throw new Error('The deal is not finished');
  return {
    version: 1,
    packId,
    seed: deal.seed,
    settings,
    players: deal.entries.map((e, seat) => newPlayer(seat, e.name, e.roleId, lookup)),
    mayorSeat: null,
    phase: { kind: 'night', night: 1 },
  };
}

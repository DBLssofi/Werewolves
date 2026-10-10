/**
 * Game setup rules (Rulebook, section 4): player count, wolf ratio, setup bans, balance.
 */
import type { RoleCount, RoleDefinition } from './types';

export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 50;

/** Suggested number of wolves: player count ÷ 4, rounded down. */
export function suggestedWolves(playerCount: number): number {
  return Math.floor(playerCount / 4);
}

export type SetupProblem =
  | { kind: 'playerCount'; playerCount: number }
  | { kind: 'cardCount'; cards: number; players: number }
  | { kind: 'unknownRole'; roleId: string }
  | { kind: 'tooManyCopies'; roleId: string; count: number; allowed: number }
  | { kind: 'tooFewCopies'; roleId: string; count: number; minimum: number }
  | { kind: 'missingPartner'; roleId: string; requires: string };

/**
 * Check a chosen set of roles against the setup rules.
 * Returns an empty list when the setup is valid.
 */
export function validateSetup(
  playerCount: number,
  roles: readonly RoleCount[],
  lookup: (id: string) => RoleDefinition | undefined,
): SetupProblem[] {
  const problems: SetupProblem[] = [];
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    problems.push({ kind: 'playerCount', playerCount });
  }

  const chosen = roles.filter((r) => r.count > 0);
  const cards = chosen.reduce((sum, r) => sum + r.count, 0);
  if (cards !== playerCount) {
    problems.push({ kind: 'cardCount', cards, players: playerCount });
  }

  const dealt = new Set(chosen.map((r) => r.roleId));
  for (const { roleId, count } of chosen) {
    const role = lookup(roleId);
    if (!role) {
      problems.push({ kind: 'unknownRole', roleId });
      continue;
    }
    if (role.copies !== 'unlimited' && count > role.copies) {
      problems.push({ kind: 'tooManyCopies', roleId, count, allowed: role.copies });
    }
    if (role.minCopies !== undefined && count < role.minCopies) {
      problems.push({ kind: 'tooFewCopies', roleId, count, minimum: role.minCopies });
    }
    for (const partner of role.requires ?? []) {
      if (!dealt.has(partner)) {
        problems.push({ kind: 'missingPartner', roleId, requires: partner });
      }
    }
  }
  return problems;
}

/**
 * Balance total of the village and werewolf cards (a suggestion only, never a block).
 * Neutral cards measure disruption, not a side, so they are summed separately.
 */
export function balanceTotals(
  roles: readonly RoleCount[],
  lookup: (id: string) => RoleDefinition | undefined,
): { balance: number; disruption: number } {
  let balance = 0;
  let disruption = 0;
  for (const { roleId, count } of roles) {
    const role = lookup(roleId);
    if (!role || count <= 0) continue;
    if (role.scoreKind === 'disruption') disruption += role.score * count;
    else balance += role.score * count;
  }
  return { balance, disruption };
}

/**
 * Deterministic pseudo-random number generator (mulberry32), so a game can be
 * replayed from its seed in tests and in the game log. Returns numbers in [0, 1).
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** Expand role counts into one card per player, shuffled: the face-down cards of the deal. */
export function buildDeck(roles: readonly RoleCount[], rng: () => number): string[] {
  const deck: string[] = [];
  for (const { roleId, count } of roles) {
    for (let i = 0; i < count; i++) deck.push(roleId);
  }
  return shuffle(deck, rng);
}

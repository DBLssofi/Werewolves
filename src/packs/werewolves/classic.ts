/**
 * Classic mode: the narrator only enters the player count and the app picks the roles
 * (App Spec, Q6). Tunable after playtests.
 *
 * - Wolves: the suggested count (players ÷ 4, rounded down).
 *   From 12 players, two of them are the Alpha Wolf and the Dark Wolf.
 * - Village: Seer, Witch, Salvator, Hunter; the rest are Villagers.
 */
import { MAX_PLAYERS, MIN_PLAYERS, suggestedWolves } from '@/engine/setup';
import type { RoleCount } from '@/engine/types';

export const CLASSIC_SPECIAL_WOLVES_FROM = 12;

export function classicRoles(playerCount: number): RoleCount[] {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Classic mode needs ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${playerCount}`);
  }
  const wolves = suggestedWolves(playerCount);
  const roles: RoleCount[] = [];

  if (playerCount >= CLASSIC_SPECIAL_WOLVES_FROM) {
    roles.push({ roleId: 'alpha_wolf', count: 1 }, { roleId: 'dark_wolf', count: 1 });
    if (wolves > 2) roles.push({ roleId: 'werewolf', count: wolves - 2 });
  } else {
    roles.push({ roleId: 'werewolf', count: wolves });
  }

  const villageSpecials = ['seer', 'witch', 'salvator', 'hunter'];
  for (const id of villageSpecials) roles.push({ roleId: id, count: 1 });

  const villagers = playerCount - wolves - villageSpecials.length;
  roles.push({ roleId: 'villager', count: villagers });
  return roles;
}

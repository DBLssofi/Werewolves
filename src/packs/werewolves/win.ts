/**
 * Win check for the Werewolves pack (Rulebook, section 2; Narrator Guide, R9).
 * Run after every round of eliminations is fully finished.
 * The Angel's win is decided by the vote itself (first voting day), not here.
 */
import { isWolf, living, type GameState, type WinResult } from '@/engine/state';
import { hasKillingAbilityLeft } from './memory';
import { getRole } from './roles';

export function checkWinner(state: GameState): WinResult | null {
  const alive = living(state);

  // 1. Single winners (checked first; an infected one has joined the wolves and cannot win alone).
  for (const p of alive) {
    if (p.team !== 'neutral') continue;
    const others = alive.filter((o) => o.seat !== p.seat);
    if (p.roleId === 'sect_leader' && others.length > 0 && others.every((o) => o.cult)) {
      return { kind: 'solo', seat: p.seat, roleId: p.roleId };
    }
    if (p.roleId === 'rat' && others.length > 0 && others.every((o) => o.plagueNight !== null)) {
      return { kind: 'solo', seat: p.seat, roleId: p.roleId };
    }
  }

  // 2. Everyone eliminated at the same moment.
  if (alive.length === 0) return { kind: 'draw' };

  // 3. Lonely Wolf: while alive, no team can win; it wins as the last player alive.
  const lonely = alive.find((p) => p.roleId === 'lonely_wolf' && p.team === 'neutral');
  if (lonely) {
    return alive.length === 1 ? { kind: 'solo', seat: lonely.seat, roleId: lonely.roleId } : null;
  }

  // 4. Cross-team Lovers: while alive, nobody else wins; they win as the last 2 alive.
  const lovers = alive.filter((p) => p.team === 'lovers');
  if (lovers.length > 0) {
    return alive.length === 2 && lovers.length === 2 ? { kind: 'team', team: 'lovers' } : null;
  }

  // 5. Village: no wolf left alive.
  const wolves = alive.filter((p) => isWolf(p, getRole));
  if (wolves.length === 0) return { kind: 'team', team: 'village' };

  // 6. Werewolves: parity, and no living village-team player holds an unused killing ability.
  const others = alive.length - wolves.length;
  const killerLeft = alive.some((p) => p.team === 'village' && hasKillingAbilityLeft(p, state));
  if (wolves.length >= others && !killerLeft) return { kind: 'team', team: 'werewolf' };

  return null;
}

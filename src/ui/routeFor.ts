/** Which game screen a session belongs on (used when resuming a saved game). */
import type { Href } from 'expo-router';
import type { Session } from '@/packs/werewolves/session';

export function routeFor(s: Session): Href {
  const phase = s.state.phase;
  if (phase.kind === 'over') return '/game/over';
  if (phase.kind === 'day') return '/game/day';
  if (s.night === null) return '/game/dawn';
  const started = s.log.some((e) => e.event.kind === 'mayor') || s.state.mayorSeat !== null || phase.night > 1;
  return started ? '/game/night' : '/game/mayor';
}

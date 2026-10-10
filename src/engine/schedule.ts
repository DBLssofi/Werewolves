/** Wake-schedule helpers (Narrator Guide, section 2 "Call policy"). */
import type { WakeSchedule } from './types';

/**
 * Is `night` inside the role's regular wake window?
 * "triggered" roles are decided by the game pack from the game state, so they return false here.
 */
export function inWindow(schedule: WakeSchedule, night: number): boolean {
  switch (schedule.kind) {
    case 'every':
      return true;
    case 'odd':
      return night % 2 === 1;
    case 'even':
      return night % 2 === 0;
    case 'nights':
      return schedule.nights.includes(night);
    case 'range':
      return night >= schedule.from && night <= schedule.to;
    case 'triggered':
    case 'day':
    case 'dawnWhenDead':
    case 'never':
      return false;
  }
}

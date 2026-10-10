/**
 * Save files: a versioned JSON envelope around a game pack's session.
 * The engine checks the envelope and the game state; the pack checks its own parts.
 * Nothing here touches storage: the app decides where the string is kept (on the device only).
 */
import type { GameState, Player } from './state';
import { DEFAULT_SETTINGS } from './types';

export const SAVE_FORMAT = 'blood-moon-save';
/** Bumped whenever the saved shape changes; older saves are migrated, newer ones refused. */
export const SAVE_VERSION = 1;

export interface SaveEnvelope<T> {
  format: typeof SAVE_FORMAT;
  version: number;
  packId: string;
  session: T;
}

export type LoadError = 'notJson' | 'notASave' | 'newerVersion' | 'wrongPack' | 'damaged';

export function toSaveString<T>(packId: string, session: T): string {
  const envelope: SaveEnvelope<T> = { format: SAVE_FORMAT, version: SAVE_VERSION, packId, session };
  return JSON.stringify(envelope);
}

/** Read the envelope; `check` validates the pack's session and returns it, or null if damaged. */
export function fromSaveString<T>(text: string, packId: string, check: (session: unknown) => T | null): T | LoadError {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return 'notJson';
  }
  if (!isRecord(raw) || raw['format'] !== SAVE_FORMAT || typeof raw['version'] !== 'number') return 'notASave';
  if (raw['version'] > SAVE_VERSION) return 'newerVersion';
  if (raw['packId'] !== packId) return 'wrongPack';
  const session = check(raw['session']);
  return session === null ? 'damaged' : session;
}

// ─── shape checks ──────────────────────────────────────────

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isSeatOrNull = (x: unknown) => x === null || isInt(x);
const isScalar = (x: unknown) => x === null || ['number', 'boolean', 'string'].includes(typeof x);

function isPlayer(x: unknown, seat: number): x is Player {
  if (!isRecord(x)) return false;
  return (
    x['seat'] === seat &&
    typeof x['name'] === 'string' &&
    typeof x['roleId'] === 'string' &&
    typeof x['startRoleId'] === 'string' &&
    typeof x['alive'] === 'boolean' &&
    ['village', 'werewolf', 'neutral', 'lovers'].includes(x['team'] as string) &&
    typeof x['infected'] === 'boolean' &&
    typeof x['turned'] === 'boolean' &&
    isSeatOrNull(x['loverSeat']) &&
    typeof x['abilitiesRemoved'] === 'boolean' &&
    typeof x['cult'] === 'boolean' &&
    isSeatOrNull(x['plagueNight']) &&
    isRecord(x['memory']) &&
    Object.values(x['memory']).every(isScalar)
  );
}

function isPhase(x: unknown): boolean {
  if (!isRecord(x)) return false;
  if (x['kind'] === 'night') return isInt(x['night']) && (x['night'] as number) >= 1;
  if (x['kind'] === 'day') return isInt(x['day']) && (x['day'] as number) >= 1;
  return x['kind'] === 'over' && isRecord(x['result']);
}

/** Every setting present, with the same type as its default. */
function isSettings(x: unknown): boolean {
  if (!isRecord(x)) return false;
  return Object.entries(DEFAULT_SETTINGS).every(([key, value]) => typeof x[key] === typeof value);
}

/** Is this a well-formed game state? Role IDs are checked by `knownRole`. */
export function isGameState(x: unknown, knownRole: (id: string) => boolean): x is GameState {
  if (!isRecord(x)) return false;
  const players = x['players'];
  if (!Array.isArray(players) || !players.every((p, i) => isPlayer(p, i))) return false;
  if (!players.every((p: Player) => knownRole(p.roleId) && knownRole(p.startRoleId))) return false;
  const mayor = x['mayorSeat'];
  return (
    x['version'] === 1 &&
    typeof x['packId'] === 'string' &&
    isInt(x['seed']) &&
    isSettings(x['settings']) &&
    (mayor === null || (isInt(mayor) && mayor >= 0 && mayor < players.length)) &&
    isPhase(x['phase']) &&
    isRecord(x['packState']) &&
    Object.values(x['packState']).every((v) => v === null || ['number', 'boolean'].includes(typeof v))
  );
}

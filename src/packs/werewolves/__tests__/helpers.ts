/** Test helpers for playing nights. */
import { NO_FACTS, type NightFacts } from '@/engine/night';
import type { GameState } from '@/engine/state';
import { resolveDawn, type DawnResult } from '../dawn';
import { applyNightAction, startNightRecord, type ActionOk, type NightAction, type NightRecord } from '../nightActions';

/** Apply actions in order; any refused action fails the test with its reason. */
export function act(state: GameState, record: NightRecord, actions: NightAction[]): { state: GameState; record: NightRecord; results: ActionOk[] } {
  let s = state;
  let r = record;
  const results: ActionOk[] = [];
  for (const a of actions) {
    const out = applyNightAction(s, r, a);
    if (typeof out === 'string') throw new Error(`${a.kind} refused: ${out}`);
    s = out.state;
    r = out.record;
    results.push(out);
  }
  return { state: s, record: r, results };
}

/** Play one night: apply the actions, then resolve dawn. */
export function playNight(
  state: GameState,
  night: number,
  actions: NightAction[],
  facts: Partial<NightFacts> = {},
): DawnResult & { record: NightRecord } {
  const start = { ...state, phase: { kind: 'night' as const, night } };
  const { state: s, record } = act(start, startNightRecord(night, { ...NO_FACTS, ...facts }), actions);
  return { ...resolveDawn(s, record), record };
}

/** The refusal reason for one action, or "ok". */
export function refusal(state: GameState, action: NightAction, night = 1, record?: NightRecord): string {
  const out = applyNightAction({ ...state, phase: { kind: 'night', night } }, record ?? startNightRecord(night, NO_FACTS), action);
  return typeof out === 'string' ? out : 'ok';
}

export const deadSeats = (r: DawnResult) => r.deaths.map((d) => d.seat).sort((a, b) => a - b);

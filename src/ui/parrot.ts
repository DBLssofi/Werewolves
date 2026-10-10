/** The Parrot Wolf's word for a night (fixed per game and night, from the translation file's word list). */
import type { GameState } from '@/engine/state';
import i18n from '@/i18n';

export function parrotWord(state: GameState, night: number): string {
  const words = i18n.t('parrotWords', { returnObjects: true }) as unknown as string[];
  if (!Array.isArray(words) || words.length === 0) return '';
  return words[(state.seed + night * 7) % words.length] as string;
}

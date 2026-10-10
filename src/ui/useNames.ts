/** Names for seats, roles and engine reasons, from the translation file. */
import { useTranslation } from 'react-i18next';
import type { GameState } from '@/engine/state';

export function useNames(state?: GameState | null) {
  const { t } = useTranslation();
  const name = (seat: number) => state?.players[seat]?.name ?? t('common.seat', { n: seat + 1 });
  const role = (id: string) => t(`roles.${id}.name`, { defaultValue: t(`calls.${id}`, { defaultValue: id }) });
  const error = (code: string) => t(`errors.${code}`, { defaultValue: code });
  return { t, name, role, error };
}

import { router } from 'expo-router';
import { View } from 'react-native';
import { MAX_PLAYERS, MIN_PLAYERS, suggestedWolves } from '@/engine/setup';
import { useGame } from '@/state/GameStore';
import { Button, Counter, Gap, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

export default function Players() {
  const { t } = useNames();
  const { draft, updateDraft } = useGame();
  return (
    <Screen
      top={<TopBar title="" backLabel={t('common.back')} onBack={() => router.back()} />}
      bottom={<Button label={t('common.confirm')} onPress={() => router.push('/setup/settings')} />}
    >
      <View style={{ marginTop: 160, alignItems: 'center', gap: 24 }}>
        <Txt variant="caps" tone="muted" center>
          {t('players.title')}
        </Txt>
        <Counter
          value={draft.players}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={(players) => updateDraft({ players })}
          minusLabel={t('common.minus')}
          plusLabel={t('common.plus')}
        />
        <Txt variant="small" tone="muted" center>
          {t('players.hint', { wolves: suggestedWolves(draft.players) })}
        </Txt>
        <Gap />
      </View>
    </Screen>
  );
}

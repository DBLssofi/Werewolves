import { router } from 'expo-router';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { Button, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

export default function Mode() {
  const { t } = useNames();
  const { updateDraft } = useGame();
  return (
    <Screen top={<TopBar title="" backLabel={t('common.back')} onBack={() => router.back()} />}>
      <View style={{ marginTop: 200, gap: 40, alignItems: 'center' }}>
        <Txt variant="caps" tone="muted" center>
          {t('mode.title')}
        </Txt>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <Button
            label={t('mode.classic')}
            onPress={() => {
              updateDraft({ mode: 'classic' });
              router.push('/setup/roles');
            }}
          />
          <Txt variant="small" tone="muted">
            {t('mode.classicHint')}
          </Txt>
        </View>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <Button
            label={t('mode.custom')}
            onPress={() => {
              updateDraft({ mode: 'custom' });
              router.push('/setup/roles');
            }}
          />
          <Txt variant="small" tone="muted">
            {t('mode.customHint')}
          </Txt>
        </View>
      </View>
    </Screen>
  );
}

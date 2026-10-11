import { router } from 'expo-router';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { Button, Panel, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

export default function Instructions() {
  const game = useGame();
  const { t } = useNames(game.session?.state);
  const s = game.session?.state.settings;
  if (!s) return null;
  const summary = [
    s.discussionTimer === 'off' ? t('settings.timerOff') : `${s.discussionTimer === 'perPerson' ? t('settings.timerPerPerson') : t('settings.timerWhole')} (${s.discussionTimerSeconds}s)`,
    s.voting === 'open' ? t('settings.votingOpen') : t('settings.votingAnonymous'),
    `${t('settings.reveal')}: ${s.reveal === 'revealed' ? t('settings.revealRevealed') : t('settings.revealAnonymous')}`,
    `${t('settings.day1Tie')}: ${s.day1Tie === 'noExecution' ? t('settings.day1NoExecution') : t('settings.day1Revote')}`,
  ];
  return (
    <Screen top={<TopBar title={t('instructions.title')} backLabel={t('common.back')} />} bottom={<Button label={t('instructions.nightFalls')} onPress={() => router.replace('/game/night')} />}>
      <View style={{ marginTop: 60, gap: 16 }}>
        <Txt variant="label" tone="muted">
          {t('instructions.read')}
        </Txt>
        <Panel>
          <Txt>{t('instructions.line1')}</Txt>
          {summary.map((line) => (
            <Txt key={line} variant="small" tone="muted">
              • {line}
            </Txt>
          ))}
        </Panel>
      </View>
    </Screen>
  );
}

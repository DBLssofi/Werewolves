import { router } from 'expo-router';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { Button, Gap, Moon, Screen, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';
import { routeFor } from '@/ui/routeFor';

export default function Home() {
  const { t } = useNames();
  const game = useGame();
  const saved = game.saved;
  const alive = saved?.state.players.filter((p) => p.alive).length ?? 0;
  const phase = saved?.state.phase;
  return (
    <Screen
      moon="none"
      scroll={false}
      bottom={
        <>
          {saved && phase && phase.kind !== 'over' && (
            <>
              <Txt variant="small" tone="muted" center>
                {phase.kind === 'night' ? t('home.resumeHint', { night: phase.night, alive }) : t('home.resumeDay', { day: phase.day, alive })}
              </Txt>
              <Button
                label={t('home.resume')}
                onPress={() => {
                  game.resume();
                  router.push(routeFor(saved));
                }}
              />
              <Button kind="secondary" size="medium" label={t('home.discard')} onPress={() => void game.discard()} />
            </>
          )}
          <Button
            kind={saved ? 'secondary' : 'primary'}
            label={t('home.start')}
            onPress={() => {
              game.newGame();
              router.push('/setup/players');
            }}
          />
        </>
      }
    >
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <Moon size={190} />
        <Gap />
        <Txt variant="label" tone="muted" center>
          {t('app.tagline').toUpperCase()}
        </Txt>
        <Txt variant="title" tone="accent" center style={{ fontSize: 48 }}>
          {t('app.name').toUpperCase()}
        </Txt>
      </View>
    </Screen>
  );
}

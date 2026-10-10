import { router } from 'expo-router';
import { useState } from 'react';
import { useGame } from '@/state/GameStore';
import { SeatGrid } from '@/ui/game';
import { Button, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

export default function Mayor() {
  const game = useGame();
  const { t } = useNames(game.session?.state);
  const [picked, setPicked] = useState<number[]>([]);
  const s = game.session;
  if (!s) return null;
  const choose = (seat: number) => {
    game.run({ kind: 'setMayor', seat, how: 'elected' });
    router.replace('/game/instructions');
  };
  const alive = s.state.players.filter((p) => p.alive);
  return (
    <Screen
      top={<TopBar title={t('mayor.title')} backLabel={t('common.back')} />}
      bottom={
        <>
          <Button label={t('common.confirm')} disabled={picked.length !== 1} onPress={() => choose(picked[0] as number)} />
          <Button
            kind="secondary"
            size="medium"
            label={t('mayor.random')}
            onPress={() => choose((alive[Math.floor(Math.random() * alive.length)] ?? alive[0])!.seat)}
          />
        </>
      }
    >
      <Txt variant="small" tone="muted" center>
        {t('mayor.hint')}
      </Txt>
      <SeatGrid state={s.state} picked={picked} onChange={setPicked} />
    </Screen>
  );
}

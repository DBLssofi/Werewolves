import { router } from 'expo-router';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { useLogText } from '@/ui/game';
import { Button, Moon, Panel, Screen, Seat, Txt } from '@/ui/kit';
import { space } from '@/ui/theme';
import { useNames } from '@/ui/useNames';

export default function Over() {
  const game = useGame();
  const s = game.session;
  const { t, name, role } = useNames(s?.state);
  const logText = useLogText(s?.state);
  if (!s || s.state.phase.kind !== 'over') return null;
  const r = s.state.phase.result;
  const headline =
    r.kind === 'team' ? t(`over.team.${r.team}`) : r.kind === 'solo' ? t('over.solo', { name: name(r.seat), role: role(r.roleId) }) : t('over.draw');
  return (
    <Screen
      moon="none"
      bottom={
        <Button
          label={t('over.newGame')}
          onPress={() => {
            game.newGame();
            router.dismissAll();
            router.replace('/');
          }}
        />
      }
    >
      <View style={{ alignItems: 'center' }}>
        <Moon size={120} />
        <Txt variant="caps" tone="muted" center>
          {t('over.title')}
        </Txt>
        <Txt variant="heading" tone="accent" center>
          {headline}
        </Txt>
      </View>
      <Txt variant="caps" tone="muted">
        {t('over.roles')}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm }}>
        {s.state.players.map((p) => (
          <Seat
            key={p.seat}
            seat={p.seat}
            name={p.name}
            state={p.alive ? 'alive' : 'dead'}
            detail={p.roleId === p.startRoleId ? role(p.roleId) : `${role(p.startRoleId)} → ${role(p.roleId)}`}
          />
        ))}
      </View>
      <Txt variant="caps" tone="muted">
        {t('over.log')}
      </Txt>
      <Panel>
        {s.log.map((e, i) => (
          <Txt key={i} variant="small">
            {logText(e)}
          </Txt>
        ))}
      </Panel>
    </Screen>
  );
}

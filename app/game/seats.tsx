import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isParalysed } from '@/packs/werewolves/day';
import { useGame } from '@/state/GameStore';
import { useLogText } from '@/ui/game';
import { Button, Panel, Screen, Seat, TopBar, Txt } from '@/ui/kit';
import { space } from '@/ui/theme';
import { useNames } from '@/ui/useNames';

/** The narrator's overview: every seat with role and statuses, and the game log. */
export default function Seats() {
  const game = useGame();
  const s = game.session;
  const { t, role } = useNames(s?.state);
  const logText = useLogText(s?.state);
  const [tab, setTab] = useState<'seats' | 'log'>('seats');
  if (!s) return null;
  const status = (seat: number): string => {
    const p = s.state.players[seat];
    if (!p) return '';
    const tags = [role(p.roleId)];
    if (s.state.mayorSeat === seat) tags.push(t('seats.mayor'));
    if (isParalysed(s.state, seat)) tags.push(t('seats.paralysed'));
    if (p.loverSeat !== null) tags.push(t('seats.lover'));
    if (p.infected) tags.push(t('seats.infected'));
    if (p.memory['sheep'] === true) tags.push(t('seats.sheep'));
    if (p.cult) tags.push(t('seats.cult'));
    if (p.plagueNight !== null) tags.push(t('seats.plague'));
    return tags.join(' · ');
  };
  return (
    <Screen top={<TopBar title={t('common.menu')} backLabel={t('common.back')} onBack={() => router.back()} />}>
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
        <Button size="medium" kind={tab === 'seats' ? 'primary' : 'secondary'} label={t('seats.title')} onPress={() => setTab('seats')} />
        <Button size="medium" kind={tab === 'log' ? 'primary' : 'secondary'} label={t('seats.log')} onPress={() => setTab('log')} />
      </View>
      {tab === 'seats' &&
        s.state.players.map((p) => <Seat key={p.seat} wide seat={p.seat} name={p.name} state={p.alive ? 'alive' : 'dead'} detail={status(p.seat)} />)}
      {tab === 'log' && (
        <Panel>
          {[...s.log].reverse().map((e, i) => (
            <Txt key={i} variant="small">
              {logText(e)}
            </Txt>
          ))}
        </Panel>
      )}
    </Screen>
  );
}

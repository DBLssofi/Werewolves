import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { Button, HoldToReveal, RoleCard, Screen, Seat, TopBar, Txt } from '@/ui/kit';
import { space } from '@/ui/theme';
import { useNames } from '@/ui/useNames';

export default function Review() {
  const { t, role } = useNames();
  const { deal, startGame } = useGame();
  const [mode, setMode] = useState<'list' | 'pick' | 'show'>('list');
  const [seat, setSeat] = useState<number | null>(null);
  if (!deal) return null;

  if (mode === 'show' && seat !== null) {
    const e = deal.entries[seat];
    return (
      <Screen top={<TopBar title={e?.name ?? ''} backLabel={t('common.back')} />} bottom={<Button label={t('review.back')} onPress={() => setMode('list')} />}>
        <Txt variant="caps" tone="muted" center>
          {t('review.handOver', { name: e?.name ?? '' })}
        </Txt>
        <HoldToReveal hint={t('deal.hold')}>
          <View style={{ alignItems: 'center', gap: space.lg }}>
            <RoleCard face="revealed" size="large" roleName={role(e?.roleId ?? '').toUpperCase()} />
            <Txt center>{t(`roles.${e?.roleId}.text`)}</Txt>
          </View>
        </HoldToReveal>
      </Screen>
    );
  }

  return (
    <Screen
      top={<TopBar title={t('review.title')} backLabel={t('common.back')} />}
      bottom={
        mode === 'list' ? (
          <>
            <Button
              label={t('review.yes')}
              onPress={() => {
                startGame();
                router.replace('/game/mayor');
              }}
            />
            <Button kind="secondary" label={t('review.no')} onPress={() => setMode('pick')} />
          </>
        ) : (
          <Button kind="secondary" label={t('common.cancel')} onPress={() => setMode('list')} />
        )
      }
    >
      <Txt variant="small" tone="muted" center>
        {mode === 'list' ? t('review.hint') : t('review.pick')}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm }}>
        {deal.entries.map((e, i) => (
          <Seat
            key={i}
            seat={i}
            name={e.name}
            detail={mode === 'list' ? role(e.roleId) : undefined}
            onPress={
              mode === 'pick'
                ? () => {
                    setSeat(i);
                    setMode('show');
                  }
                : undefined
            }
          />
        ))}
      </View>
    </Screen>
  );
}

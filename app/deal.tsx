import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { confirmCard, isDealComplete, nextSeat, peekCard } from '@/engine/deal';
import { useGame } from '@/state/GameStore';
import { Button, HoldToReveal, RoleCard, Screen, TopBar, Txt } from '@/ui/kit';
import { color, radius, space, text } from '@/ui/theme';
import { useNames } from '@/ui/useNames';

type Stage = 'pass' | 'pick' | 'name' | 'reveal';

export default function DealScreen() {
  const { t } = useNames();
  const { deal, setDeal } = useGame();
  const [stage, setStage] = useState<Stage>('pass');
  const [card, setCard] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!deal) return <Screen><Txt>…</Txt></Screen>;
  const seat = nextSeat(deal);
  const total = deal.cards.length;

  if (isDealComplete(deal)) {
    return (
      <Screen bottom={<Button label={t('common.ok')} onPress={() => router.replace('/review')} />}>
        <View style={{ marginTop: 220 }}>
          <Txt variant="label" tone="muted" center>
            {t('deal.done')}
          </Txt>
        </View>
      </Screen>
    );
  }

  if (stage === 'pass') {
    return (
      <Screen
        top={<TopBar title={t('deal.seatOf', { n: seat + 1, total })} backLabel={t('common.back')} onBack={seat === 0 ? () => router.back() : undefined} />}
        bottom={<Button label={t('common.ok')} onPress={() => setStage('pick')} />}
      >
        <View style={{ marginTop: 200 }}>
          <Txt variant="label" tone="muted" center>
            {seat === 0 ? t('deal.pass') : t('deal.passNext')}
          </Txt>
        </View>
      </Screen>
    );
  }

  if (stage === 'pick') {
    return (
      <Screen top={<TopBar title={t('deal.seatOf', { n: seat + 1, total })} backLabel={t('common.back')} />} moon="none">
        <Txt variant="label" tone="muted" center>
          {t('deal.pick')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md }}>
          {deal.cards.map((_, i) =>
            deal.taken[i] ? null : (
              <RoleCard
                key={i}
                face="back"
                label={t('deal.pick')}
                onPress={() => {
                  setCard(i);
                  setName('');
                  setError(null);
                  setStage('name');
                }}
              />
            ),
          )}
        </View>
      </Screen>
    );
  }

  if (stage === 'name') {
    const submit = () => {
      if (name.trim().length === 0) return setError(t('deal.error.emptyName'));
      if (deal.entries.some((e) => e.name.toLowerCase() === name.trim().toLowerCase())) return setError(t('deal.error.nameInUse'));
      setError(null);
      setStage('reveal');
    };
    return (
      <Screen top={<TopBar title={t('deal.seatOf', { n: seat + 1, total })} backLabel={t('common.back')} onBack={() => setStage('pick')} />} bottom={<Button label={t('common.next')} onPress={submit} />}>
        <View style={{ marginTop: 160, gap: space.lg }}>
          <Txt variant="label" tone="muted" center>
            {t('deal.name')}
          </Txt>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('deal.namePlaceholder')}
            placeholderTextColor={color.textMuted}
            autoFocus
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[text.option, { color: color.textPrimary, backgroundColor: color.bgSurface, borderRadius: radius.sm, paddingHorizontal: space.lg, minHeight: 56, textAlign: 'center' }]}
          />
          {error && (
            <Txt variant="small" tone="accent" center>
              {error}
            </Txt>
          )}
        </View>
      </Screen>
    );
  }

  // reveal
  const roleId = card === null ? null : peekCard(deal, card);
  return (
    <Screen
      top={<TopBar title={name.trim()} backLabel={t('common.back')} />}
      bottom={
        <Button
          label={t('deal.confirm')}
          onPress={() => {
            if (card === null) return;
            const next = confirmCard(deal, card, name);
            if (typeof next === 'string') {
              setError(t(`deal.error.${next}`, { defaultValue: next }));
              setStage('pick');
              return;
            }
            setDeal(next);
            setCard(null);
            setStage('pass');
          }}
        />
      }
    >
      <View style={{ marginTop: 40 }}>
        <HoldToReveal hint={t('deal.hold')}>
          <RevealedRole roleId={typeof roleId === 'string' ? roleId : ''} />
        </HoldToReveal>
      </View>
    </Screen>
  );
}

function RevealedRole({ roleId }: { roleId: string }) {
  const { t, role } = useNames();
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <RoleCard face="revealed" size="large" roleName={role(roleId).toUpperCase()} />
      <Txt variant="small" tone="gold" center style={{ fontStyle: 'italic' }}>
        “{t(`roles.${roleId}.quote`)}”
      </Txt>
      <Txt center>{t(`roles.${roleId}.text`)}</Txt>
    </View>
  );
}

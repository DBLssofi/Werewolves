import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useGame } from '@/state/GameStore';
import { Button, Counter, OptionRow, Screen, TopBar, Txt } from '@/ui/kit';
import { useNames } from '@/ui/useNames';

function Group(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="caps" tone="muted">
        {props.title}
      </Txt>
      {props.children}
    </View>
  );
}

export default function Settings() {
  const { t } = useNames();
  const { draft, updateSettings } = useGame();
  const s = draft.settings;
  const [more, setMore] = useState(false);
  const pick = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => updateSettings({ [key]: value } as Partial<typeof s>);
  const counter = (key: 'discussionTimerSeconds' | 'alphaInfections' | 'forgerShields' | 'forgerSwords', min: number, max: number, step = 1) => (
    <Counter
      small
      value={s[key]}
      min={min}
      max={max}
      onChange={(n) => pick(key, step === 1 ? n : Math.round(n / step) * step)}
      minusLabel={t('common.minus')}
      plusLabel={t('common.plus')}
    />
  );
  return (
    <Screen
      top={<TopBar title={t('settings.title')} backLabel={t('common.back')} onBack={() => router.back()} />}
      bottom={<Button label={t('common.confirm')} onPress={() => router.push('/setup/mode')} />}
    >
      <View style={{ marginTop: 80, gap: 24 }}>
        <Group title={t('settings.timer')}>
          <OptionRow label={t('settings.timerOff')} selected={s.discussionTimer === 'off'} onPress={() => pick('discussionTimer', 'off')} />
          <OptionRow label={t('settings.timerPerPerson')} selected={s.discussionTimer === 'perPerson'} onPress={() => pick('discussionTimer', 'perPerson')} />
          <OptionRow label={t('settings.timerWhole')} selected={s.discussionTimer === 'wholeDiscussion'} onPress={() => pick('discussionTimer', 'wholeDiscussion')} />
          {s.discussionTimer !== 'off' && (
            <View style={{ alignItems: 'flex-start', gap: 8 }}>
              <Txt variant="small" tone="muted">
                {t('settings.timerSeconds')}
              </Txt>
              <Counter
                small
                value={s.discussionTimerSeconds}
                min={15}
                max={900}
                onChange={(n) => pick('discussionTimerSeconds', n > s.discussionTimerSeconds ? s.discussionTimerSeconds + 15 : Math.max(15, s.discussionTimerSeconds - 15))}
                minusLabel={t('common.minus')}
                plusLabel={t('common.plus')}
              />
            </View>
          )}
        </Group>
        <Group title={t('settings.voting')}>
          <OptionRow label={t('settings.votingAnonymous')} selected={s.voting === 'anonymous'} onPress={() => pick('voting', 'anonymous')} />
          <OptionRow label={t('settings.votingOpen')} selected={s.voting === 'open'} onPress={() => pick('voting', 'open')} />
        </Group>
        <Button kind="secondary" size="medium" label={more ? t('settings.less') : t('settings.more')} onPress={() => setMore(!more)} style={{ alignSelf: 'center' }} />
        {more && (
          <>
            <Group title={t('settings.reveal')}>
              <OptionRow label={t('settings.revealRevealed')} selected={s.reveal === 'revealed'} onPress={() => pick('reveal', 'revealed')} />
              <OptionRow label={t('settings.revealAnonymous')} selected={s.reveal === 'anonymous'} onPress={() => pick('reveal', 'anonymous')} />
            </Group>
            {s.voting === 'open' && (
              <Group title={t('settings.defence')}>
                <OptionRow label={t('settings.on')} selected={s.defenceSpeech} onPress={() => pick('defenceSpeech', true)} />
                <OptionRow label={t('settings.off')} selected={!s.defenceSpeech} onPress={() => pick('defenceSpeech', false)} />
              </Group>
            )}
            <Group title={t('settings.day1Tie')}>
              <OptionRow label={t('settings.day1NoExecution')} selected={s.day1Tie === 'noExecution'} onPress={() => pick('day1Tie', 'noExecution')} />
              <OptionRow label={t('settings.day1Revote')} selected={s.day1Tie === 'revote'} onPress={() => pick('day1Tie', 'revote')} />
            </Group>
            <Group title={t('settings.devil')}>
              <OptionRow label={t('settings.devilNightly')} selected={s.devilWolf === 'nightly'} onPress={() => pick('devilWolf', 'nightly')} />
              <OptionRow label={t('settings.devilPermanent')} selected={s.devilWolf === 'permanent'} onPress={() => pick('devilWolf', 'permanent')} />
            </Group>
            <Group title={t('settings.alpha')}>{counter('alphaInfections', 1, 5)}</Group>
            <Group title={t('settings.shields')}>{counter('forgerShields', 0, 5)}</Group>
            <Group title={t('settings.swords')}>{counter('forgerSwords', 0, 5)}</Group>
          </>
        )}
      </View>
    </Screen>
  );
}

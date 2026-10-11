import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import type { Announcement } from '@/packs/werewolves/dawn';
import { ghostsAtDawn } from '@/packs/werewolves/nightPlan';
import { useGame } from '@/state/GameStore';
import { GameTopBar, PromptPanel } from '@/ui/game';
import { Button, Panel, Screen, Txt } from '@/ui/kit';
import { color, radius, space, text } from '@/ui/theme';
import { useNames } from '@/ui/useNames';

export default function Dawn() {
  const game = useGame();
  const s = game.session;
  const { t, name, role, error } = useNames(s?.state);
  const [letter, setLetter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const over = s?.state.phase.kind === 'over';
  useEffect(() => {
    if (over) router.replace('/game/over');
  }, [over]);
  if (!s || s.state.phase.kind !== 'night') return null;
  const night = s.state.phase.night;
  const dawnEntry = [...s.log].reverse().find((e) => e.event.kind === 'dawn');
  const announcements: Announcement[] = dawnEntry?.event.kind === 'dawn' ? dawnEntry.event.announcements : [];
  const revealed = s.state.settings.reveal === 'revealed';

  // Step 39: players who became wolves tonight are tapped before the village wakes.
  const newWolves = s.state.players.filter(
    (p) => p.alive && (p.memory['infectedNight'] === night || (p.roleId === 'cursed' && p.memory['toldTurnedNight'] === night)),
  );
  const ghosts = ghostsAtDawn(s.state, night);
  const whispered = s.log.filter((e) => e.event.kind === 'ghostLetter' && 'night' in e.at && e.at.night === night);

  const line = (a: Announcement): string[] => {
    switch (a.kind) {
      case 'quietNight':
        return [t('dawn.quiet')];
      case 'deaths':
        if (a.deaths.length === 0) return [t('dawn.nobodyDied')];
        return a.deaths.map((d) =>
          d.plague
            ? t('dawn.plague', { name: name(d.seat) })
            : revealed
              ? t('dawn.diedRole', { name: name(d.seat), role: role(s.state.players[d.seat]?.roleId ?? '') })
              : t('dawn.died', { name: name(d.seat) }),
        );
      case 'catAttacked':
        return [t('dawn.catAttacked')];
      case 'paralysed':
        return [t('dawn.paralysed', { name: name(a.seat) })];
      case 'bear':
        return [a.growls ? t('dawn.bearGrowls') : t('dawn.bearQuiet')];
    }
  };

  return (
    <Screen
      top={<GameTopBar title={t('dawn.title')} />}
      bottom={
        <Button
          label={t('dawn.startDay')}
          disabled={s.prompts.some((p) => p.kind !== 'mayorSuccession' || p.mode === 'name')}
          onPress={() => {
            const e = game.run({ kind: 'startDay' });
            if (e) setErr(error(e));
            else router.replace('/game/day');
          }}
        />
      }
    >
      {newWolves.length > 0 && (
        <Panel>
          <Txt variant="option" tone="gold">
            {t('dawn.tapWolf', { names: newWolves.map((p) => p.name).join(', ') })}
          </Txt>
        </Panel>
      )}
      {ghosts.map((g) => {
        const said = whispered.find((e) => e.event.kind === 'ghostLetter' && e.event.seat === g);
        return (
          <Panel key={g}>
            <Txt variant="label" tone="muted">
              {t('dawn.ghost', { name: name(g) })}
            </Txt>
            {said && said.event.kind === 'ghostLetter' ? (
              <Txt variant="option" tone="gold">
                {t('dawn.ghostSay', { letter: said.event.letter })}
              </Txt>
            ) : (
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <TextInput
                  value={letter}
                  onChangeText={setLetter}
                  maxLength={2}
                  placeholder={t('dawn.ghostPlaceholder')}
                  placeholderTextColor={color.textMuted}
                  style={[text.option, { color: color.textPrimary, backgroundColor: color.bgSurface, borderRadius: radius.sm, width: 120, minHeight: 48, textAlign: 'center' }]}
                />
                <Button
                  size="medium"
                  label={t('common.confirm')}
                  onPress={() => {
                    const e = game.run({ kind: 'ghostLetter', seat: g, letter: letter.trim().toUpperCase() });
                    if (e) setErr(error(e));
                    else setLetter('');
                  }}
                />
              </View>
            )}
          </Panel>
        );
      })}
      <Txt variant="label" tone="muted">
        {t('dawn.read')}
      </Txt>
      <Panel>
        {announcements.flatMap(line).map((l, i) => (
          <Txt key={i} variant="option">
            {l}
          </Txt>
        ))}
      </Panel>
      {err && (
        <Txt tone="accent" center>
          {err}
        </Txt>
      )}
      <PromptPanel onError={(e) => setErr(error(e))} />
    </Screen>
  );
}

/** Pieces shared by the game screens: seat picker, prompt answers, log lines. */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { GameState } from '@/engine/state';
import type { Prompt } from '@/packs/werewolves/elimination';
import type { Command, LogEntry, SessionError } from '@/packs/werewolves/session';
import { useGame } from '@/state/GameStore';
import { Button, Panel, Seat, TopBar, Txt } from './kit';
import { space } from './theme';
import { useNames } from './useNames';

/** Tap players. `max` = how many can be picked (1 or 2). Dead players can't be picked unless `allowDead`. */
export function SeatGrid(props: {
  state: GameState;
  picked: number[];
  onChange: (seats: number[]) => void;
  max?: number;
  allowDead?: boolean;
  only?: number[];
  details?: (seat: number) => string | undefined;
}) {
  const { state, picked, onChange, max = 1, allowDead, only, details } = props;
  const toggle = (seat: number) => {
    if (picked.includes(seat)) return onChange(picked.filter((s) => s !== seat));
    if (max === 1) return onChange([seat]);
    onChange([...picked, seat].slice(-max));
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm }}>
      {state.players
        .filter((p) => !only || only.includes(p.seat))
        .map((p) => {
          const pickable = allowDead || p.alive;
          return (
            <Seat
              key={p.seat}
              seat={p.seat}
              name={p.name}
              detail={details?.(p.seat)}
              state={picked.includes(p.seat) ? 'selected' : p.alive ? 'alive' : 'dead'}
              onPress={pickable ? () => toggle(p.seat) : undefined}
            />
          );
        })}
    </View>
  );
}

/** The game's top bar: back = undo one step, menu = seats and log. */
export function GameTopBar({ title }: { title: string }) {
  const { t } = useNames();
  const game = useGame();
  return (
    <TopBar
      title={title}
      backLabel={t('common.undo')}
      onBack={game.canUndo ? () => game.back() : undefined}
      menuLabel={t('common.menu')}
      onMenu={() => router.push('/game/seats')}
    />
  );
}

/** Answer the pending prompts (Hunter's shot, Cat, Sheep, mayor). */
export function PromptPanel({ onError }: { onError: (e: SessionError) => void }) {
  const { t, name } = useNames(useGame().session?.state);
  const game = useGame();
  const s = game.session;
  const [picked, setPicked] = useState<number[]>([]);
  const prompt = s?.prompts[0];
  if (!s || !prompt) return null;
  const label = promptLabel(prompt, name, t);
  const command = (target: number): Command => {
    switch (prompt.kind) {
      case 'hunterShot':
        return { kind: 'hunterShot', seat: prompt.seat, target };
      case 'catScratchNow':
        return { kind: 'catScratchNow', seat: prompt.seat, target };
      case 'sheepNames':
        return { kind: 'nameSheep', seat: prompt.seat, target };
      case 'mayorSuccession':
        return { kind: 'setMayor', seat: target, how: prompt.mode === 'name' ? 'named' : 'elected' };
    }
  };
  return (
    <Panel>
      <Txt variant="option">{label}</Txt>
      <SeatGrid state={s.state} picked={picked} onChange={setPicked} />
      <Button
        label={t('common.confirm')}
        disabled={picked.length !== 1}
        onPress={() => {
          const e = game.run(command(picked[0] as number));
          if (e) onError(e);
          else setPicked([]);
        }}
      />
    </Panel>
  );
}

function promptLabel(p: Prompt, name: (s: number) => string, t: ReturnType<typeof useNames>['t']): string {
  switch (p.kind) {
    case 'hunterShot':
      return t('dawn.prompt.hunterShot', { name: name(p.seat) });
    case 'catScratchNow':
      return t('dawn.prompt.catScratchNow', { name: name(p.seat) });
    case 'sheepNames':
      return t('dawn.prompt.sheepNames', { name: name(p.seat) });
    case 'mayorSuccession':
      return p.mode === 'name' ? t('dawn.prompt.mayorName', { name: name(p.seat) }) : t('dawn.prompt.mayorElection');
  }
}

/** One readable line per log entry. */
export function useLogText(state: GameState | undefined) {
  const { t, name, role } = useNames(state);
  const deaths = (ds: { seat: number; cause: string }[]) =>
    ds.length === 0 ? t('log.none') : ds.map((d) => `${name(d.seat)} (${t(`log.cause.${d.cause}`)})`).join(', ');
  return (entry: LogEntry): string => {
    const e = entry.event;
    const when = 'night' in entry.at ? t('night.title', { n: entry.at.night }) : t('day.title', { n: entry.at.day });
    let line: string;
    switch (e.kind) {
      case 'nightStart':
        line = t('log.nightStart');
        break;
      case 'dayStart':
        line = t('log.dayStart');
        break;
      case 'mayor':
        line = e.seat === null ? t('log.mayorNone') : t('log.mayor', { name: name(e.seat) });
        break;
      case 'nightAction': {
        const a = e.action;
        const who = 'seat' in a ? `${name(a.seat)} (${role(state?.players[a.seat]?.roleId ?? '')})` : t('calls.pack');
        const targets = ['target', 'a', 'b'].filter((k) => k in a).map((k) => name((a as unknown as Record<string, number>)[k] as number));
        const answer = e.result.answer ? ` · ${t(`night.answer.${e.result.answer}`)}` : e.result.failed ? ` · ${t('night.failed')}` : '';
        line = t('log.action', { who, what: `${t(`forms.${formOf(a.kind, a)}`, { defaultValue: a.kind })} ${targets.join(' + ')}${answer}` });
        break;
      }
      case 'dawn':
        line = t('log.dawn', { deaths: deaths(e.deaths) });
        break;
      case 'ghostLetter':
        line = t('log.ghostLetter', { letter: e.letter });
        break;
      case 'hunterShot':
        line = t('log.hunterShot', { name: name(e.seat), target: name(e.target) });
        break;
      case 'catScratch':
        line = t('log.catScratch', { name: name(e.seat), target: name(e.target) });
        break;
      case 'sheepNamed':
        line = t('log.sheepNamed', { from: name(e.from), to: name(e.to) });
        break;
      case 'ravenMark':
        line = t('log.ravenMark', { target: e.target === null ? t('log.none') : name(e.target) });
        break;
      case 'judge':
        line = t('log.judge');
        break;
      case 'coup':
        line = `${t('log.coup', { target: name(e.target) })} · ${deaths(e.deaths)}`;
        break;
      case 'parrotRemoved':
        line = t('log.parrotRemoved');
        break;
      case 'ruleBreak':
        line = t('log.ruleBreak', { name: name(e.seat) });
        break;
      case 'vote':
        line = t('log.vote', { result: e.totals.map(([seat, n]) => `${name(seat)} ${n}`).join(', ') });
        break;
      case 'execution':
        line = t('log.execution', { deaths: deaths(e.deaths) });
        break;
      case 'gameOver':
        line = t('log.gameOver');
        break;
    }
    return `${when} · ${line}`;
  };
}

/** The form label key for a logged action. */
function formOf(kind: string, a: object): string {
  if (kind === 'forge') return (a as { item: string }).item === 'shield' ? 'forgeShield' : 'forgeSword';
  if (kind === 'packVictim') return (a as { infect: boolean }).infect ? 'packInfect' : 'packVictim';
  if (kind === 'puppet') return (a as { mode: string }).mode === 'sight' ? 'puppetSight' : 'puppetPoison';
  return kind;
}

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { isNoVoteDay, isParalysed, voters } from '@/packs/werewolves/day';
import type { Command } from '@/packs/werewolves/session';
import { useGame } from '@/state/GameStore';
import { GameTopBar, PromptPanel, SeatGrid } from '@/ui/game';
import { Button, Counter, Panel, Screen, Seat, Txt } from '@/ui/kit';
import { space } from '@/ui/theme';
import { useNames } from '@/ui/useNames';
import { parrotWord } from '@/ui/parrot';

type Power = 'raven' | 'dictator' | 'ruleBreak' | null;

export default function Day() {
  const game = useGame();
  const s = game.session;
  const { t, name, error } = useNames(s?.state);
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [voter, setVoter] = useState<number | null>(null);
  const [penalties, setPenalties] = useState<Record<number, number>>({});
  const [power, setPower] = useState<Power>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [offence, setOffence] = useState<'role' | 'oath' | 'peek'>('role');
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const over = s?.state.phase.kind === 'over';
  useEffect(() => {
    if (over) router.replace('/game/over');
  }, [over]);
  // A new vote (revote) starts with an empty ballot.
  const revoteKey = s?.revote?.join(',') ?? '';
  useEffect(() => {
    setVotes({});
    setVoter(null);
  }, [revoteKey]);

  if (!s || s.state.phase.kind !== 'day') return null;
  const state = s.state;
  const day = state.phase.kind === 'day' ? state.phase.day : 0;
  const tied = s.revote ?? [];
  const mustVote = voters(state, tied);
  const voted = s.votedDay === day;
  const noVote = isNoVoteDay(state);
  const alive = (roleId: string) => state.players.find((p) => p.alive && p.roleId === roleId && !p.abilitiesRemoved);
  const raven = alive('raven');
  const judge = alive('judge');
  const dictator = alive('dictator');
  const parrot = state.players.find((p) => p.alive && p.roleId === 'parrot_wolf');
  const paralysedSeat = state.players.find((p) => p.alive && isParalysed(state, p.seat))?.seat;

  const run = (c: Command) => {
    const e = game.run(c);
    if (e) {
      setErr(error(e));
      return false;
    }
    setErr(null);
    return true;
  };

  // Running totals: real votes (mayor ×2 unless tied) for the defence threshold.
  const real: Record<number, number> = {};
  for (const [v, target] of Object.entries(votes)) {
    const weight = Number(v) === state.mayorSeat && !tied.includes(Number(v)) ? 2 : 1;
    real[target] = (real[target] ?? 0) + weight;
  }
  const lastVote = [...s.log].reverse().find((e) => e.event.kind === 'vote');
  const resultText = (() => {
    if (!lastVote || lastVote.event.kind !== 'vote' || !('day' in lastVote.at) || lastVote.at.day !== day) return null;
    const r = lastVote.event.result;
    if (r.kind === 'execute') return t('day.executed', { name: name(r.seat) });
    if (r.kind === 'sheep') return t('day.sheep', { name: name(r.seat) });
    if (r.kind === 'revote') return t('day.tie', { names: r.tied.map(name).join(', ') });
    return t('day.noExecution');
  })();

  const blockingPrompts = s.prompts.some((p) => p.kind !== 'mayorSuccession' || p.mode === 'name');

  return (
    <Screen
      top={<GameTopBar title={t('day.title', { n: day })} />}
      bottom={
        <Button
          label={t('day.nightFalls')}
          disabled={blockingPrompts || s.revote !== null || (!voted && !noVote)}
          onPress={() => {
            if (run({ kind: 'endDay' })) router.replace('/game/night');
          }}
        />
      }
    >
      <Txt variant="small" tone="muted">
        {state.mayorSeat === null ? t('day.noMayor') : t('day.speaking')}
      </Txt>
      {paralysedSeat !== undefined && (
        <Txt variant="small" tone="gold">
          {t('dawn.paralysed', { name: name(paralysedSeat) })}
        </Txt>
      )}

      {/* Day powers, before the vote */}
      {!voted && !s.revote && (
        <Panel>
          <Txt variant="caps" tone="muted">
            {t('day.powers')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {raven && <Button size="medium" kind={power === 'raven' ? 'primary' : 'secondary'} label={t('day.raven')} onPress={() => setPower('raven')} />}
            {judge && !noVote && <Button size="medium" kind="secondary" label={t('day.judge')} onPress={() => run({ kind: 'judge', seat: judge.seat })} />}
            {dictator && !noVote && <Button size="medium" kind={power === 'dictator' ? 'primary' : 'secondary'} label={t('day.dictator')} onPress={() => setPower('dictator')} />}
            <Button size="medium" kind={power === 'ruleBreak' ? 'primary' : 'secondary'} label={t('day.ruleBreak')} onPress={() => setPower('ruleBreak')} />
          </View>
          {parrot && !noVote && (
            <>
              <Txt variant="small" tone="gold">
                {t('day.parrot')} ({parrotWord(state, day)})
              </Txt>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button size="medium" kind="secondary" label={t('day.parrotSaid')} onPress={() => setNotice(t('day.parrotSaid'))} />
                <Button size="medium" kind="secondary" label={t('day.parrotNot')} onPress={() => run({ kind: 'parrotCheck', said: false })} />
              </View>
            </>
          )}
          {power && (
            <>
              {power === 'ruleBreak' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {(['role', 'oath', 'peek'] as const).map((o) => (
                    <Button key={o} size="medium" kind={offence === o ? 'primary' : 'secondary'} label={t(`day.offence.${o}`)} onPress={() => setOffence(o)} />
                  ))}
                </View>
              )}
              <SeatGrid state={state} picked={picked} onChange={setPicked} />
              <Button
                size="medium"
                label={t('common.confirm')}
                disabled={picked.length !== 1}
                onPress={() => {
                  const target = picked[0] as number;
                  const ok =
                    power === 'raven' && raven
                      ? run({ kind: 'ravenMark', seat: raven.seat, target })
                      : power === 'dictator' && dictator
                        ? run({ kind: 'coup', seat: dictator.seat, target })
                        : run({ kind: 'ruleBreak', seat: target, offence });
                  if (ok) {
                    setPower(null);
                    setPicked([]);
                  }
                }}
              />
            </>
          )}
        </Panel>
      )}

      {noVote && !voted && (
        <Txt variant="option" tone="gold">
          {t('day.noVoteToday')}
        </Txt>
      )}

      {/* The vote */}
      {!voted && !noVote && !blockingPrompts && (
        <Panel>
          <Txt variant="caps" tone="muted">
            {s.revote ? t('day.revoteTitle') : t('day.voteTitle')}
          </Txt>
          {mustVote.map((v) => (
            <Seat
              key={v}
              wide
              seat={v}
              name={name(v)}
              state={voter === v ? 'selected' : 'alive'}
              detail={votes[v] !== undefined ? `${t('day.votesFor')} ${name(votes[v] as number)}` : undefined}
              onPress={() => setVoter(v)}
            />
          ))}
          {voter !== null && (
            <>
              <Txt variant="caps" tone="gold">
                {name(voter)} {t('day.votesFor')}
              </Txt>
              <SeatGrid
                state={state}
                picked={votes[voter] !== undefined ? [votes[voter] as number] : []}
                only={tied.length > 0 ? tied : undefined}
                onChange={(p) => {
                  const target = p[0];
                  if (target === undefined) return;
                  const next = { ...votes, [voter]: target };
                  setVotes(next);
                  const nextVoter = mustVote.find((x) => next[x] === undefined);
                  setVoter(nextVoter ?? null);
                  if (state.settings.voting === 'open' && state.settings.defenceSpeech && (real[target] ?? 0) < 3) {
                    const after = (real[target] ?? 0) + (voter === state.mayorSeat && !tied.includes(voter) ? 2 : 1);
                    if (after >= 3) setNotice(t('day.defence', { name: name(target) }));
                  }
                }}
                details={(seat) => (real[seat] ? `${t('day.totals')}: ${real[seat]}` : undefined)}
              />
            </>
          )}
          {paralysedSeat !== undefined && !s.revote && (
            <View style={{ gap: space.sm }}>
              <Txt variant="small" tone="muted">
                {t('day.penalty')}: {name(paralysedSeat)}
              </Txt>
              <Counter
                small
                value={penalties[paralysedSeat] ?? 0}
                min={0}
                max={20}
                onChange={(n) => setPenalties({ ...penalties, [paralysedSeat]: n })}
                minusLabel={t('common.minus')}
                plusLabel={t('common.plus')}
              />
            </View>
          )}
          <Button
            label={t('day.submit')}
            disabled={mustVote.some((v) => votes[v] === undefined)}
            onPress={() => {
              const list = mustVote.map((v) => ({ voter: v, target: votes[v] as number }));
              if (run({ kind: 'vote', votes: list, penalties: s.revote ? {} : penalties })) {
                setVotes({});
                setPenalties({});
                setNotice(null);
              }
            }}
          />
        </Panel>
      )}

      {notice && (
        <Txt variant="option" tone="gold" center>
          {notice}
        </Txt>
      )}
      {resultText && (
        <Panel>
          <Txt variant="option">{resultText}</Txt>
        </Panel>
      )}
      {err && (
        <Txt tone="accent" center>
          {err}
        </Txt>
      )}
      <PromptPanel onError={(e) => setErr(error(e))} />
    </Screen>
  );
}

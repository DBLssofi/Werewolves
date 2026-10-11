import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NightCall } from '@/engine/night';
import type { GameState } from '@/engine/state';
import { callSpec, toAction, type CallForm } from '@/packs/werewolves/callForms';
import { MEM } from '@/packs/werewolves/memory';
import { actingRole, foolOffer, witchSees } from '@/packs/werewolves/nightActions';
import { roleLinks } from '@/packs/werewolves/roleChange';
import { callKey, currentCalls, currentTaps, type Session } from '@/packs/werewolves/session';
import { useGame } from '@/state/GameStore';
import { GameTopBar, SeatGrid } from '@/ui/game';
import { Button, Panel, Screen, Txt } from '@/ui/kit';
import { color, space } from '@/ui/theme';
import { useNames } from '@/ui/useNames';
import { parrotWord } from '@/ui/parrot';

type Item =
  | { key: string; kind: 'taps' }
  | { key: string; kind: 'aloud'; call: NightCall }
  | { key: string; kind: 'pack'; call: NightCall }
  | { key: string; kind: 'holder'; call: NightCall; seat: number; acting: boolean };

/** Tonight's to-do list, rebuilt after every action (a prayer or a jail changes later calls). */
function items(s: Session): Item[] {
  const list: Item[] = [];
  const night = s.night?.night ?? 0;
  const wildChildren = s.state.players.filter((p) => p.alive && p.roleId === 'wild_child' && p.memory['toldTurnedNight'] === night);
  if (currentTaps(s).length > 0 || wildChildren.length > 0) list.push({ key: '0:taps', kind: 'taps' });
  for (const call of currentCalls(s)) {
    if (call.aloudOnly) list.push({ key: callKey(call), kind: 'aloud', call });
    else if (call.callId === 'pack') list.push({ key: callKey(call), kind: 'pack', call });
    else {
      for (const seat of call.acting) list.push({ key: callKey(call, seat), kind: 'holder', call, seat, acting: true });
      for (const seat of call.crossed) list.push({ key: callKey(call, seat), kind: 'holder', call, seat, acting: false });
    }
  }
  return list;
}

export default function Night() {
  const game = useGame();
  const s = game.session;
  const { t, name, role, error } = useNames(s?.state);
  const [picked, setPicked] = useState<number[]>([]);
  const [form, setForm] = useState<CallForm | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const todo = s ? items(s).filter((i) => !s.nightDone.includes(i.key)) : [];
  const item = todo[0];
  const itemKey = item?.key ?? 'end';
  useEffect(() => {
    setPicked([]);
    setForm(null);
    setSubmitted(false);
    setErr(null);
  }, [itemKey]);

  if (!s || !s.night) {
    return (
      <Screen>
        <Button label={t('common.continue')} onPress={() => router.replace('/game/dawn')} />
      </Screen>
    );
  }
  const night = s.night.night;
  const state = s.state;

  const finish = (seats: number[]) => {
    if (seats.length > 0) game.run({ kind: 'markWoken', seats });
    game.run({ kind: 'callDone', key: itemKey });
  };

  // ── all calls done ──
  if (!item) {
    return (
      <Screen
        top={<GameTopBar title={t('night.title', { n: night })} />}
        bottom={
          <Button
            label={t('night.resolve')}
            onPress={() => {
              const e = game.run({ kind: 'resolveDawn' });
              if (e) setErr(error(e));
              else router.replace('/game/dawn');
            }}
          />
        }
      >
        <View style={{ marginTop: 160 }}>
          <Txt variant="label" tone="muted" center>
            {t('night.nobodyActs')}
          </Txt>
        </View>
      </Screen>
    );
  }

  // ── step 0 taps ──
  if (item.kind === 'taps') {
    const wildChildren = state.players.filter((p) => p.alive && p.roleId === 'wild_child' && p.memory['toldTurnedNight'] === night);
    return (
      <Screen top={<GameTopBar title={t('night.title', { n: night })} />} bottom={<Button label={t('common.next')} onPress={() => finish([])} />}>
        <Txt variant="label" tone="muted">
          {t('night.taps')}
        </Txt>
        <Panel>
          {currentTaps(s).map((tap) => (
            <Txt key={`${tap.seat}${tap.kind}`}>
              {tap.kind === 'newRole'
                ? t('night.tapRole', { name: name(tap.seat), role: role(tap.roleId) })
                : t('night.tapShadow', { name: name(tap.seat), powers: tap.powers.map(role).join(', ') })}
            </Txt>
          ))}
          {wildChildren.map((p) => (
            <Txt key={`wc${p.seat}`}>{t('dawn.tapWolf', { names: p.name })}</Txt>
          ))}
        </Panel>
      </Screen>
    );
  }

  const call = item.call;
  const callName = call.callId === 'pack' ? t('calls.pack') : call.callId === 'swordHolder' ? t('calls.swordHolder') : role(call.callId);
  const script =
    call.callId === 'pack' ? t('calls.packScript') : call.callId === 'swordHolder' ? t('calls.swordHolderScript') : t(`roles.${call.callId}.script`, { defaultValue: '' });

  // ── a dead role in an Anonymous game: call aloud, nobody wakes ──
  if (item.kind === 'aloud') {
    return (
      <Screen top={<GameTopBar title={callName} />} bottom={<Button label={t('common.next')} onPress={() => finish([])} />}>
        <Txt variant="heading">{callName}</Txt>
        <Txt tone="gold">{script}</Txt>
        <Txt variant="label" tone="muted">
          {t('night.aloud')}
        </Txt>
      </Screen>
    );
  }

  const seat = item.kind === 'holder' ? item.seat : undefined;
  const acting = item.kind === 'pack' ? call.acting.length > 0 : item.acting;
  const holder = seat === undefined ? undefined : state.players[seat];
  const copying = holder && holder.roleId === 'doppelganger' && call.callId !== 'doppelganger';
  const title = copying ? t('night.asRole', { role: role('doppelganger'), copied: callName }) : callName;
  const woken = item.kind === 'pack' ? [...call.acting, ...call.crossed] : [seat as number];
  const spec = callSpec(call.callId, { state, night, step: call.step, seat });
  // On a Priest night the wolves wake without a victim.
  const forms = acting && call.restriction !== 'noKill' ? spec.forms : [];
  const activeForm = form ?? (forms.length === 1 ? forms[0] ?? null : null);
  const done = submitted && !activeForm?.repeatable;
  // The pack must choose a victim and a Cat must scratch a wolf: no skipping (Role Compendium).
  const mustAct = forms.length > 0 && (call.callId === 'pack' || call.callId === 'cat');

  const submit = (roleId?: string) => {
    if (!activeForm) return;
    const action = toAction(activeForm.id, seat ?? -1, picked, roleId);
    const e = game.run({ kind: 'nightAction', action });
    if (e) return setErr(error(e));
    setErr(null);
    setPicked([]);
    setSubmitted(true);
  };

  return (
    <Screen
      top={<GameTopBar title={t('night.title', { n: night })} />}
      bottom={
        <>
          {acting && activeForm && !done && activeForm.input !== 'role' && (
            <Button
              label={t('common.confirm')}
              disabled={picked.length !== (activeForm.input === 'two' ? 2 : activeForm.input === 'one' ? 1 : 0)}
              onPress={() => submit()}
            />
          )}
          {!(mustAct && !done) && (
            <Button kind={done || !acting || forms.length === 0 ? 'primary' : 'secondary'} label={done || !acting || forms.length === 0 ? t('common.next') : t('night.skip')} onPress={() => finish(woken)} />
          )}
        </>
      }
    >
      <Txt variant="heading">{title}</Txt>
      <Txt tone="gold">{script}</Txt>
      <Panel>
        <Txt variant="label" tone="muted">
          {acting ? t('night.acting') : t('night.crossed')}
        </Txt>
        <Txt variant="option">{woken.map(name).join(', ')}</Txt>
        {item.kind === 'pack' && call.crossed.length > 0 && acting && (
          <Txt variant="small" tone="muted">
            {t('night.crossed')}: {call.crossed.map(name).join(', ')}
          </Txt>
        )}
      </Panel>
      {acting && <Info s={s} call={call} seat={seat} />}
      {acting && forms.length > 1 && !done && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {forms.map((f) => (
            <Button key={f.id} size="medium" kind={activeForm?.id === f.id ? 'primary' : 'secondary'} label={t(`forms.${f.id}`)} onPress={() => setForm(f)} />
          ))}
        </View>
      )}
      {acting && activeForm && !done && (
        <>
          <Txt variant="label" tone="muted">
            {activeForm.input === 'role' ? t('night.pickRole') : activeForm.input === 'two' ? t('night.pickTwo') : activeForm.input === 'one' ? `${t(`forms.${activeForm.id}`)} · ${t('night.pickOne')}` : t(`forms.${activeForm.id}`)}
          </Txt>
          {activeForm.input === 'role' && seat !== undefined && (
            <View style={{ gap: space.sm }}>
              {foolOffer(state, seat).map((id) => (
                <Button key={id} kind="secondary" label={role(id)} onPress={() => submit(id)} />
              ))}
            </View>
          )}
          {(activeForm.input === 'one' || activeForm.input === 'two') && (
            <SeatGrid
              state={state}
              picked={picked}
              onChange={setPicked}
              max={activeForm.input === 'two' ? 2 : 1}
              only={item.kind === 'pack' && activeForm.id !== 'littleGirlCaught' ? notPack(state, woken) : undefined}
            />
          )}
          {activeForm.input === 'none' && <Button label={t(`forms.${activeForm.id}`)} onPress={() => submit()} />}
        </>
      )}
      {err && (
        <Txt tone="accent" center>
          {err}
        </Txt>
      )}
      {submitted && <LastResult />}
    </Screen>
  );
}

/** The pack can't attack its own: everyone who woke with it (and a sleeping Dream Wolf) is left out. */
function notPack(state: GameState, pack: number[]): number[] {
  return state.players
    .filter((p) => p.alive && !pack.includes(p.seat) && p.roleId !== 'dream_wolf' && !p.infected && !p.turned)
    .map((p) => p.seat);
}

/** What the narrator shows or points out before the choice. */
function Info({ s, call, seat }: { s: Session; call: NightCall; seat?: number }) {
  const { t, name, role } = useNames(s.state);
  const state = s.state;
  const night = s.night?.night ?? 0;
  const spec = callSpec(call.callId);
  const lines: string[] = [];
  const holder = seat === undefined ? undefined : state.players[seat];
  const acting = holder ? actingRole(holder, night) : call.callId;
  if (acting === 'witch' || (acting === 'triple_face' && night === 2)) {
    const victim = s.night ? witchSees(state, s.night) : null;
    lines.push(victim === null ? t('night.witchSeesNobody') : t('night.witchSees', { name: name(victim) }));
  }
  if (call.callId === 'pack' && state.players.some((p) => p.alive && p.roleId === 'alpha_wolf')) lines.push(t('calls.alpha'));
  if (spec.info === 'packMeets' && night === 1) {
    lines.push(t('night.packMeets'));
    const dream = state.players.find((p) => p.alive && p.roleId === 'dream_wolf' && p.memory[MEM.awake] !== true);
    if (dream) lines.push(t('night.dreamWolf', { name: dream.name }));
  }
  if (spec.info === 'linked' && seat !== undefined) {
    const links = roleLinks(state, seat);
    if (links.length > 0) lines.push(t('night.linked', { names: links.map(name).join(', ') }));
  }
  if (spec.info === 'wolves') {
    const wolves = state.players.filter((p) => p.alive && (p.infected || p.turned || (p.team === 'werewolf' && p.roleId !== 'minion'))).map((p) => p.name);
    lines.push(t('night.linked', { names: wolves.join(', ') }));
  }
  if (spec.info === 'seer') {
    const seers = state.players.filter((p) => p.alive && p.roleId === 'seer').map((p) => p.name);
    lines.push(t('night.linked', { names: seers.join(', ') }));
  }
  if (spec.info === 'word') lines.push(t('night.word', { word: parrotWord(state, night) }));
  if (spec.info === 'secretSign') lines.push(t('night.secretSign'));
  if (lines.length === 0) return null;
  return (
    <Panel>
      {lines.map((l) => (
        <Txt key={l} variant="option" tone="gold">
          {l}
        </Txt>
      ))}
    </Panel>
  );
}

/** The result of the last action, read from the log (answers, cards to show, failures). */
function LastResult() {
  const game = useGame();
  const s = game.session;
  const { t, name, role } = useNames(s?.state);
  const last = s?.log[s.log.length - 1]?.event;
  if (!last || last.kind !== 'nightAction') return null;
  const r = last.result;
  const lines: string[] = [];
  if (r.answer) lines.push(t(`night.meaning.${last.action.kind}.${r.answer}`, { defaultValue: t(`night.answer.${r.answer}`) }));
  if (r.group) lines.push(t('night.group', { names: r.group.map(name).join(', ') }));
  if (r.failed) lines.push(t('night.failed'));
  if (r.shownRole && !r.failed) lines.push(t('night.shown', { role: role(r.shownRole) }));
  if (r.linked && r.linked.length > 0) lines.push(t('night.linked', { names: r.linked.map(name).join(', ') }));
  if (r.tapped !== undefined) lines.push(t('night.tapped', { name: name(r.tapped) }));
  if (lines.length === 0) lines.push(t('common.done'));
  return (
    <Panel style={{ borderColor: color.selected }}>
      {lines.map((l) => (
        <Txt key={l} variant="option" tone="gold">
          {l}
        </Txt>
      ))}
    </Panel>
  );
}

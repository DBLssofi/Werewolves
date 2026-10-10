/**
 * Dawn: resolving the night (Narrator Guide, section 4, R0–R9).
 * Pure function: takes the state and the night's record, returns the new state,
 * the deaths, the announcements in reading order, the prompts, and the winner if any.
 */
import { isWolf, neighbours, type GameState, type Player, type WinResult } from '@/engine/state';
import { eliminate, weakestWolf, type Death, type DeathCause, type Prompt } from './elimination';
import { MEM, PACK, holdsWolfPower, seatList } from './memory';
import { patchMemory, patchPlayer, recheckLovers } from './roleChange';
import type { NightRecord } from './nightActions';
import { getRole } from './roles';
import { checkWinner } from './win';

type AttackSource = 'pack' | 'loneHunt' | 'poison' | 'sword' | 'hero' | 'thug';

interface Attack {
  source: AttackSource;
  target: number;
  infect: boolean;
  /** Who made the attack (for the Avenger Wolf: who poisoned). */
  by: number | null;
}

export type Announcement =
  | { kind: 'quietNight' }
  | { kind: 'deaths'; deaths: { seat: number; plague: boolean }[] }
  | { kind: 'catAttacked' }
  | { kind: 'paralysed'; seat: number }
  | { kind: 'bear'; growls: boolean };

export interface DawnResult {
  state: GameState;
  deaths: Death[];
  announcements: Announcement[];
  prompts: Prompt[];
  winner: WinResult | null;
}

const flag = (p: Player, key: string) => p.memory[key] === true;
const num = (p: Player, key: string) => (typeof p.memory[key] === 'number' ? (p.memory[key] as number) : null);

export function resolveDawn(state: GameState, record: NightRecord): DawnResult {
  const night = record.night;
  const prayed = record.facts.prayed;
  let s = state;
  const unstoppable: Death[] = [];
  const announcements: Announcement[] = [];
  let catAttacked = false;

  // ── R1: gather the night attacks and apply the Troublemaker's swap ──
  const attacks: Attack[] = [];
  if (record.pack && !prayed) attacks.push({ source: 'pack', target: record.pack.target, infect: record.pack.infect, by: null });
  if (record.loneHunt && !prayed) attacks.push({ source: 'loneHunt', target: record.loneHunt.target, infect: false, by: record.loneHunt.wolf });
  for (const pz of record.poisons) attacks.push({ source: 'poison', target: pz.target, infect: false, by: pz.by });
  for (const sw of record.swordStrikes) attacks.push({ source: 'sword', target: sw.target, infect: false, by: sw.holder });
  for (const h of record.heroStrike) attacks.push({ source: 'hero', target: h.target, infect: false, by: h.hero });
  for (const t of record.thugStrike) attacks.push({ source: 'thug', target: t.target, infect: false, by: t.thug });
  for (const [a, b] of record.swap) {
    for (const at of attacks) {
      if (at.target === a) at.target = b;
      else if (at.target === b) at.target = a;
    }
  }

  // An infection attempt spends the Alpha's use, whatever happens to it.
  if (record.pack?.infect && !prayed) {
    const by = record.pack.by ?? s.players.find((p) => p.alive && p.roleId === 'alpha_wolf')?.seat;
    const infecter = by === undefined ? undefined : s.players[by];
    if (infecter) s = patchMemory(s, infecter.seat, { infectionsUsed: (num(infecter, 'infectionsUsed') ?? 0) + 1 });
  }

  // ── R2: each attack through the attack order ──
  const landed: { seat: number; source: AttackSource; by: number | null }[] = [];
  let trapB = false;

  const resolve = (at: Attack, seat: number, redirected: boolean): void => {
    const t = s.players[seat];
    if (!t || !t.alive) return;
    if (prayed) return;
    if (t.roleId === 'prince' && !t.abilitiesRemoved) return;
    if (record.facts.jailed.includes(seat)) return;
    if (record.protect.includes(seat)) return;
    if ((num(t, MEM.shields) ?? 0) > 0) {
      s = patchMemory(s, seat, { [MEM.shields]: (num(t, MEM.shields) ?? 0) - 1 });
      return;
    }
    const guard = redirected ? undefined : record.guard.find((g) => g.target === seat && g.knight !== seat);
    if (guard) {
      resolve(at, guard.knight, true);
      return;
    }
    const fromPack = at.source === 'pack';
    if (fromPack && t.roleId === 'wise' && !t.abilitiesRemoved && !flag(t, 'lifeUsed')) {
      s = patchMemory(s, seat, { lifeUsed: true });
      return;
    }
    if (fromPack) {
      const witcher = s.players.find(
        (w) => w.roleId === 'witcher' && num(w, MEM.trapSeat) === seat && !flag(w, MEM.trapFired) && !w.abilitiesRemoved,
      );
      if (witcher) {
        s = patchMemory(s, witcher.seat, { [MEM.trapFired]: true });
        trapB = true;
        return;
      }
    }
    if (fromPack && t.roleId === 'cursed' && !t.turned && !t.abilitiesRemoved) {
      s = patchPlayer(s, seat, { turned: true, team: t.team === 'lovers' ? 'lovers' : 'werewolf' });
      s = patchMemory(s, seat, { toldTurnedNight: night });
      s = recheckLovers(s, seat);
      return;
    }
    if (fromPack && t.roleId === 'cat' && !flag(t, 'catAttacked') && !t.abilitiesRemoved) {
      s = patchMemory(s, seat, { catAttacked: true, [MEM.scratchPending]: true, [MEM.scratchNight]: night + 1 });
      catAttacked = true;
      return;
    }
    if (fromPack && at.infect) {
      const isWolfAlready = isWolf(t, getRole) || t.roleId === 'lonely_wolf';
      if (!isWolfAlready) {
        s = patchPlayer(s, seat, { infected: true, team: t.team === 'lovers' ? 'lovers' : 'werewolf' });
        s = patchMemory(s, seat, { infectedNight: night });
        if (t.roleId === 'wise') s = patchMemory(s, seat, { wisePassiveLost: true });
        if (t.roleId === 'diseased') s = { ...s, packState: { ...s.packState, [PACK.wolvesSickNight]: night + 1 } };
        s = recheckLovers(s, seat);
      }
      return;
    }
    landed.push({ seat, source: at.source, by: at.by });
  };

  for (const at of attacks) resolve(at, at.target, false);

  // ── R3: the Witch's heal cancels a landed pack kill on the player she healed ──
  const healed = new Set(record.heal.map((h) => h.target));
  const finalLanded = landed.filter((l) => !(l.source === 'pack' && healed.has(l.seat)));
  const packLandedOn = new Set(finalLanded.filter((l) => l.source === 'pack').map((l) => l.seat));

  // ── R4: unstoppable deaths ──
  for (const h of record.heroStrike) unstoppable.push({ seat: h.hero, cause: 'heroSelf' });
  for (const c of record.catScratch) {
    unstoppable.push({ seat: c.target, cause: 'catScratch' });
    unstoppable.push({ seat: c.cat, cause: 'catScratch' });
    s = patchMemory(s, c.cat, { [MEM.scratchPending]: false });
  }
  for (const w of s.players.filter((x) => x.roleId === 'witcher' && !flag(x, MEM.trapFired) && !x.abilitiesRemoved)) {
    const trapped = num(w, MEM.trapSeat);
    const tp = trapped === null ? undefined : s.players[trapped];
    if (tp && tp.alive && (isWolf(tp, getRole) || tp.roleId === 'lonely_wolf')) {
      s = patchMemory(s, w.seat, { [MEM.trapFired]: true });
      unstoppable.push({ seat: tp.seat, cause: 'trap' });
    }
  }
  if (trapB) {
    const victim = weakestWolf(s, night);
    if (victim !== null) unstoppable.push({ seat: victim, cause: 'trap' });
  }
  for (const g of record.guest) {
    const host = s.players[g.host];
    if (host && (isWolf(host, getRole) || host.roleId === 'lonely_wolf')) unstoppable.push({ seat: g.guest, cause: 'guest' });
  }
  if (record.revenge) unstoppable.push({ seat: record.revenge.target, cause: 'revenge' });
  if (!prayed) {
    for (const p of s.players.filter((x) => x.alive && x.plagueNight !== null)) {
      if (night >= (p.plagueNight as number) + 3) unstoppable.push({ seat: p.seat, cause: 'plague' });
    }
  }

  // ── R5: triggers from landed pack attacks ──
  for (const seat of packLandedOn) {
    const t = s.players[seat] as Player;
    if (t.roleId === 'diseased') s = { ...s, packState: { ...s.packState, [PACK.wolvesSickNight]: night + 1 } };
    if (t.roleId === 'wise' && !flag(t, 'wisePassiveLost')) s = { ...s, packState: { ...s.packState, [PACK.wolfPowersLost]: true } };
  }
  const guestDeaths: Death[] = [];
  for (const g of record.guest) {
    if (packLandedOn.has(g.guest)) guestDeaths.push({ seat: g.host, cause: 'guest' });
    if (packLandedOn.has(g.host)) guestDeaths.push({ seat: g.guest, cause: 'guest' });
  }

  // Avenger Wolf: a poison killed a wolf other than himself → guesses the next night.
  for (const l of finalLanded.filter((x) => x.source === 'poison' && x.by !== null)) {
    const victim = s.players[l.seat] as Player;
    if (!isWolf(victim, getRole)) continue;
    for (const av of s.players.filter((p) => p.alive && p.seat !== l.seat && holdsWolfPower(p, s, 'avenger_wolf'))) {
      const on = [...new Set([...(num(av, MEM.revengeNight) === night + 1 ? seatList(av, MEM.revengeOn) : []), l.by as number])];
      s = patchMemory(s, av.seat, { [MEM.revengeNight]: night + 1, [MEM.revengeOn]: on.join(',') });
    }
  }
  // A Priest night skips the Avenger: his guesses wait a night.
  if (prayed) {
    for (const av of s.players.filter((p) => num(p, MEM.revengeNight) === night)) {
      s = patchMemory(s, av.seat, { [MEM.revengeNight]: night + 1 });
    }
  }

  // ── R6 + R8: all deaths together, with chains and effects ──
  const initial: Death[] = [
    ...finalLanded.map((l) => ({ seat: l.seat, cause: l.source as DeathCause })),
    ...unstoppable,
    ...guestDeaths,
  ];
  const elim = eliminate(s, initial);
  s = elim.state;

  // Forger items are handed over at dawn and work from the next night.
  for (const f of record.forged) {
    const key = f.item === 'shield' ? MEM.shields : MEM.swords;
    const holder = s.players[f.target];
    if (holder?.alive) s = patchMemory(s, f.target, { [key]: (num(holder, key) ?? 0) + 1 });
  }
  if (record.paralysed !== null) s = { ...s, packState: { ...s.packState, paralysedSeat: record.paralysed } };

  // ── R7: announcements, in reading order ──
  if (prayed) announcements.push({ kind: 'quietNight' });
  announcements.push({
    kind: 'deaths',
    deaths: elim.deaths.map((d) => ({ seat: d.seat, plague: d.cause === 'plague' })).sort((a, b) => a.seat - b.seat),
  });
  if (catAttacked) announcements.push({ kind: 'catAttacked' });
  if (record.paralysed !== null && s.players[record.paralysed]?.alive) {
    announcements.push({ kind: 'paralysed', seat: record.paralysed });
  }
  const bear = s.players.find((p) => p.roleId === 'bear');
  if (bear) {
    if (bear.alive) {
      const { left, right } = neighbours(s, bear.seat);
      const growls = [left, right].some((seat) => {
        if (seat === null) return false;
        const p = s.players[seat] as Player;
        return p.turned || p.infected || getRole(p.roleId).seenAs.wolfCheck === 'wolf';
      });
      announcements.push({ kind: 'bear', growls });
    } else if (s.settings.reveal === 'anonymous') {
      announcements.push({ kind: 'bear', growls: false });
    }
  }

  // ── R9: win check (re-run after each prompt is answered) ──
  const winner = checkWinner(s);
  return { state: s, deaths: elim.deaths, announcements, prompts: elim.prompts, winner };
}

/** Answer a Hunter (or Triple Face) shot: the target is eliminated, with all consequences. */
export function resolveHunterShot(state: GameState, hunterSeat: number, target: number) {
  const s = patchMemory(state, hunterSeat, { [MEM.shotUsed]: true });
  const result = eliminate(s, [{ seat: target, cause: 'hunter' }]);
  return { ...result, winner: checkWinner(result.state) };
}

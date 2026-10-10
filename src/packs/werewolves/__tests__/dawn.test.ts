import { resolveHunterShot } from '../dawn';
import { eliminate } from '../elimination';
import { gameOf, withPlayer } from './fixtures';
import { deadSeats, playNight } from './helpers';

const CORE = ['werewolf', 'werewolf', 'seer', 'witch', 'salvator', 'hunter', 'villager', 'villager'];
const victim = (target: number, infect = false) => ({ kind: 'packVictim' as const, target, infect });

describe('basic night', () => {
  test('the pack kill lands and is announced', () => {
    const r = playNight(gameOf(CORE), 1, [victim(6)]);
    expect(deadSeats(r)).toEqual([6]);
    expect(r.announcements[0]).toEqual({ kind: 'deaths', deaths: [{ seat: 6, plague: false }] });
  });

  test('Salvator protection stops it', () => {
    expect(deadSeats(playNight(gameOf(CORE), 1, [{ kind: 'protect', seat: 4, target: 6 }, victim(6)]))).toEqual([]);
  });

  test("the Witch's heal saves the victim", () => {
    expect(deadSeats(playNight(gameOf(CORE), 1, [victim(6), { kind: 'heal', seat: 3, target: 6 }]))).toEqual([]);
  });

  test('poison kills; on a protected player it fails but is spent', () => {
    expect(deadSeats(playNight(gameOf(CORE), 1, [victim(6), { kind: 'poison', seat: 3, target: 0 }]))).toEqual([0, 6]);
    const r = playNight(gameOf(CORE), 1, [{ kind: 'protect', seat: 4, target: 0 }, victim(6), { kind: 'poison', seat: 3, target: 0 }]);
    expect(deadSeats(r)).toEqual([6]);
    expect(r.state.players[3]?.memory.poisonUsed).toBe(true);
  });

  test('a victim also poisoned dies once', () => {
    const r = playNight(gameOf(CORE), 1, [victim(6), { kind: 'poison', seat: 3, target: 6 }]);
    expect(r.deaths).toHaveLength(1);
  });
});

describe('protections in order', () => {
  test('the Prince is immune; an infection on him is spent', () => {
    const g = gameOf(['alpha_wolf', 'werewolf', 'prince', 'seer', 'villager', 'villager', 'villager', 'villager']);
    expect(deadSeats(playNight(g, 1, [victim(2)]))).toEqual([]);
    const inf = playNight(g, 1, [victim(2, true)]);
    expect(inf.state.players[2]?.infected).toBe(false);
    expect(inf.state.players[0]?.memory.infectionsUsed).toBe(1);
  });

  test('a jailed player is protected', () => {
    const g = gameOf([...CORE, 'warden']);
    expect(deadSeats(playNight(g, 1, [{ kind: 'jail', seat: 8, target: 6 }, victim(6)], {}))).toEqual([]);
  });

  test('a shield stops the next attack and is used up; a shield given tonight works only from tomorrow', () => {
    const g = withPlayer(gameOf(CORE), 6, { memory: { shields: 1 } });
    const r = playNight(g, 2, [victim(6)]);
    expect(deadSeats(r)).toEqual([]);
    expect(r.state.players[6]?.memory.shields).toBe(0);
    const forger = gameOf([...CORE, 'forger']);
    const given = playNight(forger, 1, [{ kind: 'forge', seat: 8, item: 'shield', target: 7 }, victim(7)]);
    expect(deadSeats(given)).toEqual([7]);
    const next = playNight(forger, 1, [{ kind: 'forge', seat: 8, item: 'shield', target: 6 }, victim(7)]);
    expect(next.state.players[6]?.memory.shields).toBe(1);
  });

  test('the Knight takes the attack instead; if he is protected, nothing happens', () => {
    const g = gameOf([...CORE, 'knight']);
    expect(deadSeats(playNight(g, 1, [{ kind: 'guard', seat: 8, target: 6 }, victim(6)]))).toEqual([8]);
    const safe = playNight(g, 1, [{ kind: 'protect', seat: 4, target: 8 }, { kind: 'guard', seat: 8, target: 6 }, victim(6)]);
    expect(deadSeats(safe)).toEqual([]);
  });

  test('protection that already stops the attack means nothing reaches the Knight', () => {
    const g = gameOf([...CORE, 'knight']);
    const r = playNight(g, 1, [{ kind: 'protect', seat: 4, target: 6 }, { kind: 'guard', seat: 8, target: 6 }, victim(6)]);
    expect(deadSeats(r)).toEqual([]);
  });

  test('the Priest prayed: nobody dies, and dawn opens with "the night was quiet"', () => {
    const g = gameOf([...CORE, 'priest']);
    const r = playNight(g, 2, [{ kind: 'pray', seat: 8 }]);
    expect(deadSeats(r)).toEqual([]);
    expect(r.announcements[0]).toEqual({ kind: 'quietNight' });
  });
});

describe('the Wise, the Cursed, the Cat, the Diseased', () => {
  test('the Wise survives the first wolf attack; killed later, the wolves lose their special powers', () => {
    const g = gameOf([...CORE.slice(0, 7), 'wise']);
    const first = playNight(g, 1, [victim(7)]);
    expect(deadSeats(first)).toEqual([]);
    const second = playNight(first.state, 2, [victim(7)]);
    expect(deadSeats(second)).toEqual([7]);
    expect(second.state.packState.wolfPowersLost).toBe(true);
  });

  test('the Wise absorbs a first infection; a second one infects him and he loses his passive', () => {
    const g = gameOf(['alpha_wolf', 'werewolf', 'seer', 'wise', 'villager', 'villager', 'villager', 'villager']);
    const first = playNight({ ...g, settings: { ...g.settings, alphaInfections: 2 } }, 1, [victim(3, true)]);
    expect(first.state.players[3]?.infected).toBe(false);
    const second = playNight(first.state, 2, [victim(3, true)]);
    expect(second.state.players[3]?.infected).toBe(true);
    expect(second.state.players[3]?.memory.wisePassiveLost).toBe(true);
  });

  test('the Cursed turns into a wolf instead of dying; protected, he does not turn', () => {
    const g = gameOf([...CORE.slice(0, 7), 'cursed']);
    const r = playNight(g, 1, [victim(7)]);
    expect(deadSeats(r)).toEqual([]);
    expect(r.state.players[7]).toMatchObject({ turned: true, team: 'werewolf' });
    const safe = playNight(g, 1, [{ kind: 'protect', seat: 4, target: 7 }, victim(7)]);
    expect(safe.state.players[7]?.turned).toBe(false);
  });

  test('the Cat survives, the attack is announced, and the next night she scratches a wolf: both die', () => {
    const g = gameOf([...CORE.slice(0, 7), 'cat']);
    const n1 = playNight(g, 1, [victim(7)]);
    expect(deadSeats(n1)).toEqual([]);
    expect(n1.announcements).toContainEqual({ kind: 'catAttacked' });
    expect(n1.state.players[7]?.memory.scratchNight).toBe(2);
    const n2 = playNight(n1.state, 2, [victim(6), { kind: 'catScratch', seat: 7, target: 1 }]);
    expect(deadSeats(n2)).toEqual([1, 6, 7]);
  });

  test('the Cat must scratch a wolf', () => {
    const g = withPlayer(gameOf([...CORE.slice(0, 7), 'cat']), 7, { memory: { scratchNight: 2, scratchPending: true } });
    expect(() => playNight(g, 2, [{ kind: 'catScratch', seat: 7, target: 6 }])).toThrow('notAWolf');
  });

  test('eating the Diseased makes the wolves sick the next night', () => {
    const g = gameOf([...CORE.slice(0, 7), 'diseased']);
    const r = playNight(g, 3, [victim(7)]);
    expect(deadSeats(r)).toEqual([7]);
    expect(r.state.packState.wolvesSickNight).toBe(4);
  });
});

describe('infection', () => {
  const g = gameOf(['alpha_wolf', 'werewolf', 'seer', 'witch', 'salvator', 'diseased', 'villager', 'minion', 'rat']);

  test('the victim joins the wolves and nobody dies', () => {
    const r = playNight(g, 1, [victim(6, true)]);
    expect(deadSeats(r)).toEqual([]);
    expect(r.state.players[6]).toMatchObject({ infected: true, team: 'werewolf' });
  });

  test('an infected Diseased also makes the wolves sick', () => {
    expect(playNight(g, 1, [victim(5, true)]).state.packState.wolvesSickNight).toBe(2);
  });

  test('an infected Neutral joins the wolves; an infected Minion becomes a full wolf', () => {
    expect(playNight(g, 1, [victim(8, true)]).state.players[8]).toMatchObject({ infected: true, team: 'werewolf' });
    expect(playNight(g, 1, [victim(7, true)]).state.players[7]).toMatchObject({ infected: true });
  });
});

describe('Troublemaker', () => {
  test('the swap moves the attack; protections and heals stay where they were placed', () => {
    const g = gameOf([...CORE, 'troublemaker']);
    const r = playNight(g, 1, [victim(6), { kind: 'heal', seat: 3, target: 6 }, { kind: 'swap', seat: 8, a: 6, b: 7 }]);
    expect(deadSeats(r)).toEqual([7]);
  });

  test('an attack swapped onto a wolf lands', () => {
    const g = gameOf([...CORE, 'troublemaker']);
    expect(deadSeats(playNight(g, 1, [victim(6), { kind: 'swap', seat: 8, a: 6, b: 0 }]))).toEqual([0]);
  });
});

describe('Guest', () => {
  const g = gameOf([...CORE, 'guest']);
  test('visiting a wolf kills the Guest', () => {
    expect(deadSeats(playNight(g, 2, [victim(6), { kind: 'guestVisit', seat: 8, target: 0 }]))).toEqual([6, 8]);
  });
  test('if the wolves kill the host, the Guest dies too', () => {
    expect(deadSeats(playNight(g, 2, [victim(6), { kind: 'guestVisit', seat: 8, target: 6 }]))).toEqual([6, 8]);
  });
  test('if the wolves kill the Guest, the host dies too', () => {
    expect(deadSeats(playNight(g, 2, [victim(8), { kind: 'guestVisit', seat: 8, target: 7 }]))).toEqual([7, 8]);
  });
  test('a healed host means nobody dies', () => {
    const r = playNight(g, 2, [victim(6), { kind: 'heal', seat: 3, target: 6 }, { kind: 'guestVisit', seat: 8, target: 6 }]);
    expect(deadSeats(r)).toEqual([]);
  });
});

describe('Witcher trap', () => {
  const g = gameOf([...CORE, 'witcher']);
  test('case A: a trapped wolf dies at dawn, unstoppably', () => {
    const r = playNight(g, 1, [{ kind: 'setTrap', seat: 8, target: 0 }, { kind: 'protect', seat: 4, target: 0 }, victim(6)]);
    expect(deadSeats(r)).toEqual([0, 6]);
  });
  test('case B: the pack attacks the trapped player — attack stopped, the weakest wolf dies', () => {
    const r = playNight(g, 1, [{ kind: 'setTrap', seat: 8, target: 6 }, victim(6)]);
    expect(deadSeats(r)).toHaveLength(1);
    expect([0, 1]).toContain(r.deaths[0]?.seat);
  });
});

describe('Hero, Lonely Wolf, swords, plague', () => {
  test('the Hero attacks and dies no matter what', () => {
    const g = gameOf([...CORE, 'hero']);
    const r = playNight(g, 2, [victim(6), { kind: 'heroStrike', seat: 8, target: 0 }, { kind: 'protect', seat: 4, target: 8 }]);
    expect(deadSeats(r)).toEqual([0, 6, 8]);
  });

  test('a plague death comes at dawn after Night N+3, announced as plague; a Priest night delays it', () => {
    const g = withPlayer(gameOf([...CORE, 'rat', 'priest']), 6, { plagueNight: 1 });
    expect(deadSeats(playNight(g, 3, [victim(7)]))).toEqual([7]);
    const due = playNight(g, 4, [victim(7)]);
    expect(due.announcements[0]).toEqual({ kind: 'deaths', deaths: [{ seat: 6, plague: true }, { seat: 7, plague: false }] });
    expect(deadSeats(playNight(g, 4, [{ kind: 'pray', seat: 9 }]))).toEqual([]);
  });

  test('a sword strike is a night attack and can be stopped', () => {
    const g = withPlayer(gameOf(CORE), 6, { memory: { swords: 1 } });
    expect(deadSeats(playNight(g, 2, [victim(7), { kind: 'swordStrike', seat: 6, target: 0 }]))).toEqual([0, 7]);
    const r = playNight(g, 2, [victim(7), { kind: 'protect', seat: 4, target: 0 }, { kind: 'swordStrike', seat: 6, target: 0 }]);
    expect(deadSeats(r)).toEqual([7]);
  });
});

describe('chains and effects', () => {
  test('Lovers die together', () => {
    let g = gameOf(CORE);
    g = withPlayer(withPlayer(g, 6, { loverSeat: 2 }), 2, { loverSeat: 6 });
    expect(deadSeats(playNight(g, 1, [victim(6)]))).toEqual([2, 6]);
  });

  test('the Lawyer dies when both clients are dead', () => {
    const g = withPlayer(gameOf([...CORE, 'lawyer']), 8, { memory: { pickA: 6, pickB: 7 } });
    const r = playNight(g, 2, [victim(6), { kind: 'poison', seat: 3, target: 7 }]);
    expect(deadSeats(r)).toEqual([6, 7, 8]);
  });

  test('a dead Hunter must shoot; the shot cannot be stopped', () => {
    const r = playNight(gameOf(CORE), 1, [victim(5)]);
    expect(r.prompts).toContainEqual({ kind: 'hunterShot', seat: 5 });
    const shot = resolveHunterShot(r.state, 5, 0);
    expect(shot.deaths.map((d) => d.seat)).toEqual([0]);
  });

  test('the Bodyguard dies in place of a Prince shot by the Hunter', () => {
    const g = gameOf(['werewolf', 'werewolf', 'prince', 'bodyguard', 'hunter', 'villager', 'villager', 'villager']);
    const shot = resolveHunterShot(g, 4, 2);
    expect(shot.deaths.map((d) => d.seat)).toEqual([3]);
  });

  test('the Thug is unlocked when a neighbour dies', () => {
    const g = gameOf(['werewolf', 'werewolf', 'seer', 'villager', 'thug', 'villager', 'witch', 'salvator']);
    const r = playNight(g, 1, [victim(5)]);
    expect(r.state.players[4]?.memory.unlocked).toBe(true);
  });

  test('the Apprentice Seer is promoted when the Seer dies', () => {
    const r = playNight(gameOf([...CORE, 'apprentice_seer']), 1, [victim(2)]);
    expect(r.state.players[8]?.memory.promoted).toBe(true);
  });

  test('the Musketeer becomes the Prince', () => {
    const g = gameOf(['werewolf', 'werewolf', 'prince', 'musketeer', 'villager', 'villager', 'villager', 'villager']);
    const r = eliminate(g, [{ seat: 2, cause: 'execution' }]);
    expect(r.state.players[3]?.roleId).toBe('prince');
  });

  test('a mayor killed at night prompts a successor (Revealed, village) or an election', () => {
    const g = { ...gameOf(CORE), mayorSeat: 6 };
    expect(playNight(g, 1, [victim(6)]).prompts).toContainEqual({ kind: 'mayorSuccession', seat: 6, mode: 'name' });
    const anon = { ...g, settings: { ...g.settings, reveal: 'anonymous' as const } };
    expect(playNight(anon, 1, [victim(6)]).prompts).toContainEqual({ kind: 'mayorSuccession', seat: 6, mode: 'election' });
  });

  test('a rule-break elimination is clean: no Hunter shot', () => {
    expect(eliminate(gameOf(CORE), [{ seat: 5, cause: 'ruleBreak' }]).prompts).toEqual([]);
  });
});

describe('announcements', () => {
  test('the paralysed player and the Bear are announced after the deaths', () => {
    const g = gameOf(['werewolf', 'dark_wolf', 'bear', 'seer', 'villager', 'villager', 'villager', 'villager']);
    const r = playNight(g, 1, [victim(6), { kind: 'paralyse', seat: 1, target: 4 }]);
    expect(r.announcements.map((a) => a.kind)).toEqual(['deaths', 'paralysed', 'bear']);
    expect(r.announcements[2]).toEqual({ kind: 'bear', growls: true });
  });
});

describe('a whole core game, played out', () => {
  test('the village finds both wolves and wins', () => {
    let g = gameOf(CORE);
    // Night 1: wolves kill seat 6. Day 1: the village executes wolf 0.
    let r = playNight(g, 1, [{ kind: 'protect', seat: 4, target: 2 }, victim(6), { kind: 'seerCheck', seat: 2, target: 0 }]);
    expect(r.winner).toBeNull();
    g = eliminate(r.state, [{ seat: 0, cause: 'execution' }]).state;
    // Night 2: Salvator guesses right, the Witch poisons wolf 1.
    r = playNight(g, 2, [{ kind: 'protect', seat: 4, target: 7 }, victim(7), { kind: 'poison', seat: 3, target: 1 }]);
    expect(deadSeats(r)).toEqual([1]);
    expect(r.winner).toEqual({ kind: 'team', team: 'village' });
  });

  test('the wolves win at parity once no killing ability is left', () => {
    let g = gameOf(CORE);
    let r = playNight(g, 1, [victim(5)]);
    expect(r.prompts).toContainEqual({ kind: 'hunterShot', seat: 5 });
    g = resolveHunterShot(r.state, 5, 6).state;
    g = eliminate(g, [{ seat: 2, cause: 'execution' }]).state;
    r = playNight(g, 2, [victim(3)]);
    // Left: wolves 0, 1 vs Salvator 4, Villager 7 → parity, Witch dead, Hunter used.
    expect(r.winner).toEqual({ kind: 'team', team: 'werewolf' });
  });
});

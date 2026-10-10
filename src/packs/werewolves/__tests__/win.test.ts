import { checkWinner } from '../win';
import { gameOf, kill, withPlayer } from './fixtures';

describe('village', () => {
  test('wins when no wolf is left alive', () => {
    const g = kill(gameOf(['werewolf', 'werewolf', 'villager', 'villager', 'seer']), 0, 1);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'village' });
  });

  test('a living Minion does not stop the village', () => {
    const g = kill(gameOf(['werewolf', 'minion', 'villager', 'villager']), 0);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'village' });
  });

  test('an infected player is a wolf, so the village has not won yet', () => {
    let g = kill(gameOf(['werewolf', 'villager', 'villager', 'villager', 'villager']), 0);
    g = withPlayer(g, 1, { infected: true, team: 'werewolf' });
    expect(checkWinner(g)).toBeNull();
  });
});

describe('werewolves', () => {
  test('win at parity (wolves equal to the others)', () => {
    const g = gameOf(['werewolf', 'werewolf', 'villager', 'villager']);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test('no win while outnumbered', () => {
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'villager', 'villager', 'villager']))).toBeNull();
  });

  test('the Minion counts as one of the "other" players', () => {
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'minion', 'villager', 'villager']))).toBeNull();
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'minion', 'villager']))).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test("an unused Witch's poison keeps the game going; a used one does not", () => {
    const g = gameOf(['werewolf', 'werewolf', 'witch', 'villager']);
    expect(checkWinner(g)).toBeNull();
    expect(checkWinner(withPlayer(g, 2, { memory: { poisonUsed: true } }))).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test("an unused Hunter's shot keeps the game going", () => {
    const g = gameOf(['werewolf', 'werewolf', 'hunter', 'villager']);
    expect(checkWinner(g)).toBeNull();
    expect(checkWinner(withPlayer(g, 2, { memory: { shotUsed: true } }))).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test('a held sword counts as a killing ability', () => {
    const g = withPlayer(gameOf(['werewolf', 'werewolf', 'villager', 'villager']), 3, { memory: { swords: 1 } });
    expect(checkWinner(g)).toBeNull();
  });

  test('the Thug counts only once unlocked and unused', () => {
    const g = gameOf(['werewolf', 'werewolf', 'thug', 'villager']);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'werewolf' });
    expect(checkWinner(withPlayer(g, 2, { memory: { unlocked: true } }))).toBeNull();
    expect(checkWinner(withPlayer(g, 2, { memory: { unlocked: true, used: true } }))).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test("the Witcher's unset trap counts during Nights 1–3 only", () => {
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'witcher', 'villager'], 3))).toBeNull();
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'witcher', 'villager'], 4))).toEqual({ kind: 'team', team: 'werewolf' });
    const set = withPlayer(gameOf(['werewolf', 'werewolf', 'witcher', 'villager'], 5), 2, { memory: { trapSeat: 0 } });
    expect(checkWinner(set)).toBeNull();
  });

  test('a pending Cat scratch counts', () => {
    const g = withPlayer(gameOf(['werewolf', 'werewolf', 'cat', 'villager']), 2, { memory: { scratchPending: true } });
    expect(checkWinner(g)).toBeNull();
  });

  test('abilities removed (Wise executed) no longer count', () => {
    const g = withPlayer(gameOf(['werewolf', 'werewolf', 'hunter', 'villager']), 2, { abilitiesRemoved: true });
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test('an infected Witch plays for the wolves, so her poison does not block their win', () => {
    const g = withPlayer(gameOf(['werewolf', 'witch', 'villager', 'villager']), 1, { infected: true, team: 'werewolf' });
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'werewolf' });
  });

  test('a dead Hunter no longer counts', () => {
    const g = kill(gameOf(['werewolf', 'werewolf', 'hunter', 'villager', 'villager']), 2);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'werewolf' });
  });
});

describe('Lonely Wolf', () => {
  test('while alive, no team can win', () => {
    const g = kill(gameOf(['werewolf', 'lonely_wolf', 'villager', 'villager']), 0);
    expect(checkWinner(g)).toBeNull();
    expect(checkWinner(gameOf(['werewolf', 'werewolf', 'lonely_wolf', 'villager']))).toBeNull();
  });

  test('wins as the last player alive', () => {
    const g = kill(gameOf(['werewolf', 'lonely_wolf', 'villager']), 0, 2);
    expect(checkWinner(g)).toEqual({ kind: 'solo', seat: 1, roleId: 'lonely_wolf' });
  });
});

describe('cross-team Lovers', () => {
  const pair = (roles: string[], a: number, b: number) => {
    let g = gameOf(roles);
    g = withPlayer(g, a, { loverSeat: b, team: 'lovers' });
    return withPlayer(g, b, { loverSeat: a, team: 'lovers' });
  };

  test('while alive, nobody else can win', () => {
    const g = kill(pair(['werewolf', 'werewolf', 'villager', 'villager'], 0, 2), 1);
    expect(checkWinner(g)).toBeNull();
  });

  test('win as the last 2 alive', () => {
    const g = kill(pair(['werewolf', 'werewolf', 'villager', 'villager'], 0, 2), 1, 3);
    expect(checkWinner(g)).toEqual({ kind: 'team', team: 'lovers' });
  });
});

describe('single winners (checked first)', () => {
  test('Sect Leader wins alone when every other living player is in the cult, even at wolf parity', () => {
    let g = gameOf(['werewolf', 'werewolf', 'sect_leader', 'villager']);
    for (const s of [0, 1, 3]) g = withPlayer(g, s, { cult: true });
    expect(checkWinner(g)).toEqual({ kind: 'solo', seat: 2, roleId: 'sect_leader' });
  });

  test('only living players need to be in the cult', () => {
    let g = kill(gameOf(['werewolf', 'sect_leader', 'villager', 'villager']), 3);
    g = withPlayer(withPlayer(g, 0, { cult: true }), 2, { cult: true });
    expect(checkWinner(g)).toEqual({ kind: 'solo', seat: 1, roleId: 'sect_leader' });
  });

  test('Rat wins alone when every other living player carries the plague', () => {
    let g = gameOf(['werewolf', 'rat', 'villager', 'villager', 'villager']);
    for (const s of [0, 2, 3, 4]) g = withPlayer(g, s, { plagueNight: 1 });
    expect(checkWinner(g)).toEqual({ kind: 'solo', seat: 1, roleId: 'rat' });
  });

  test('an infected Rat has joined the wolves and cannot win alone', () => {
    let g = gameOf(['werewolf', 'rat', 'villager', 'villager', 'villager']);
    for (const s of [0, 2, 3, 4]) g = withPlayer(g, s, { plagueNight: 1 });
    g = withPlayer(g, 1, { infected: true, team: 'werewolf' });
    expect(checkWinner(g)).not.toEqual(expect.objectContaining({ kind: 'solo' }));
  });
});

test('draw when everyone is eliminated at the same moment', () => {
  expect(checkWinner(kill(gameOf(['werewolf', 'villager']), 0, 1))).toEqual({ kind: 'draw' });
});

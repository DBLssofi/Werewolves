/**
 * App state shared by the screens: the setup draft, the deal in progress and the running game.
 * The running game is saved on the phone after every command (nothing leaves the device).
 * The rules live in the engine; this file only holds and saves state.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createGame, startDeal, type Deal } from '@/engine/deal';
import { DEFAULT_SETTINGS, type GameSettings, type RoleCount } from '@/engine/types';
import { classicRoles } from '@/packs/werewolves/classic';
import { getRole } from '@/packs/werewolves/roles';
import { dispatch, loadSession, newSession, saveSession, undo, PACK_ID, type Command, type Session, type SessionError } from '@/packs/werewolves/session';

const SAVE_KEY = 'bloodmoon.currentGame';

export interface Draft {
  players: number;
  settings: GameSettings;
  mode: 'classic' | 'custom';
  roles: RoleCount[];
}

interface Store {
  draft: Draft;
  updateDraft: (patch: Partial<Draft>) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  deal: Deal | null;
  beginDeal: () => void;
  setDeal: (d: Deal) => void;
  session: Session | null;
  startGame: () => void;
  run: (c: Command) => SessionError | null;
  back: () => void;
  canUndo: boolean;
  /** A saved game found on the phone at start-up (not yet resumed). */
  saved: Session | null;
  resume: () => void;
  discard: () => Promise<void>;
  newGame: () => void;
}

const Ctx = createContext<Store | null>(null);

const initialDraft: Draft = { players: 8, settings: DEFAULT_SETTINGS, mode: 'classic', roles: classicRoles(8) };

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [deal, setDealState] = useState<Deal | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [saved, setSaved] = useState<Session | null>(null);

  // Look for a saved game once at start-up.
  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY)
      .then((text) => {
        if (!text) return;
        const loaded = loadSession(text);
        if (typeof loaded !== 'string' && loaded.state.phase.kind !== 'over') setSaved(loaded);
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback((s: Session | null) => {
    if (!s) {
      AsyncStorage.removeItem(SAVE_KEY).catch(() => undefined);
      return;
    }
    AsyncStorage.setItem(SAVE_KEY, saveSession(s)).catch(() => undefined);
  }, []);

  const store = useMemo<Store>(
    () => ({
      draft,
      updateDraft: (patch) =>
        setDraft((d) => {
          const next = { ...d, ...patch };
          // Classic mode follows the player count.
          if (next.mode === 'classic' && (patch.players !== undefined || patch.mode !== undefined)) next.roles = classicRoles(next.players);
          return next;
        }),
      updateSettings: (patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      deal,
      beginDeal: () => setDealState(startDeal(draft.roles, randomSeed())),
      setDeal: (d) => setDealState(d),
      session,
      startGame: () => {
        if (!deal) return;
        const s = newSession(createGame(deal, draft.settings, PACK_ID, getRole));
        setSession(s);
        setSaved(null);
        persist(s);
      },
      run: (c) => {
        if (!session) return 'wrongPhase';
        const next = dispatch(session, c);
        if (typeof next === 'string') return next;
        setSession(next);
        persist(next);
        return null;
      },
      back: () => {
        if (!session) return;
        const prev = undo(session);
        setSession(prev);
        persist(prev);
      },
      canUndo: !!session && session.past.length > 0,
      saved,
      resume: () => {
        if (!saved) return;
        setSession(saved);
        setSaved(null);
      },
      discard: async () => {
        setSaved(null);
        await AsyncStorage.removeItem(SAVE_KEY).catch(() => undefined);
      },
      newGame: () => {
        setSession(null);
        setDealState(null);
        setDraft(initialDraft);
        persist(null);
      },
    }),
    [draft, deal, session, saved, persist],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useGame(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useGame must be used inside GameStoreProvider');
  return s;
}

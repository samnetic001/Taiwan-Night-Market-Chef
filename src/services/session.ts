import {
  applyGameEvent,
  createInitialGameState,
  loadBestRecord,
  saveSettlementToBestRecord,
  type BestScoreRecord,
  type GameConfig,
  type GameEvent,
  type GameState,
  type StorageLike,
} from '../core/index.ts';
import { createSoundService, type SoundService } from './audio.ts';

export interface GameSessionOptions {
  readonly config?: Partial<GameConfig>;
  readonly storage?: StorageLike | null;
  readonly sound?: SoundService;
  readonly now?: () => number;
  readonly onStateChange?: (state: GameState, bestRecord: BestScoreRecord) => void;
}

export interface GameSession {
  getState(): GameState;
  getBestRecord(): BestScoreRecord;
  getSound(): SoundService;
  isAudioEnabled(): boolean;
  setAudioEnabled(enabled: boolean): boolean;
  dispatch(event: GameEvent): GameState;
  tick(timestampMs?: number): GameState;
  subscribe(listener: (state: GameState, bestRecord: BestScoreRecord) => void): () => void;
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  try {
    const candidate = (globalThis as unknown as { localStorage?: StorageLike }).localStorage;
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') {
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

export function createGameSession(options: GameSessionOptions = {}): GameSession {
  const storage = options.storage !== undefined ? options.storage : getBrowserStorage();
  const sound = options.sound ?? createSoundService({ storage });
  const now = options.now ?? (() => Date.now());
  const listeners = new Set<(state: GameState, bestRecord: BestScoreRecord) => void>();

  if (options.onStateChange) {
    listeners.add(options.onStateChange);
  }

  let state = createInitialGameState(options.config);
  let bestRecord = loadBestRecord(storage);
  let lastSavedSettlementCount = 0;

  function notify(): void {
    for (const listener of listeners) {
      listener(state, bestRecord);
    }
  }

  function dispatch(event: GameEvent): GameState {
    const prevStatus = state.status;
    const prevExpiredCount = state.expiredCount;
    const prevSettlementCount = state.settlementCount;

    const nextState = applyGameEvent(state, event);
    state = nextState;

    const expiredDelta = Math.max(0, state.expiredCount - prevExpiredCount);
    const justSettled =
      state.status === 'settled' &&
      (prevStatus !== 'settled' || state.settlementCount > prevSettlementCount);

    if (justSettled && state.settlement && state.settlementCount > lastSavedSettlementCount) {
      lastSavedSettlementCount = state.settlementCount;
      bestRecord = saveSettlementToBestRecord(
        state.settlement,
        storage,
        new Date(now()).toISOString(),
      );
      sound.play('round_settled');
    } else {
      sound.playForEvent(event, state.lastEvaluation, expiredDelta);
    }

    if (event.type === 'START_ROUND' || event.type === 'RESTART_ROUND') {
      lastSavedSettlementCount = 0;
    }

    notify();
    return state;
  }

  function tick(timestampMs = now()): GameState {
    if (state.status !== 'playing') {
      return state;
    }
    return dispatch({
      type: 'ADVANCE_TIME',
      timestampMs,
    });
  }

  return {
    getState: () => state,
    getBestRecord: () => bestRecord,
    getSound: () => sound,
    isAudioEnabled: () => sound.isEnabled(),
    setAudioEnabled: (enabled: boolean) => {
      const result = sound.setEnabled(enabled);
      notify();
      return result;
    },
    dispatch,
    tick,
    subscribe(listener) {
      listeners.add(listener);
      listener(state, bestRecord);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

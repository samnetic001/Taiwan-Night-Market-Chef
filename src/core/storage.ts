import type { SettlementSummary } from './types.ts';

export const STORAGE_KEYS = {
  audioEnabled: 'samnetic_tnmc_audio_enabled_v1',
  bestRecord: 'samnetic_tnmc_best_record_v1',
} as const;

export interface BestScoreRecord {
  readonly maxCoins: number;
  readonly maxStars: 1 | 2 | 3;
  readonly maxStreak: number;
  readonly bestServedCount: number;
  readonly updatedAtIso: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_BEST_RECORD: BestScoreRecord = {
  maxCoins: 0,
  maxStars: 1,
  maxStreak: 0,
  bestServedCount: 0,
  updatedAtIso: '1970-01-01T00:00:00.000Z',
};

export function loadAudioEnabled(storage?: StorageLike | null): boolean {
  if (!storage) {
    return true;
  }
  try {
    const raw = storage.getItem(STORAGE_KEYS.audioEnabled);
    if (raw === null) {
      return true;
    }
    return raw !== 'false' && raw !== '0';
  } catch {
    return true;
  }
}

export function saveAudioEnabled(
  enabled: boolean,
  storage?: StorageLike | null,
): boolean {
  if (!storage) {
    return enabled;
  }
  try {
    storage.setItem(STORAGE_KEYS.audioEnabled, enabled ? 'true' : 'false');
  } catch {
    // 忽略隱私模式或配額限制錯誤
  }
  return enabled;
}

export function loadBestRecord(storage?: StorageLike | null): BestScoreRecord {
  if (!storage) {
    return DEFAULT_BEST_RECORD;
  }
  try {
    const raw = storage.getItem(STORAGE_KEYS.bestRecord);
    if (!raw) {
      return DEFAULT_BEST_RECORD;
    }
    const parsed = JSON.parse(raw) as Partial<BestScoreRecord>;
    const stars = parsed.maxStars === 3 ? 3 : parsed.maxStars === 2 ? 2 : 1;
    return {
      maxCoins:
        typeof parsed.maxCoins === 'number' && Number.isFinite(parsed.maxCoins)
          ? Math.max(0, Math.floor(parsed.maxCoins))
          : 0,
      maxStars: stars,
      maxStreak:
        typeof parsed.maxStreak === 'number' && Number.isFinite(parsed.maxStreak)
          ? Math.max(0, Math.floor(parsed.maxStreak))
          : 0,
      bestServedCount:
        typeof parsed.bestServedCount === 'number' &&
        Number.isFinite(parsed.bestServedCount)
          ? Math.max(0, Math.floor(parsed.bestServedCount))
          : 0,
      updatedAtIso:
        typeof parsed.updatedAtIso === 'string'
          ? parsed.updatedAtIso
          : DEFAULT_BEST_RECORD.updatedAtIso,
    };
  } catch {
    return DEFAULT_BEST_RECORD;
  }
}

export function mergeBestRecord(
  previous: BestScoreRecord,
  settlement: SettlementSummary,
  updatedAtIso = '2026-10-23T00:00:00.000Z',
): BestScoreRecord {
  const maxStars = Math.max(previous.maxStars, settlement.stars) as 1 | 2 | 3;
  return {
    maxCoins: Math.max(previous.maxCoins, settlement.totalCoins),
    maxStars,
    maxStreak: Math.max(previous.maxStreak, settlement.maxStreak),
    bestServedCount: Math.max(previous.bestServedCount, settlement.servedCount),
    updatedAtIso,
  };
}

export function saveSettlementToBestRecord(
  settlement: SettlementSummary,
  storage?: StorageLike | null,
  updatedAtIso = '2026-10-23T00:00:00.000Z',
): BestScoreRecord {
  const current = loadBestRecord(storage);
  const next = mergeBestRecord(current, settlement, updatedAtIso);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEYS.bestRecord, JSON.stringify(next));
    } catch {
      // 忽略寫入失敗
    }
  }
  return next;
}

import {
  loadAudioEnabled,
  saveAudioEnabled,
  type DeliveryEvaluation,
  type GameEvent,
  type StorageLike,
} from '../core/index.ts';

export type SoundCueId =
  | 'click'
  | 'start_round'
  | 'take_cup'
  | 'select_ingredient'
  | 'finish_drink'
  | 'serve_success'
  | 'serve_streak'
  | 'serve_wrong'
  | 'order_expired'
  | 'round_settled'
  | 'toggle_audio';

export interface ToneStep {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly delayMs?: number;
  readonly type?: OscillatorType;
  readonly gain?: number;
}

export interface SoundServiceOptions {
  readonly storage?: StorageLike | null;
  readonly initialEnabled?: boolean;
  readonly audioContextFactory?: () => AudioContext | null;
}

export interface SoundService {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): boolean;
  toggle(): boolean;
  play(cue: SoundCueId): boolean;
  playForEvent(event: GameEvent, evaluation?: DeliveryEvaluation | null, expiredDelta?: number): SoundCueId | null;
  getPlayedHistory(): readonly SoundCueId[];
  clearHistory(): void;
}

const CUE_PATTERNS: Readonly<Record<SoundCueId, readonly ToneStep[]>> = {
  click: [{ frequencyHz: 520, durationMs: 45, type: 'triangle', gain: 0.08 }],
  start_round: [
    { frequencyHz: 440, durationMs: 80, delayMs: 0, type: 'triangle', gain: 0.1 },
    { frequencyHz: 554.37, durationMs: 80, delayMs: 70, type: 'triangle', gain: 0.1 },
    { frequencyHz: 659.25, durationMs: 140, delayMs: 140, type: 'triangle', gain: 0.12 },
  ],
  take_cup: [{ frequencyHz: 392, durationMs: 60, type: 'sine', gain: 0.09 }],
  select_ingredient: [{ frequencyHz: 587.33, durationMs: 55, type: 'sine', gain: 0.09 }],
  finish_drink: [
    { frequencyHz: 523.25, durationMs: 70, delayMs: 0, type: 'triangle', gain: 0.1 },
    { frequencyHz: 783.99, durationMs: 110, delayMs: 65, type: 'triangle', gain: 0.11 },
  ],
  serve_success: [
    { frequencyHz: 523.25, durationMs: 80, delayMs: 0, type: 'triangle', gain: 0.11 },
    { frequencyHz: 659.25, durationMs: 80, delayMs: 70, type: 'triangle', gain: 0.11 },
    { frequencyHz: 783.99, durationMs: 150, delayMs: 140, type: 'triangle', gain: 0.13 },
  ],
  serve_streak: [
    { frequencyHz: 587.33, durationMs: 70, delayMs: 0, type: 'triangle', gain: 0.11 },
    { frequencyHz: 739.99, durationMs: 70, delayMs: 65, type: 'triangle', gain: 0.12 },
    { frequencyHz: 880, durationMs: 90, delayMs: 130, type: 'triangle', gain: 0.13 },
    { frequencyHz: 1046.5, durationMs: 160, delayMs: 210, type: 'triangle', gain: 0.14 },
  ],
  serve_wrong: [
    { frequencyHz: 240, durationMs: 110, delayMs: 0, type: 'sawtooth', gain: 0.09 },
    { frequencyHz: 180, durationMs: 160, delayMs: 100, type: 'sawtooth', gain: 0.1 },
  ],
  order_expired: [
    { frequencyHz: 310, durationMs: 90, delayMs: 0, type: 'square', gain: 0.07 },
    { frequencyHz: 220, durationMs: 150, delayMs: 85, type: 'square', gain: 0.08 },
  ],
  round_settled: [
    { frequencyHz: 523.25, durationMs: 90, delayMs: 0, type: 'triangle', gain: 0.11 },
    { frequencyHz: 659.25, durationMs: 90, delayMs: 85, type: 'triangle', gain: 0.11 },
    { frequencyHz: 783.99, durationMs: 90, delayMs: 170, type: 'triangle', gain: 0.12 },
    { frequencyHz: 1046.5, durationMs: 220, delayMs: 255, type: 'triangle', gain: 0.14 },
  ],
  toggle_audio: [{ frequencyHz: 660, durationMs: 50, type: 'sine', gain: 0.08 }],
};

function defaultAudioContextFactory(): AudioContext | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const win = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = win.AudioContext ?? win.webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export function createSoundService(options: SoundServiceOptions = {}): SoundService {
  const storage = options.storage ?? null;
  let enabled = options.initialEnabled ?? loadAudioEnabled(storage);
  let audioCtx: AudioContext | null = null;
  const factory = options.audioContextFactory ?? defaultAudioContextFactory;
  const playedHistory: SoundCueId[] = [];

  function ensureContext(): AudioContext | null {
    if (audioCtx) {
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        void audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
    audioCtx = factory();
    return audioCtx;
  }

  function synthesize(steps: readonly ToneStep[]): void {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    try {
      const now = ctx.currentTime;
      for (const step of steps) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const startAt = now + (step.delayMs ?? 0) / 1000;
        const durationSec = Math.max(0.02, step.durationMs / 1000);
        const peakGain = step.gain ?? 0.1;

        osc.type = step.type ?? 'triangle';
        osc.frequency.setValueAtTime(step.frequencyHz, startAt);

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(startAt);
        osc.stop(startAt + durationSec + 0.01);
      }
    } catch {
      // 忽略無音訊裝置或瀏覽器自動播放限制例外
    }
  }

  function play(cue: SoundCueId): boolean {
    if (!enabled) {
      return false;
    }
    playedHistory.push(cue);
    const steps = CUE_PATTERNS[cue];
    if (steps) {
      synthesize(steps);
    }
    return true;
  }

  function setEnabled(nextEnabled: boolean): boolean {
    enabled = saveAudioEnabled(nextEnabled, storage);
    if (enabled) {
      play('toggle_audio');
    }
    return enabled;
  }

  function toggle(): boolean {
    return setEnabled(!enabled);
  }

  function playForEvent(
    event: GameEvent,
    evaluation?: DeliveryEvaluation | null,
    expiredDelta = 0,
  ): SoundCueId | null {
    let cue: SoundCueId | null = null;
    switch (event.type) {
      case 'START_ROUND':
      case 'RESTART_ROUND':
        cue = 'start_round';
        break;
      case 'TAKE_CUP':
        cue = 'take_cup';
        break;
      case 'SELECT_TEA':
      case 'SELECT_SWEETNESS':
      case 'SELECT_ICE':
      case 'TOGGLE_PEARL':
        cue = 'select_ingredient';
        break;
      case 'FINISH_DRINK':
        cue = 'finish_drink';
        break;
      case 'RESET_WORKBENCH':
        cue = 'click';
        break;
      case 'DELIVER_ORDER':
        if (evaluation) {
          if (evaluation.accepted) {
            cue = evaluation.newStreak >= 2 ? 'serve_streak' : 'serve_success';
          } else if (evaluation.reason === 'expired_before_delivery') {
            cue = 'order_expired';
          } else {
            cue = 'serve_wrong';
          }
        }
        break;
      case 'SETTLE_ROUND':
        cue = 'round_settled';
        break;
      case 'ADVANCE_TIME':
      case 'SPAWN_ORDER':
        if (expiredDelta > 0) {
          cue = 'order_expired';
        }
        break;
    }
    if (cue && play(cue)) {
      return cue;
    }
    return null;
  }

  return {
    isEnabled: () => enabled,
    setEnabled,
    toggle,
    play,
    playForEvent,
    getPlayedHistory: () => [...playedHistory],
    clearHistory: () => {
      playedHistory.length = 0;
    },
  };
}

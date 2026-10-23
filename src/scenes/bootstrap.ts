import './phaser-shim.ts';
import Phaser from 'phaser';
import {
  loadAssetManifest,
  verifyBrowserImages,
  type AssetRegistry,
} from '../assets/index.ts';
import {
  DESKTOP_LOGICAL_HEIGHT,
  DESKTOP_LOGICAL_WIDTH,
  computeResponsiveLayout,
  type GameConfig,
  type StorageLike,
} from '../core/index.ts';
import {
  createGameSession,
  type GameSession,
  type SoundService,
} from '../services/index.ts';
import {
  NightMarketScene,
  PHASER_RUNTIME_VERSION,
} from './night-market-scene.ts';

export interface LaunchNightMarketGameOptions {
  readonly host: HTMLElement;
  readonly assets?: AssetRegistry;
  readonly fetcher?: typeof fetch;
  readonly skipBrowserImageDecode?: boolean;
  readonly storage?: StorageLike | null;
  readonly sound?: SoundService;
  readonly config?: Partial<GameConfig>;
  readonly now?: () => number;
  readonly createPhaserInstance?: boolean;
  readonly tickIntervalMs?: number;
}

export interface RunningNightMarketGame {
  readonly phaserVersion: string;
  readonly assets: AssetRegistry;
  readonly session: GameSession;
  readonly scene: NightMarketScene;
  readonly phaserGame: Phaser.Game | null;
  destroy(): void;
}

export function canCreatePhaserCanvas(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/jsdom|happy-dom/i.test(ua)) {
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    const ctx2d = probe.getContext('2d');
    const ctxGl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    return Boolean(ctx2d || ctxGl);
  } catch {
    return false;
  }
}

function attachHeadlessSceneLifecycle(
  scene: NightMarketScene,
  assets: AssetRegistry,
): void {
  const loadedKeys = new Set<string>();
  (scene as unknown as { load: { image: (key: string, url: string) => void } }).load = {
    image(key: string) {
      loadedKeys.add(key);
    },
  };
  (scene as unknown as { textures: { exists: (key: string) => boolean } }).textures = {
    exists(key: string) {
      return loadedKeys.has(key);
    },
  };
  (scene as unknown as { add: { image: (x: number, y: number, key: string) => unknown } }).add = {
    image(_x: number, _y: number, key: string) {
      if (!loadedKeys.has(key)) {
        throw new Error(`圖片載入失敗：${key}`);
      }
      const mockImage = {
        textureKey: key,
        originX: 0.5,
        originY: 0.5,
        visible: true,
        x: _x,
        y: _y,
        scale: 1,
        setOrigin(ox: number, oy: number) {
          this.originX = ox;
          this.originY = oy;
          return this;
        },
        setPosition(nx: number, ny: number) {
          this.x = nx;
          this.y = ny;
          return this;
        },
        setScale(s: number) {
          this.scale = s;
          return this;
        },
        setTexture(nextKey: string) {
          this.textureKey = nextKey;
          return this;
        },
        setVisible(v: boolean) {
          this.visible = v;
          return this;
        },
      };
      return mockImage;
    },
  };
  (scene as unknown as { events: { once: (evt: string, fn: () => void) => void } }).events = {
    once() {
      // no-op for headless scene wrapper
    },
  };

  scene.preload();
  for (const entry of assets.manifest.assets) {
    loadedKeys.add(entry.id);
  }
  scene.create();
}

export async function launchNightMarketGame(
  options: LaunchNightMarketGameOptions,
): Promise<RunningNightMarketGame> {
  const { host } = options;
  const assets = options.assets ?? (await loadAssetManifest(options.fetcher));

  if (!options.skipBrowserImageDecode && canCreatePhaserCanvas()) {
    await verifyBrowserImages(assets);
  }

  const session = createGameSession({
    config: options.config,
    storage: options.storage,
    sound: options.sound,
    now: options.now,
  });

  const scene = new NightMarketScene({
    host,
    assets,
    session,
    now: options.now,
  });

  const shouldUsePhaser = options.createPhaserInstance ?? canCreatePhaserCanvas();
  let phaserGame: Phaser.Game | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;

  if (shouldUsePhaser) {
    scene.mountInterface();

    const stageContainer = document.createElement('div');
    stageContainer.className = 'nm-phaser-stage';
    stageContainer.style.position = 'absolute';
    stageContainer.style.inset = '0';
    stageContainer.style.width = '100%';
    stageContainer.style.height = '100%';
    stageContainer.style.pointerEvents = 'none';
    stageContainer.style.zIndex = '1';
    stageContainer.style.opacity = '1';
    scene.attachStageContainer(stageContainer);

    const layout = computeResponsiveLayout(
      typeof window !== 'undefined' ? window.innerWidth : DESKTOP_LOGICAL_WIDTH,
      typeof window !== 'undefined' ? window.innerHeight : DESKTOP_LOGICAL_HEIGHT,
    );

    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: stageContainer,
      width: DESKTOP_LOGICAL_WIDTH,
      height: DESKTOP_LOGICAL_HEIGHT,
      backgroundColor: '#ffe7bb',
      scene: [scene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      audio: {
        noAudio: true,
      },
      banner: false,
    });

    if (layout) {
      scene.ensureStageMounted();
    }
  } else {
    attachHeadlessSceneLifecycle(scene, assets);
  }

  const tickMs = options.tickIntervalMs ?? 200;
  if (tickMs > 0) {
    fallbackTimer = setInterval(() => {
      scene.update();
    }, tickMs);
  }

  return {
    phaserVersion: PHASER_RUNTIME_VERSION,
    assets,
    session,
    scene,
    phaserGame,
    destroy() {
      if (fallbackTimer !== null) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
      if (phaserGame) {
        phaserGame.destroy(true);
        phaserGame = null;
      } else {
        // Trigger scene cleanup in headless mode
        (scene as unknown as { cleanup?: () => void }).cleanup?.();
      }
    },
  };
}

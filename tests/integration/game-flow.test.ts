// @ts-expect-error -- Node built-ins are available in Vitest runtime without requiring @types/node in tsconfig
import { readFileSync } from 'node:fs';
// @ts-expect-error -- Node built-ins are available in Vitest runtime without requiring @types/node in tsconfig
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_ASSET_IDS,
  createAssetRegistry,
  type AssetRegistry,
} from '../../src/assets/index.ts';

declare const process: { cwd(): string };
import {
  DESKTOP_LOGICAL_HEIGHT,
  DESKTOP_LOGICAL_WIDTH,
  MIN_TOUCH_TARGET_CSS_PX,
  MOBILE_PORTRAIT_LOGICAL_HEIGHT,
  MOBILE_PORTRAIT_LOGICAL_WIDTH,
  STORAGE_KEYS,
  computeResponsiveLayout,
  loadAudioEnabled,
  loadBestRecord,
  type BubbleTeaRecipe,
  type GameEvent,
  type GameState,
  type IceLevel,
  type StorageLike,
  type Sweetness,
  type TeaBase,
} from '../../src/core/index.ts';
import {
  NightMarketScene,
  PHASER_RUNTIME_VERSION,
  canCreatePhaserCanvas,
} from '../../src/scenes/index.ts';
import {
  createGameSession,
  createSoundService,
} from '../../src/services/index.ts';

class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function loadManifestRegistryFromDisk(): AssetRegistry {
  const manifestPath = resolve(process.cwd(), 'public/assets/manifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  return createAssetRegistry(raw);
}

/**
 * 輕量 DOM 模擬器（相容於 Node 測試環境與瀏覽器 DOM 環境），
 * 用於在不啟動外部命令或依賴额外套件的情況下，完整驗證 Scene + Session + Audio + Storage + 素材管線。
 */
class VirtualControllerHarness {
  public readonly assets: AssetRegistry;
  public readonly storage: MemoryStorage;
  public currentTimeMs = 1_000;
  public readonly scene: NightMarketScene;
  public readonly session: ReturnType<typeof createGameSession>;
  public readonly sound: ReturnType<typeof createSoundService>;
  public readonly loadedTextures = new Set<string>();
  public readonly createdSprites: Array<{
    textureKey: string;
    originX: number;
    originY: number;
    visible: boolean;
    x: number;
    y: number;
    scale: number;
  }> = [];

  constructor(options?: { initialAudioEnabled?: boolean; initialBestCoins?: number }) {
    this.assets = loadManifestRegistryFromDisk();
    this.storage = new MemoryStorage();

    if (options?.initialAudioEnabled !== undefined) {
      this.storage.setItem(
        STORAGE_KEYS.audioEnabled,
        options.initialAudioEnabled ? 'true' : 'false',
      );
    }
    if (options?.initialBestCoins !== undefined) {
      this.storage.setItem(
        STORAGE_KEYS.bestRecord,
        JSON.stringify({
          maxCoins: options.initialBestCoins,
          maxStars: 2,
          maxStreak: 3,
          bestServedCount: 4,
          updatedAtIso: '2026-10-23T00:00:00.000Z',
        }),
      );
    }

    this.sound = createSoundService({
      storage: this.storage,
    });

    this.session = createGameSession({
      storage: this.storage,
      sound: this.sound,
      now: () => this.currentTimeMs,
    });

    const dummyHost = (
      typeof document !== 'undefined'
        ? document.createElement('div')
        : ({
            classList: { add() {}, remove() {} },
            append() {},
            prepend() {},
            querySelector() {
              return null;
            },
            addEventListener() {},
            removeEventListener() {},
          } as unknown as HTMLElement)
    );

    this.scene = new NightMarketScene({
      host: dummyHost,
      assets: this.assets,
      session: this.session,
      now: () => this.currentTimeMs,
    });

    this.attachPhaserStubs();
  }

  private attachPhaserStubs(): void {
    const self = this;
    (this.scene as unknown as { load: { image: (key: string, url: string) => void } }).load = {
      image(key: string, _url: string) {
        self.loadedTextures.add(key);
      },
    };
    (this.scene as unknown as { textures: { exists: (key: string) => boolean } }).textures = {
      exists(key: string) {
        return self.loadedTextures.has(key);
      },
    };
    (
      this.scene as unknown as {
        add: { image: (x: number, y: number, key: string) => unknown };
      }
    ).add = {
      image(x: number, y: number, key: string) {
        const record = {
          textureKey: key,
          originX: 0.5,
          originY: 0.5,
          visible: true,
          x,
          y,
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
        self.createdSprites.push(record);
        return record;
      },
    };
    (this.scene as unknown as { events: { once: () => void } }).events = {
      once() {},
    };

    // 執行 preload 與 createStageObjects + session 同步
    this.scene.preload();
    (this.scene as unknown as { createStageObjects: () => void }).createStageObjects();
    this.session.subscribe((state) => {
      (this.scene as unknown as { syncStageFromState: (s: GameState) => void }).syncStageFromState(
        state,
      );
    });
  }

  public advanceBy(deltaMs: number): GameState {
    this.currentTimeMs += deltaMs;
    this.scene.update();
    return this.session.getState();
  }

  public dispatch(
    event: GameEvent extends infer E
      ? E extends { readonly timestampMs: number }
        ? Omit<E, 'timestampMs'>
        : never
      : never,
  ): GameState {
    return this.scene.dispatchGameEvent({
      ...event,
      timestampMs: this.currentTimeMs,
    } as GameEvent);
  }

  public craftAndDeliver(recipe: BubbleTeaRecipe, orderId: string): GameState {
    this.dispatch({ type: 'TAKE_CUP' });
    this.dispatch({ type: 'SELECT_TEA', tea: recipe.tea });
    this.dispatch({ type: 'SELECT_SWEETNESS', sweetness: recipe.sweetness });
    this.dispatch({ type: 'SELECT_ICE', ice: recipe.ice });
    this.dispatch({ type: 'TOGGLE_PEARL', pearl: recipe.pearl });
    this.dispatch({ type: 'FINISH_DRINK' });
    return this.dispatch({ type: 'DELIVER_ORDER', orderId });
  }
}

describe('台灣夜市料理王：Phaser 場景、服務、音效與 LocalStorage 整合驗收', () => {
  it('核對 Phaser 4.2.1 執行期版本、相容性與 21 張正式素材載入及錨點設定', () => {
    const pkgRaw = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkgRaw.dependencies.phaser).toBe('4.2.1');
    expect(pkgRaw.devDependencies.vite).toBe('8.3.4');
    expect(pkgRaw.devDependencies.typescript).toBe('7.0.2');
    expect(pkgRaw.devDependencies.vitest).toBe('5.0.5');

    expect(PHASER_RUNTIME_VERSION).toBe('4.2.1');
    expect(typeof canCreatePhaserCanvas()).toBe('boolean');

    const harness = new VirtualControllerHarness();
    expect(harness.loadedTextures.size).toBe(21);
    for (const id of REQUIRED_ASSET_IDS) {
      expect(harness.loadedTextures.has(id)).toBe(true);
    }

    // 驗證背景、攤位、老闆與預覽杯的 manifest 錨點皆已套用
    const stallSprite = harness.createdSprites.find((s) => s.textureKey === 'stall');
    const bossSprite = harness.createdSprites.find((s) => s.textureKey === 'boss');
    expect(stallSprite?.originX).toBeCloseTo(0.5, 4);
    expect(stallSprite?.originY).toBeCloseTo(0.96, 4);
    expect(bossSprite?.originX).toBeCloseTo(0.5, 4);
    expect(bossSprite?.originY).toBeCloseTo(0.959, 4);

    // 驗證 Phaser 舞台掛載至 .nm-scene 時為不透明（opacity = '1'）且位於前景可見層（zIndex = '1'），不被不透明 UI 遮擋，且 canvas 在更新後仍保留
    const mockCanvasEl = {
      style: {} as Record<string, string>,
      parentElement: null as unknown,
    };
    const mockStageEl = {
      className: 'nm-phaser-stage',
      style: {} as Record<string, string>,
      parentElement: null as unknown,
      querySelector(selector: string) {
        return selector === 'canvas' ? mockCanvasEl : null;
      },
      appendChild(child: unknown) {
        (child as { parentElement: unknown }).parentElement = mockStageEl;
      },
      remove() {
        this.parentElement = null;
      },
    };
    mockCanvasEl.parentElement = mockStageEl;
    harness.scene.attachStageContainer(mockStageEl as unknown as HTMLElement);
    expect(mockStageEl.style.opacity).toBe('1');
    expect(mockStageEl.style.zIndex).toBe('1');
    expect(mockStageEl.style.position).toBe('absolute');
    expect(mockCanvasEl.style.display).toBe('block');
    expect(mockCanvasEl.style.width).toBe('100%');
    expect(mockCanvasEl.style.height).toBe('100%');

    // 觸發營業開始與計時更新後，畫布與容器不會被改寫或遺失
    harness.dispatch({ type: 'START_ROUND', seed: 99 });
    harness.advanceBy(1_000);
    expect(mockStageEl.className).toBe('nm-phaser-stage');
    expect(mockCanvasEl.parentElement).toBe(mockStageEl);
  });

  it('首頁可開始，客人及訂單自動出現，全部飲料選項（紅茶/綠茶、全糖/半糖/無糖、正常冰/少冰/去冰、珍珠）可操作並交付', () => {
    const harness = new VirtualControllerHarness();
    expect(harness.session.getState().status).toBe('idle');

    // 首頁點擊開始營業
    const started = harness.dispatch({ type: 'START_ROUND', seed: 20261023 });
    expect(started.status).toBe('playing');
    expect(started.activeOrders).toHaveLength(1);
    expect(harness.sound.getPlayedHistory()).toContain('start_round');

    // 驗證客人在 Phaser 舞台中已顯示對應紋理
    const visibleCustomers = harness.createdSprites.filter(
      (s) => s.textureKey.startsWith('customer_') && s.visible,
    );
    expect(visibleCustomers).toHaveLength(1);

    // 逐一驗證全部飲料選項皆可操作並反映於工作台狀態
    const teas: readonly TeaBase[] = ['black', 'green'];
    const sweetnesses: readonly Sweetness[] = ['full', 'half', 'none'];
    const ices: readonly IceLevel[] = ['regular', 'less', 'none'];

    harness.dispatch({ type: 'TAKE_CUP' });
    expect(harness.session.getState().workbench.hasCup).toBe(true);

    for (const tea of teas) {
      const s = harness.dispatch({ type: 'SELECT_TEA', tea });
      expect(s.workbench.tea).toBe(tea);
    }
    for (const sweetness of sweetnesses) {
      const s = harness.dispatch({ type: 'SELECT_SWEETNESS', sweetness });
      expect(s.workbench.sweetness).toBe(sweetness);
    }
    for (const ice of ices) {
      const s = harness.dispatch({ type: 'SELECT_ICE', ice });
      expect(s.workbench.ice).toBe(ice);
    }

    // 切換珍珠開關
    const pearlOn = harness.dispatch({ type: 'TOGGLE_PEARL', pearl: true });
    expect(pearlOn.workbench.pearl).toBe(true);
    const pearlOff = harness.dispatch({ type: 'TOGGLE_PEARL', pearl: false });
    expect(pearlOff.workbench.pearl).toBe(false);

    // 依首張訂單配方製作並完成交付
    const firstOrder = harness.session.getState().activeOrders[0]!;
    harness.currentTimeMs += 500;
    const afterServed = harness.craftAndDeliver(firstOrder.recipe, firstOrder.id);

    expect(afterServed.lastEvaluation?.accepted).toBe(true);
    expect(afterServed.lastEvaluation?.reason).toBe('served');
    expect(afterServed.servedCount).toBe(1);
    expect(afterServed.coins).toBeGreaterThan(0);
    expect(harness.sound.getPlayedHistory()).toContain('finish_drink');
    expect(harness.sound.getPlayedHistory()).toContain('serve_success');

    // 時間推進後客人及訂單自動出現，且最多同時 3 張訂單
    harness.advanceBy(6_000);
    expect(harness.session.getState().activeOrders.length).toBeGreaterThanOrEqual(1);
    harness.advanceBy(6_000);
    harness.advanceBy(6_000);
    expect(harness.session.getState().activeOrders.length).toBeLessThanOrEqual(3);
  });

  it('正確、錯誤及逾時有不同結果與音效回饋；可結算與重玩，且最佳成績與音效設定保存於 LocalStorage', () => {
    const harness = new VirtualControllerHarness({
      initialAudioEnabled: true,
      initialBestCoins: 20,
    });

    expect(harness.session.getBestRecord().maxCoins).toBe(20);
    expect(harness.session.isAudioEnabled()).toBe(true);

    // 1. 開局並連續成功交付兩張訂單，觸發連擊 Bonus 與連擊音效
    harness.dispatch({ type: 'START_ROUND', seed: 108 });
    const order1 = harness.session.getState().activeOrders[0]!;
    harness.currentTimeMs += 1_000;
    const stateAfterOrder1 = harness.craftAndDeliver(order1.recipe, order1.id);
    expect(stateAfterOrder1.lastEvaluation?.accepted).toBe(true);
    expect(stateAfterOrder1.coins).toBe(45);

    // 推進 6 秒讓第二張訂單出現並交付
    harness.advanceBy(5_000);
    const order2 = harness.session.getState().activeOrders[0]!;
    harness.currentTimeMs += 500;
    const stateAfterOrder2 = harness.craftAndDeliver(order2.recipe, order2.id);
    expect(stateAfterOrder2.lastEvaluation?.accepted).toBe(true);
    expect(stateAfterOrder2.streak).toBe(2);
    expect(stateAfterOrder2.lastEvaluation?.streakBonusCoins).toBe(5);
    expect(stateAfterOrder2.coins).toBe(95); // 45 + (30 + 15 + 5)
    expect(harness.sound.getPlayedHistory()).toContain('serve_streak');

    // 2. 錯誤配方交付：扣減金幣、中斷連擊、計入 wrongDeliveryCount 並播放錯誤音效
    harness.advanceBy(6_000);
    const order3 = harness.session.getState().activeOrders[0]!;
    const wrongRecipe: BubbleTeaRecipe = {
      ...order3.recipe,
      tea: order3.recipe.tea === 'black' ? 'green' : 'black',
    };
    harness.currentTimeMs += 500;
    const stateAfterWrong = harness.craftAndDeliver(wrongRecipe, order3.id);
    expect(stateAfterWrong.lastEvaluation?.accepted).toBe(false);
    expect(stateAfterWrong.lastEvaluation?.reason).toBe('wrong_recipe');
    expect(stateAfterWrong.wrongDeliveryCount).toBe(1);
    expect(stateAfterWrong.failedCount).toBe(1);
    expect(stateAfterWrong.streak).toBe(0);
    expect(stateAfterWrong.coins).toBe(85); // 95 - 10
    expect(harness.sound.getPlayedHistory()).toContain('serve_wrong');

    // 3. 逾時判定：等待超過訂單期限，計入 expiredCount、扣減金幣並播放逾時音效
    harness.advanceBy(6_000);
    expect(harness.session.getState().activeOrders.length).toBeGreaterThanOrEqual(1);
    harness.advanceBy(25_000);
    const stateAfterExpire = harness.session.getState();
    expect(stateAfterExpire.expiredCount).toBeGreaterThanOrEqual(1);
    expect(harness.sound.getPlayedHistory()).toContain('order_expired');

    // 4. 推進至 120 秒結束，自動觸發結算並寫入 LocalStorage 最佳成績
    harness.advanceBy(90_000);
    const settledState = harness.session.getState();
    expect(settledState.status).toBe('settled');
    expect(settledState.settlement).not.toBeNull();
    expect(settledState.settlementCount).toBe(1);
    expect(harness.sound.getPlayedHistory()).toContain('round_settled');

    const savedBest = loadBestRecord(harness.storage);
    expect(savedBest.maxCoins).toBe(Math.max(20, settledState.coins));
    expect(savedBest.maxStreak).toBeGreaterThanOrEqual(2);

    // 5. 切換音效設定並驗證寫入 LocalStorage，靜音時不再觸發新音效
    harness.session.setAudioEnabled(false);
    expect(harness.session.isAudioEnabled()).toBe(false);
    expect(loadAudioEnabled(harness.storage)).toBe(false);

    const historyLengthWhenMuted = harness.sound.getPlayedHistory().length;
    const restartedState = harness.dispatch({ type: 'RESTART_ROUND', seed: 202 });
    expect(restartedState.status).toBe('playing');
    expect(restartedState.servedCount).toBe(0);
    expect(restartedState.failedCount).toBe(0);
    expect(restartedState.settlement).toBeNull();
    expect(harness.sound.getPlayedHistory().length).toBe(historyLengthWhenMuted);

    // 重新開啟音效並確認寫回 LocalStorage
    harness.session.setAudioEnabled(true);
    expect(loadAudioEnabled(harness.storage)).toBe(true);
  });

  it('桌面滑鼠（1280×720）與手機直式觸控（720×1280）版面重排與 >= 48 CSS px 觸控目標驗證', () => {
    const desktopLayout = computeResponsiveLayout(1280, 720);
    expect(desktopLayout.orientation).toBe('landscape');
    expect(desktopLayout.logicalWidth).toBe(DESKTOP_LOGICAL_WIDTH);
    expect(desktopLayout.logicalHeight).toBe(DESKTOP_LOGICAL_HEIGHT);
    expect(desktopLayout.minTouchTargetCssPx).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_CSS_PX);
    // 桌面版：訂單在左欄，客人與工作台在右欄上下排列
    expect(desktopLayout.ordersRegion.x).toBeLessThan(desktopLayout.customersRegion.x);
    expect(desktopLayout.customersRegion.y).toBeLessThan(desktopLayout.workbenchRegion.y);

    const mobilePortraitLayout = computeResponsiveLayout(390, 844);
    expect(mobilePortraitLayout.orientation).toBe('portrait');
    expect(mobilePortraitLayout.logicalWidth).toBe(MOBILE_PORTRAIT_LOGICAL_WIDTH);
    expect(mobilePortraitLayout.logicalHeight).toBe(MOBILE_PORTRAIT_LOGICAL_HEIGHT);
    expect(mobilePortraitLayout.minTouchTargetCssPx).toBeGreaterThanOrEqual(48);
    // 手機直式重排：標題 -> 訂單 -> 客人 -> 工作台由上而下獨立區塊
    expect(mobilePortraitLayout.headerRegion.y).toBeLessThan(mobilePortraitLayout.ordersRegion.y);
    expect(mobilePortraitLayout.ordersRegion.y).toBeLessThan(
      mobilePortraitLayout.customersRegion.y,
    );
    expect(mobilePortraitLayout.customersRegion.y).toBeLessThan(
      mobilePortraitLayout.workbenchRegion.y,
    );
  });
});

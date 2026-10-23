import './phaser-shim.ts';
import Phaser from 'phaser';
import {
  assertPhaserTextures,
  queuePhaserAssets,
  setManifestOrigin,
  type AssetId,
  type AssetRegistry,
} from '../assets/index.ts';
import {
  DESKTOP_LOGICAL_HEIGHT,
  DESKTOP_LOGICAL_WIDTH,
  computeResponsiveLayout,
  getCustomerTextureId,
  type BestScoreRecord,
  type CustomerOrder,
  type GameEvent,
  type GameState,
  type ResponsiveLayoutPlan,
} from '../core/index.ts';
import type { GameSession } from '../services/index.ts';
import { mountGameUi, type GameUi } from '../ui/index.ts';

export const NIGHT_MARKET_SCENE_KEY = 'NightMarketScene';

export const PHASER_RUNTIME_VERSION = Phaser.VERSION ?? '4.2.1';

export interface NightMarketSceneDeps {
  readonly host: HTMLElement;
  readonly assets: AssetRegistry;
  readonly session: GameSession;
  readonly now?: () => number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
  readonly onReady?: (scene: NightMarketScene) => void;
}

interface CustomerSpriteSlot {
  readonly sprite: Phaser.GameObjects.Image;
}

export class NightMarketScene extends Phaser.Scene {
  private readonly deps: NightMarketSceneDeps;
  private ui: GameUi | null = null;
  private stageContainer: HTMLElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isUpdatingAudioFromUi = false;
  private unsubscribeSession: (() => void) | null = null;
  private backgroundSprite: Phaser.GameObjects.Image | null = null;
  private stallSprite: Phaser.GameObjects.Image | null = null;
  private bossSprite: Phaser.GameObjects.Image | null = null;
  private previewDrinkSprite: Phaser.GameObjects.Image | null = null;
  private customerSlots: CustomerSpriteSlot[] = [];
  private currentLayout: ResponsiveLayoutPlan;
  private dragCleanup: (() => void) | null = null;

  constructor(deps: NightMarketSceneDeps) {
    super(NIGHT_MARKET_SCENE_KEY);
    this.deps = deps;
    const width =
      deps.viewportWidth ??
      (typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : DESKTOP_LOGICAL_WIDTH);
    const height =
      deps.viewportHeight ??
      (typeof window !== 'undefined' && window.innerHeight > 0
        ? window.innerHeight
        : DESKTOP_LOGICAL_HEIGHT);
    this.currentLayout = computeResponsiveLayout(width, height);
  }

  public preload(): void {
    queuePhaserAssets(this, this.deps.assets);
  }

  public create(): void {
    assertPhaserTextures(this, this.deps.assets);

    this.createStageObjects();
    this.mountInterface();
    this.ensureStageMounted();
    this.setupResizeHandling();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.cleanup();
    });

    this.deps.onReady?.(this);
  }

  public override update(): void {
    const state = this.deps.session.getState();
    if (state.status === 'playing') {
      const nowFn = this.deps.now ?? (() => Date.now());
      this.deps.session.tick(nowFn());
    }
    this.ensureStageMounted();
  }

  public getLayout(): ResponsiveLayoutPlan {
    return this.currentLayout;
  }

  public resizeViewport(
    viewportWidth: number,
    viewportHeight: number,
  ): ResponsiveLayoutPlan {
    this.currentLayout = computeResponsiveLayout(viewportWidth, viewportHeight);
    this.applyStageLayout(this.currentLayout);
    this.ensureStageMounted();
    return this.currentLayout;
  }

  public dispatchGameEvent(event: GameEvent): GameState {
    return this.deps.session.dispatch(event);
  }

  public attachStageContainer(container: HTMLElement): void {
    this.stageContainer = container;
    const existingCanvas =
      typeof container.querySelector === 'function'
        ? container.querySelector<HTMLCanvasElement>('canvas')
        : null;
    if (existingCanvas) {
      this.canvasElement = existingCanvas;
    }
    this.ensureStageMounted();
  }

  /**
   * 在 UI 執行 DOM reconcile 前，先將 Phaser 畫布容器自 `.nm-scene` 暫時移出，
   * 避免 `reconcile()` 按固定子節點順序把 `.nm-phaser-stage` 誤判為 `.nm-scene-art` 並覆寫或移除 canvas。
   */
  private detachStageContainer(): void {
    if (!this.stageContainer) {
      return;
    }
    const foundCanvas =
      typeof this.stageContainer.querySelector === 'function'
        ? this.stageContainer.querySelector<HTMLCanvasElement>('canvas')
        : null;
    if (foundCanvas) {
      this.canvasElement = foundCanvas;
    }
    if (typeof this.stageContainer.remove === 'function') {
      this.stageContainer.remove();
    } else if (
      this.stageContainer.parentElement &&
      typeof this.stageContainer.parentElement.removeChild === 'function'
    ) {
      this.stageContainer.parentElement.removeChild(this.stageContainer);
    }
  }

  public ensureStageMounted(): void {
    if (!this.stageContainer) {
      return;
    }

    const sceneEl = this.deps.host.querySelector<HTMLElement>('.nm-scene') ?? this.deps.host;

    if ('className' in this.stageContainer && !this.stageContainer.className) {
      this.stageContainer.className = 'nm-phaser-stage';
    }

    const stageStyle = this.stageContainer.style as CSSStyleDeclaration & Record<string, string>;
    stageStyle.position = 'absolute';
    stageStyle.inset = '0';
    stageStyle.width = '100%';
    stageStyle.height = '100%';
    stageStyle.pointerEvents = 'none';
    stageStyle.zIndex = '1';
    stageStyle.opacity = '1';
    stageStyle.display = 'block';
    if (typeof stageStyle.setProperty === 'function') {
      stageStyle.setProperty('display', 'block', 'important');
    }

    if (this.stageContainer.dataset) {
      this.stageContainer.dataset.orientation = this.currentLayout.orientation;
      this.stageContainer.dataset.logicalWidth = String(this.currentLayout.logicalWidth);
      this.stageContainer.dataset.logicalHeight = String(this.currentLayout.logicalHeight);
    }

    const gameCanvas =
      (this as unknown as { game?: { canvas?: HTMLCanvasElement | null } }).game?.canvas ??
      (this.sys as unknown as { game?: { canvas?: HTMLCanvasElement | null } } | undefined)?.game
        ?.canvas ??
      null;
    const queriedCanvas =
      typeof this.stageContainer.querySelector === 'function'
        ? this.stageContainer.querySelector<HTMLCanvasElement>('canvas')
        : null;
    const canvasEl = queriedCanvas ?? this.canvasElement ?? gameCanvas;

    if (canvasEl) {
      this.canvasElement = canvasEl;
      if (
        canvasEl.parentElement !== this.stageContainer &&
        typeof this.stageContainer.appendChild === 'function'
      ) {
        this.stageContainer.appendChild(canvasEl);
      }
      if ('width' in canvasEl && canvasEl.width !== this.currentLayout.logicalWidth) {
        canvasEl.width = this.currentLayout.logicalWidth;
      }
      if ('height' in canvasEl && canvasEl.height !== this.currentLayout.logicalHeight) {
        canvasEl.height = this.currentLayout.logicalHeight;
      }
      if (canvasEl.dataset) {
        canvasEl.dataset.orientation = this.currentLayout.orientation;
        canvasEl.dataset.logicalWidth = String(this.currentLayout.logicalWidth);
        canvasEl.dataset.logicalHeight = String(this.currentLayout.logicalHeight);
      }
      if (canvasEl.style) {
        canvasEl.style.display = 'block';
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        canvasEl.style.objectFit = 'cover';
        canvasEl.style.objectPosition =
          this.currentLayout.orientation === 'portrait' ? 'center 44%' : 'center bottom';
      }
    }

    if (this.stageContainer.parentElement !== sceneEl) {
      if (typeof sceneEl.prepend === 'function') {
        sceneEl.prepend(this.stageContainer);
      } else if (typeof sceneEl.appendChild === 'function') {
        sceneEl.appendChild(this.stageContainer);
      }
    }

    if (typeof sceneEl.querySelector === 'function') {
      const sceneArt = sceneEl.querySelector<HTMLElement>('.nm-scene-art');
      if (sceneArt) {
        sceneArt.style.opacity = '0';
        if (typeof sceneArt.style.setProperty === 'function') {
          sceneArt.style.setProperty('opacity', '0', 'important');
        }
      }
      const customerList = sceneEl.querySelector<HTMLElement>('.nm-customer-list');
      if (customerList) {
        customerList.style.zIndex = '2';
      }
    }

    if (typeof sceneEl.querySelectorAll === 'function') {
      const customerImgs = sceneEl.querySelectorAll<HTMLElement>('.nm-customer img');
      customerImgs.forEach((img) => {
        img.style.opacity = '0';
        if (typeof img.style.setProperty === 'function') {
          img.style.setProperty('opacity', '0', 'important');
        }
      });
    }
  }

  private createStageObjects(): void {
    const { assets } = this.deps;
    const { stageLayout } = this.currentLayout;

    this.backgroundSprite = setManifestOrigin(
      this.add.image(stageLayout.background.x, stageLayout.background.y, 'night_market'),
      assets,
      'night_market',
    );

    this.stallSprite = setManifestOrigin(
      this.add.image(stageLayout.stall.x, stageLayout.stall.y, 'stall'),
      assets,
      'stall',
    );

    this.bossSprite = setManifestOrigin(
      this.add.image(stageLayout.boss.x, stageLayout.boss.y, 'boss'),
      assets,
      'boss',
    );

    this.previewDrinkSprite = setManifestOrigin(
      this.add.image(stageLayout.previewDrink.x, stageLayout.previewDrink.y, 'cup'),
      assets,
      'cup',
    );

    this.customerSlots = stageLayout.customerSlots.map((slotPos) => {
      const sprite = setManifestOrigin(
        this.add.image(slotPos.x, slotPos.y, 'customer_1_happy'),
        assets,
        'customer_1_happy',
      );
      sprite.setVisible(false);
      return { sprite };
    });

    this.applyStageLayout(this.currentLayout);
    this.syncStageFromState(this.deps.session.getState());
  }

  private applyStageLayout(layout: ResponsiveLayoutPlan): void {
    const stageWidth = layout.logicalWidth;
    const stageHeight = layout.logicalHeight;
    const { stageLayout } = layout;

    if (this.scale && typeof this.scale.resize === 'function') {
      if (this.scale.width !== stageWidth || this.scale.height !== stageHeight) {
        try {
          this.scale.resize(stageWidth, stageHeight);
        } catch {
          // 忽略部分測試或無頭環境 resize 例外
        }
      }
    }

    const mainCamera = (
      this as unknown as {
        cameras?: {
          main?: {
            setSize?: (w: number, h: number) => unknown;
            setViewport?: (x: number, y: number, w: number, h: number) => unknown;
            setBounds?: (x: number, y: number, w: number, h: number) => unknown;
            centerOn?: (x: number, y: number) => unknown;
          };
        };
      }
    ).cameras?.main;

    if (mainCamera) {
      try {
        mainCamera.setSize?.(stageWidth, stageHeight);
        mainCamera.setViewport?.(
          stageLayout.camera.viewportX,
          stageLayout.camera.viewportY,
          stageLayout.camera.viewportWidth,
          stageLayout.camera.viewportHeight,
        );
        mainCamera.setBounds?.(0, 0, stageWidth, stageHeight);
        mainCamera.centerOn?.(stageLayout.camera.centerX, stageLayout.camera.centerY);
      } catch {
        // 忽略部分無頭環境相機設定例外
      }
    }

    if (this.backgroundSprite) {
      this.backgroundSprite.setPosition(stageLayout.background.x, stageLayout.background.y);
      this.backgroundSprite.setScale(stageLayout.background.scale);
    }

    if (this.stallSprite) {
      this.stallSprite.setPosition(stageLayout.stall.x, stageLayout.stall.y);
      this.stallSprite.setScale(stageLayout.stall.scale);
    }

    if (this.bossSprite) {
      this.bossSprite.setPosition(stageLayout.boss.x, stageLayout.boss.y);
      this.bossSprite.setScale(stageLayout.boss.scale);
    }

    if (this.previewDrinkSprite) {
      this.previewDrinkSprite.setPosition(
        stageLayout.previewDrink.x,
        stageLayout.previewDrink.y,
      );
      this.previewDrinkSprite.setScale(stageLayout.previewDrink.scale);
    }

    this.customerSlots.forEach((slot, idx) => {
      const placement = stageLayout.customerSlots[idx] ?? stageLayout.customerSlots[0];
      slot.sprite.setPosition(placement.x, placement.y);
      slot.sprite.setScale(placement.scale);
    });
  }

  private syncStageFromState(state: GameState): void {
    const { assets } = this.deps;
    const ordersBySlot = new Map<number, CustomerOrder>();
    for (const order of state.activeOrders) {
      ordersBySlot.set(order.slotIndex, order);
    }

    this.customerSlots.forEach((slot, index) => {
      const order = ordersBySlot.get(index);
      if (!order) {
        slot.sprite.setVisible(false);
        return;
      }
      const textureId = getCustomerTextureId(order.customer, order.mood) as AssetId;
      slot.sprite.setTexture(textureId);
      setManifestOrigin(slot.sprite, assets, textureId);
      slot.sprite.setVisible(true);
    });

    if (this.previewDrinkSprite) {
      const previewId: AssetId = state.workbench.isFinished ? 'finished_drink' : 'cup';
      this.previewDrinkSprite.setTexture(previewId);
      setManifestOrigin(this.previewDrinkSprite, assets, previewId);
      this.previewDrinkSprite.setVisible(state.workbench.hasCup || state.workbench.isFinished);
    }
  }

  public mountInterface(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const { host, assets, session } = this.deps;

    if (this.ui) {
      this.ui.setAudioEnabled(session.isAudioEnabled());
      this.ui.render(session.getState());
      this.syncBestRecordDOM(session.getBestRecord());
      this.ensureStageMounted();
      return;
    }

    const rebuildUiWithBest = (bestRecord: BestScoreRecord): void => {
      const previousUi = this.ui;
      this.dragCleanup?.();
      this.detachStageContainer();
      previousUi?.destroy();

      const rawUi = mountGameUi({
        host,
        assets,
        audioEnabled: session.isAudioEnabled(),
        bestRecord,
        onAudioChange: (enabled) => {
          this.isUpdatingAudioFromUi = true;
          try {
            session.setAudioEnabled(enabled);
          } finally {
            this.isUpdatingAudioFromUi = false;
          }
          this.detachStageContainer();
          queueMicrotask(() => {
            this.ensureStageMounted();
          });
        },
        onEvent: (event) => {
          const nowFn = this.deps.now ?? (() => Date.now());
          session.dispatch({
            ...event,
            timestampMs: nowFn(),
          } as GameEvent);
        },
      });

      this.ui = {
        render: (state: GameState) => {
          this.detachStageContainer();
          rawUi.render(state);
          this.ensureStageMounted();
        },
        setAudioEnabled: (enabled: boolean) => {
          this.detachStageContainer();
          rawUi.setAudioEnabled(enabled);
          this.ensureStageMounted();
        },
        destroy: () => {
          this.detachStageContainer();
          rawUi.destroy();
        },
      };

      this.ui.render(session.getState());
      this.syncBestRecordDOM(bestRecord);
      this.ensureStageMounted();
      this.setupDragAndTouchSupport(host);
    };

    let currentBestCoins = session.getBestRecord().maxCoins;
    let currentBestStars = session.getBestRecord().maxStars;
    let lastAudioEnabled = session.isAudioEnabled();
    rebuildUiWithBest(session.getBestRecord());

    this.unsubscribeSession = session.subscribe((state, bestRecord) => {
      if (
        bestRecord.maxCoins !== currentBestCoins ||
        bestRecord.maxStars !== currentBestStars
      ) {
        currentBestCoins = bestRecord.maxCoins;
        currentBestStars = bestRecord.maxStars;
      }
      const nextAudioEnabled = session.isAudioEnabled();
      if (!this.isUpdatingAudioFromUi) {
        if (nextAudioEnabled !== lastAudioEnabled) {
          lastAudioEnabled = nextAudioEnabled;
          this.ui?.setAudioEnabled(nextAudioEnabled);
        }
        this.ui?.render(state);
        this.syncBestRecordDOM(bestRecord);
        this.ensureStageMounted();
      } else {
        lastAudioEnabled = nextAudioEnabled;
        this.syncBestRecordDOM(bestRecord);
      }
      this.syncStageFromState(state);
    });
  }

  private syncBestRecordDOM(bestRecord: BestScoreRecord): void {
    const smallEl = this.deps.host.querySelector<HTMLElement>('.nm-overlay-card small');
    if (smallEl) {
      smallEl.textContent = `最佳營業額：${bestRecord.maxCoins} 金幣`;
    }
  }

  /**
   * 支援滑鼠與觸控拖曳選材與交付：
   * - 玩家可點擊或從食材按鈕拖曳至工作台區完成選材
   * - 飲料封膜完成後，可從成品預覽拖曳至對應客人訂單卡片完成交付
   */
  private setupDragAndTouchSupport(host: HTMLElement): void {
    let draggedChoice: HTMLButtonElement | null = null;
    let draggingFinishedDrink = false;

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Element | null;
      if (!target) return;
      const choiceBtn = target.closest<HTMLButtonElement>('button.nm-choice[data-action]');
      if (choiceBtn && !choiceBtn.disabled) {
        draggedChoice = choiceBtn;
        return;
      }
      const previewImg = target.closest<HTMLElement>('.nm-preview, .nm-assembly');
      if (previewImg && this.deps.session.getState().workbench.isFinished) {
        draggingFinishedDrink = true;
      }
    };

    const onPointerUp = (e: PointerEvent): void => {
      const target =
        (typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(e.clientX, e.clientY)
          : null) ?? (e.target as Element | null);

      if (draggedChoice && target) {
        const droppedInAssembly = target.closest('.nm-assembly, .nm-workbench');
        const sameButton = target.closest('button.nm-choice') === draggedChoice;
        if (droppedInAssembly && !sameButton) {
          draggedChoice.click();
        }
      }

      if (draggingFinishedDrink && target) {
        const orderCard = target.closest<HTMLElement>('.nm-order[data-order-id]');
        const deliverBtn = orderCard?.querySelector<HTMLButtonElement>(
          'button[data-action="deliver"]',
        );
        if (deliverBtn && !deliverBtn.disabled) {
          deliverBtn.click();
        }
      }

      draggedChoice = null;
      draggingFinishedDrink = false;
    };

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerup', onPointerUp);

    this.dragCleanup = () => {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerup', onPointerUp);
    };
  }

  private setupResizeHandling(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const onResize = (): void => {
      this.resizeViewport(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', onResize);
    });
  }

  private cleanup(): void {
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.stageContainer?.remove?.();
    this.stageContainer = null;
    this.canvasElement = null;
    this.ui?.destroy();
    this.ui = null;
  }
}

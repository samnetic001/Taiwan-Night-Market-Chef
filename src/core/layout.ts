export type ViewportOrientation = 'landscape' | 'portrait';

export interface RectRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SpritePlacement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface StageCameraLayout {
  readonly viewportX: number;
  readonly viewportY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly centerX: number;
  readonly centerY: number;
}

export interface StageSpriteLayout {
  readonly camera: StageCameraLayout;
  readonly background: SpritePlacement;
  readonly stall: SpritePlacement;
  readonly boss: SpritePlacement;
  readonly previewDrink: SpritePlacement;
  readonly customerSlots: readonly [SpritePlacement, SpritePlacement, SpritePlacement];
}

export interface ResponsiveLayoutPlan {
  readonly orientation: ViewportOrientation;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly minTouchTargetCssPx: number;
  readonly headerRegion: RectRegion;
  readonly ordersRegion: RectRegion;
  readonly customersRegion: RectRegion;
  readonly workbenchRegion: RectRegion;
  readonly stageLayout: StageSpriteLayout;
}

export const DESKTOP_LOGICAL_WIDTH = 1280;
export const DESKTOP_LOGICAL_HEIGHT = 720;
export const MOBILE_PORTRAIT_LOGICAL_WIDTH = 720;
export const MOBILE_PORTRAIT_LOGICAL_HEIGHT = 1280;
export const MIN_TOUCH_TARGET_CSS_PX = 48;

/**
 * 根據視窗尺寸決定邏輯畫布、區塊配置與 Phaser 舞台角色座標：
 * - 桌面橫式採 1280×720 邏輯畫布
 * - 手機直式（含 390×844 與 720×1280）採 720×1280 邏輯畫布，重新排版訂單、客人與工作台，
 *   並將攤位、老闆、飲品預覽與三位客人配置於直式 `customersRegion` 內，保證觸控目標至少 48 CSS px
 */
export function computeResponsiveLayout(
  viewportWidth: number,
  viewportHeight: number,
): ResponsiveLayoutPlan {
  const safeWidth = Math.max(320, viewportWidth);
  const safeHeight = Math.max(320, viewportHeight);
  const isPortrait = safeHeight > safeWidth;

  if (isPortrait) {
    const logicalWidth = MOBILE_PORTRAIT_LOGICAL_WIDTH;
    const logicalHeight = MOBILE_PORTRAIT_LOGICAL_HEIGHT;
    const headerRegion: RectRegion = { x: 24, y: 16, width: 672, height: 88 };
    const ordersRegion: RectRegion = { x: 24, y: 116, width: 672, height: 260 };
    const customersRegion: RectRegion = { x: 24, y: 388, width: 672, height: 340 };
    const workbenchRegion: RectRegion = { x: 24, y: 740, width: 672, height: 516 };

    const sceneBottomY = customersRegion.y + customersRegion.height - 12; // 716
    const stallCenterX = Math.round(customersRegion.x + customersRegion.width * 0.28); // 212
    const bossX = Math.round(customersRegion.x + customersRegion.width * 0.18); // 145
    const baseCustomerX = Math.round(customersRegion.x + customersRegion.width * 0.5); // 360
    const customerStepX = 136;
    const customerY = sceneBottomY - 6; // 710
    const customerScale = 0.42;
    const bgScale = Number(
      Math.max(
        logicalWidth / DESKTOP_LOGICAL_WIDTH,
        logicalHeight / DESKTOP_LOGICAL_HEIGHT,
      ).toFixed(4),
    );

    return {
      orientation: 'portrait',
      logicalWidth,
      logicalHeight,
      minTouchTargetCssPx: MIN_TOUCH_TARGET_CSS_PX,
      headerRegion,
      ordersRegion,
      customersRegion,
      workbenchRegion,
      stageLayout: {
        camera: {
          viewportX: 0,
          viewportY: 0,
          viewportWidth: logicalWidth,
          viewportHeight: logicalHeight,
          centerX: customersRegion.x + customersRegion.width * 0.5,
          centerY: customersRegion.y + customersRegion.height * 0.5,
        },
        background: {
          x: logicalWidth * 0.5,
          y: customersRegion.y + customersRegion.height * 0.5,
          scale: bgScale,
        },
        stall: {
          x: stallCenterX,
          y: sceneBottomY,
          scale: 0.44,
        },
        boss: {
          x: bossX,
          y: sceneBottomY - 10,
          scale: 0.36,
        },
        previewDrink: {
          x: stallCenterX + 54,
          y: sceneBottomY - 132,
          scale: 0.24,
        },
        customerSlots: [
          { x: baseCustomerX, y: customerY, scale: customerScale },
          { x: baseCustomerX + customerStepX, y: customerY, scale: customerScale },
          { x: baseCustomerX + customerStepX * 2, y: customerY, scale: customerScale },
        ],
      },
    };
  }

  const logicalWidth = DESKTOP_LOGICAL_WIDTH;
  const logicalHeight = DESKTOP_LOGICAL_HEIGHT;
  const headerRegion: RectRegion = { x: 24, y: 16, width: 1232, height: 72 };
  const ordersRegion: RectRegion = { x: 24, y: 100, width: 420, height: 596 };
  const customersRegion: RectRegion = { x: 460, y: 100, width: 800, height: 280 };
  const workbenchRegion: RectRegion = { x: 460, y: 392, width: 800, height: 304 };

  const sceneBottomY = logicalHeight - 12; // 708
  const stallCenterX = Math.round(logicalWidth * 0.42); // 538
  const bossX = Math.round(logicalWidth * 0.34); // 435
  const baseCustomerX = Math.round(logicalWidth * 0.64); // 819
  const customerStepX = 164;
  const customerY = sceneBottomY - 8; // 700
  const customerScale = 0.48;

  return {
    orientation: 'landscape',
    logicalWidth,
    logicalHeight,
    minTouchTargetCssPx: MIN_TOUCH_TARGET_CSS_PX,
    headerRegion,
    ordersRegion,
    customersRegion,
    workbenchRegion,
    stageLayout: {
      camera: {
        viewportX: 0,
        viewportY: 0,
        viewportWidth: logicalWidth,
        viewportHeight: logicalHeight,
        centerX: logicalWidth * 0.5,
        centerY: logicalHeight * 0.5,
      },
      background: {
        x: logicalWidth * 0.5,
        y: logicalHeight * 0.5,
        scale: 1,
      },
      stall: {
        x: stallCenterX,
        y: sceneBottomY,
        scale: 0.64,
      },
      boss: {
        x: bossX,
        y: sceneBottomY - 14,
        scale: 0.44,
      },
      previewDrink: {
        x: stallCenterX + 76,
        y: sceneBottomY - 190,
        scale: 0.28,
      },
      customerSlots: [
        { x: baseCustomerX, y: customerY, scale: customerScale },
        { x: baseCustomerX + customerStepX, y: customerY, scale: customerScale },
        { x: baseCustomerX + customerStepX * 2, y: customerY, scale: customerScale },
      ],
    },
  };
}

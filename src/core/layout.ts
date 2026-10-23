export type ViewportOrientation = 'landscape' | 'portrait';

export interface RectRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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
}

export const DESKTOP_LOGICAL_WIDTH = 1280;
export const DESKTOP_LOGICAL_HEIGHT = 720;
export const MOBILE_PORTRAIT_LOGICAL_WIDTH = 720;
export const MOBILE_PORTRAIT_LOGICAL_HEIGHT = 1280;
export const MIN_TOUCH_TARGET_CSS_PX = 48;

/**
 * 根據視窗尺寸決定邏輯畫布與區塊配置：
 * - 桌面橫式採 1280×720 邏輯畫布
 * - 手機直式重新排版訂單、客人與工作台，且保證觸控目標至少 48 CSS px
 */
export function computeResponsiveLayout(
  viewportWidth: number,
  viewportHeight: number,
): ResponsiveLayoutPlan {
  const safeWidth = Math.max(320, viewportWidth);
  const safeHeight = Math.max(320, viewportHeight);
  const isPortrait = safeHeight > safeWidth;

  if (isPortrait) {
    return {
      orientation: 'portrait',
      logicalWidth: MOBILE_PORTRAIT_LOGICAL_WIDTH,
      logicalHeight: MOBILE_PORTRAIT_LOGICAL_HEIGHT,
      minTouchTargetCssPx: MIN_TOUCH_TARGET_CSS_PX,
      headerRegion: { x: 24, y: 16, width: 672, height: 88 },
      ordersRegion: { x: 24, y: 116, width: 672, height: 260 },
      customersRegion: { x: 24, y: 388, width: 672, height: 340 },
      workbenchRegion: { x: 24, y: 740, width: 672, height: 516 },
    };
  }

  return {
    orientation: 'landscape',
    logicalWidth: DESKTOP_LOGICAL_WIDTH,
    logicalHeight: DESKTOP_LOGICAL_HEIGHT,
    minTouchTargetCssPx: MIN_TOUCH_TARGET_CSS_PX,
    headerRegion: { x: 24, y: 16, width: 1232, height: 72 },
    ordersRegion: { x: 24, y: 100, width: 420, height: 596 },
    customersRegion: { x: 460, y: 100, width: 800, height: 280 },
    workbenchRegion: { x: 460, y: 392, width: 800, height: 304 },
  };
}

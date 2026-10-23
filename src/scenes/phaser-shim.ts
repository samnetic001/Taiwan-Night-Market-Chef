/**
 * Phaser 4.2.1 會在模組載入階段執行 Device 偵測（OS、Browser、Audio、Input 等）。
 * 在無瀏覽器 `window` 的 Node / Vitest 環境下，Phaser 內建以 `typeof importScripts === 'function'`
 * 作為非視窗環境（Worker / Headless）守衛並安全略過 `window` 存取。
 */
const globalScope = globalThis as Record<string, unknown>;

if (typeof window === 'undefined' && typeof globalScope.importScripts !== 'function') {
  globalScope.importScripts = () => {
    // Headless Node environment guard for Phaser 4.2.1 Device initialization
  };
}

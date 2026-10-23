# Antigravity 對 Codex 素材整合與 UI 變更之審查紀錄（含 T5/T6 核心與場景修正）

- 審查時間：2026-10-23（Asia/Taipei）
- 審查代理：Antigravity CLI（Gemini 4 Argon Medium）
- 審查範圍：
  - Codex 負責檔案：`docs/asset-contract.md`、`docs/asset-sources.md`、`public/assets/manifest.json`、`src/assets/index.ts`、`src/ui/game-ui.ts`、`src/styles/game.css`、`docs/reviews/codex-review.md`
  - Antigravity 修正與驗證檔案：`src/core/layout.ts`、`src/scenes/bootstrap.ts`、`src/scenes/night-market-scene.ts`、`tests/core/engine.test.ts`、`tests/integration/game-flow.test.ts`

---

## 1. Asset Contract、Manifest 與載入管線審查

| 審查項目 | 核對結果與證據 | 結論 |
|---|---|---|
| Asset Contract 與來源揭露 | [`docs/asset-contract.md`](../../docs/asset-contract.md) 與 [`docs/asset-sources.md`](../../docs/asset-sources.md) 清楚記錄 21 張正式 PNG 尺寸、RGB/RGBA 透明屬性、正規化底緣錨點（攤位 `0.96`、老闆 `0.959`、客人與成品 `0.9583`）與生成來源 `codex-gui-imagegen`，如實區分 Codex GUI `$imagegen` 產圖與 Codex CLI 檢核整合，無虛構 CLI 生圖，亦無宣稱未內嵌的 sRGB chunk。 | 通過 |
| Manifest 結構與完整性 | [`public/assets/manifest.json`](../../public/assets/manifest.json) 完整列出 21 項必備素材 ID（`night_market`、`stall`、`boss`、3 名客人 × 3 種情緒共 9 張、`tea_black`、`tea_green`、`pearl`、`ice`、`cup`、`finished_drink`、`ui_button`、`coin`、`star`），路徑統一為 `/assets/<fileName>`，尺寸與錨點與契約表格完全吻合。 | 通過 |
| 執行期載入與驗證管線 | [`src/assets/index.ts`](../../src/assets/index.ts) 的 `createAssetRegistry()` 強制驗證 21 個 `REQUIRED_ASSET_IDS`、整數寬高、錨點範圍 `[0, 1]` 與 `licenseSource === 'codex-gui-imagegen'`；`verifyBrowserImages()` 以 `Image.decode()` 驗證瀏覽器實際解碼與自然寬高；`queuePhaserAssets()`、`setManifestOrigin()` 與 `assertPhaserTextures()` 與 Phaser 場景生命週期緊密銜接。 | 通過 |

---

## 2. 桌面與手機觸控 UI 審查（含 48 CSS px 觸控目標核對）

| 審查項目 | 核對結果與證據 | 結論 |
|---|---|---|
| 手機直式訂單可見性 | [`src/styles/game.css`](../../src/styles/game.css) 第 125–135 行於 `@media (max-width: 620px) and (orientation: portrait)` 將 `.nm-order-list` 改為單欄縱列（`grid-template-columns: 1fr`），並於 [`src/ui/game-ui.ts`](../../src/ui/game-ui.ts) 移除橫向滑動提示，三張訂單在手機直式可同時檢視並直接點擊交付。 | 通過 |
| 48 CSS px 觸控目標 | [`src/styles/game.css`](../../src/styles/game.css) 第 18 行定義 `.nm-quiet, .nm-action, .nm-choice { min-width: 48px; min-height: 48px; touch-action: manipulation; }`；直式規則中 `.nm-deliver` 維持 `min-height: 48px`（第 106、133 行）、`.nm-choice` 為 `min-width: 48px; min-height: 52px`（第 114、138 行）、`.nm-assembly .nm-quiet` 為 `min-height: 48px`（第 139 行）。所有操作按鈕（開始、操作說明、音效切換、拿杯子、茶底、甜度、冰量、加珍珠、封膜出杯、清空、交付、再玩一次）皆符合 `>= 48 CSS px` 規範。 | 通過 |
| 遮罩與配方摘要換行 | [`src/styles/game.css`](../../src/styles/game.css) 第 69 行將 `.nm-overlay` 改為 `position: fixed; inset: 0; overflow-y: auto` 並支援 `safe-area-inset`；第 140 行將直式 `.nm-assembly span` 設為 `white-space: normal`，避免手機上配方文字被截斷。 | 通過 |
| DOM Reconcile 與狀態同步 | [`src/ui/game-ui.ts`](../../src/ui/game-ui.ts) 的 `reconcile()` 保留 `<dialog class="nm-instructions">` 的 `open` 狀態，避免計時更新關閉說明視窗；點擊與拖曳（由 [`NightMarketScene.setupDragAndTouchSupport`](../../src/scenes/night-market-scene.ts#L517-L570) 補強）皆能觸發選材與交付。 | 通過 |

---

## 3. T5 與 Codex 審查所列核心／場景問題之處理結果

1. **直式 Phaser 邏輯畫布（`720×1280`）與舞台角色座標實作**：
   - [`src/core/layout.ts`](../../src/core/layout.ts) 新增 `StageCameraLayout` 與 `StageSpriteLayout`，在 `computeResponsiveLayout()` 中針對直式視窗（含 `390×844` 與 `720×1280`）計算 `720×1280` 邏輯畫布，並將攤位（`x: 212, y: 716, scale: 0.44`）、老闆（`x: 145, y: 706, scale: 0.36`）、飲品預覽（`x: 266, y: 584, scale: 0.24`）及三位客人（`x: 360 / 496 / 632, y: 710, scale: 0.42`）配置於直式 `customersRegion`（`x: 24, y: 388, width: 672, height: 340`）範圍內。
   - [`src/scenes/bootstrap.ts`](../../src/scenes/bootstrap.ts) 建立 `Phaser.Game` 時改用 `layout.logicalWidth` 與 `layout.logicalHeight`，不再固定為 `1280×720`。
   - [`src/scenes/night-market-scene.ts`](../../src/scenes/night-market-scene.ts) 的 `applyStageLayout()` 動態呼叫 `this.scale.resize()` 與相機 `setSize / setViewport / setBounds / centerOn`，並同步更新背景、攤位、老闆、預覽杯與三位客人的座標與縮放；`ensureStageMounted()` 同步設定 `canvas.width`、`canvas.height`、`data-orientation` 與行內 `display: block !important`。
2. **交付時間邊界與防回溯機制**：
   - [`src/core/engine.ts`](../../src/core/engine.ts) 以 `Math.max(state.currentTimeMs, event.timestampMs)` 作為單調有效時間，先執行到期與排程生單再判定交付；`timestampMs === deadlineMs` 仍可交付，`timestampMs > deadlineMs` 必定走逾時分支，且 `timestampMs === roundDeadlineMs`（120 秒截止）不會再生出新訂單。
3. **單元與整合測試覆蓋**：
   - [`tests/core/engine.test.ts`](../../tests/core/engine.test.ts) 與 [`tests/integration/game-flow.test.ts`](../../tests/integration/game-flow.test.ts) 已涵蓋時間邊界、防回溯、120 秒結算、連擊、三張訂單上限、`390×844` 與 `720×1280` 直式舞台座標範圍、Phaser 畫布尺寸切換與 CSS 48px 觸控規則核對（工作樹實跑 `pnpm test` 16/16 通過，`pnpm build` 成功）。

---

## 4. Codex 須修正的問題清單

請 Codex 於後續 UI／樣式收尾時修正以下問題（位於 Antigravity 不可修改之 `src/styles/game.css`）：

1. **【必修正】移除 `src/styles/game.css` 直式隱藏 Phaser 畫布的暫行 CSS 規則**：
   - **檔案與位置**：[`src/styles/game.css`](../../src/styles/game.css#L143-L148) 第 143–148 行：
     ```css
     @media (orientation: portrait) {
       /* The Phaser scene still uses a 1280x720 canvas. Show its manifest-backed DOM art
          until the scene implements a portrait camera and sprite layout. */
       .nm-scene .nm-phaser-stage { display: none !important; }
       .nm-scene .nm-scene-art, .nm-scene .nm-customer img { opacity: 1 !important; }
     }
     ```
   - **原因**：Antigravity 已在 `src/core/layout.ts`、`src/scenes/bootstrap.ts` 與 `src/scenes/night-market-scene.ts` 完成直式 `720×1280` Phaser 畫布、相機與角色定位（並以行內 `!important` 確保 `.nm-phaser-stage` 顯示）。請依 [`docs/reviews/codex-review.md`](../../docs/reviews/codex-review.md#L20) 第 1 點約定，刪除第 143–148 行暫行規則，避免樣式表與 Phaser 舞台掛載邏輯長期分歧。
2. **【建議修正】放寬直式單欄訂單列表的媒體查詢寬度上限以涵蓋 `720×1280` 直式視窗**：
   - **檔案與位置**：[`src/styles/game.css`](../../src/styles/game.css#L87-L135) 第 87–106 行與第 125–135 行。
   - **原因**：目前單欄縱列訂單僅在 `@media (max-width: 620px) and (orientation: portrait)` 生效；當視窗為 `720×1280` 直式時，會落入第 87 行 `@media (max-width: 780px), (orientation: portrait)` 的三欄窄卡（`.nm-order-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }`）。建議將直式單欄訂單或寬裕字級／內距涵蓋至 `(orientation: portrait)`（或 `max-width: 780px` 直式），使 `390×844` 與 `720×1280` 兩種直式目標視窗表現一致。

## T7 Codex 處理回覆（2026-10-23）

| T6 意見 | 本工作樹處理 | 狀態與剩餘驗證 |
|---|---|---|
| 必修正：移除直式隱藏 Phaser 規則 | 已從 `src/styles/game.css` 刪除該 `@media` 區塊；場景現由 `ensureStageMounted()` 掛載畫布並隱藏重複的 DOM 圖像。 | 程式靜態核對已處理；待 Antigravity 再審及真實直式瀏覽器驗證。 |
| 建議修正：720×1280 直式訂單維持單欄 | 已將單欄規則改為 `@media (orientation: portrait)`，涵蓋 390×844 與 720×1280。 | 樣式靜態核對已處理；待實際寬高、換行與觸控尺寸量測。 |

上方 T6 的「通過」與 16/16 測試結果是該階段紀錄。本回覆不代表 Antigravity 已複驗，也不代表本工作樹已重新執行測試。

本樹再次靜態核對兩項 CSS 處置與 21 張 PNG 標頭，詳見 `docs/t7-verification.md`。前次任務輸入另有 `tests_passed: false`、`test_failure: null`，因此 T7 的測試與互審狀態仍列為待驗證；不能以 T6 成績或這次靜態核對代替 Antigravity 再審。

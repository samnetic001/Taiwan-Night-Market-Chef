# T7 靜態核對與待驗收清單

日期：2026-10-23（Asia/Taipei）。本紀錄只描述目前 worktree 可直接核對的內容。本輪僅以唯讀指令檢視檔案與工作樹狀態；未安裝依賴、啟動伺服器、執行建置、Vitest 或瀏覽器操作。

## 本工作樹已核對

| 項目 | 方法與結果 | 證據界線 |
|---|---|---|
| T6 意見 1：直式 Phaser 畫布被隱藏 | 閱讀 `src/styles/game.css`：已無直式 `.nm-phaser-stage { display: none !important; }` 規則；`src/scenes/night-market-scene.ts` 的 `ensureStageMounted()` 有掛載畫布及設定直式邏輯尺寸的路徑。 | 靜態核對；尚未看過真實畫面。 |
| T6 意見 2：720×1280 訂單仍是三欄 | `src/styles/game.css` 的 `@media (orientation: portrait)` 將 `.nm-order-list` 設為單欄，未設 620px 上限；交付按鈕最小高度 48px。 | CSS 規則核對；尚未量測瀏覽器的實際 CSS 像素與文字換行。 |
| 素材實檔與 manifest | 唯讀讀取 `public/assets/manifest.json` 及 21 張對應 PNG 的 signature、IHDR 寬高與色彩類型。21/21 為 PNG，21/21 尺寸符合 manifest；`night_market` 為 1280×720、RGB（色彩類型 2），其餘 20 張為 RGBA（色彩類型 6）。 | 本輪未解碼像素、檢查透明像素或目視檢查，也未驗證瀏覽器／Phaser 載入。既有較完整素材檢查記錄見 `asset-contract.md` 與 `asset-sources.md`。 |
| 自動化測試與建置 | `package.json` 提供 `pnpm test`、`pnpm build`、`pnpm typecheck`；T6 Antigravity 審查文字回報當時 16/16 測試通過、建置成功。 | 本輪未執行，不能將 T6 回報當成本樹的通過結果。 |

## 先前驗收訊號的解讀

任務輸入附有 `{"findings":[],"tests_passed":false,"test_failure":null}`。這個訊號沒有列出發現或失敗原因，但明確**沒有**提供測試通過結論。它與 T6 審查文件記錄的「當時 16/16 通過」屬不同來源及工作階段；在本樹重跑前，交付狀態維持「未通過本輪測試關卡／原因未提供」，不可由 `test_failure: null` 推論測試成功。

## 待核准後執行的驗收

1. 在相符依賴已備妥的本機環境，依序執行 `pnpm typecheck`、`pnpm test`、`pnpm build`，保存實際輸出與執行時間。
2. 以 `pnpm dev` 開啟本機 Vite 頁面，檢查首頁、開始、三張訂單、所有選材、封膜、正誤交付、逾時、120 秒結算與重玩；檢查 LocalStorage 音效及最佳成績。
3. 在桌面 1280×720、手機直式 390×844 與 720×1280 檢查畫布、人物、訂單及工作台，量測所有可操作目標至少 48 CSS px，並實際用觸控操作。
4. 在瀏覽器確認 21 張圖可解碼、Phaser 紋理已載入且場景可見；再由 Antigravity 複審 T6 兩項 CSS 處置。結果須補回 `delivery.md` 與互審紀錄。

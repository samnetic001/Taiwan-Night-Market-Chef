# Codex 對 Antigravity 核心與場景變更的審查

- 審查時間：2026-10-23 21:34（Asia/Taipei；本次 worktree 靜態審查）。
- 範圍：`src/core/engine.ts`、`src/core/layout.ts`、`src/core/types.ts`、`src/core/stalls.ts`、`src/scenes/night-market-scene.ts`、`src/scenes/bootstrap.ts`、`src/services/`、`tests/core/engine.test.ts`、`tests/integration/game-flow.test.ts`；並核對 Codex 整合的 `src/assets/index.ts`、`src/ui/game-ui.ts`、`src/styles/game.css`、`public/assets/manifest.json` 與 `docs/asset-contract.md`。
- 方法與界線：逐檔閱讀程式、測試內容、manifest 與契約，使用唯讀 `file` 核對 21 張實際 PNG 的尺寸與 RGB/RGBA 類型，檢視本次修改差異。依使用者限制，未執行建置、測試、開發伺服器、瀏覽器互動或依賴安裝；下列「通過」僅表示程式碼及檔案靜態核對，不能宣稱執行時驗收。

## 審查結果

| 項目 | 發現與證據 | 結論／處置 |
|---|---|---|
| 交付時間邊界 | `src/core/engine.ts` 的 `handleDeliverOrder` 以 `max(state.currentTimeMs, timestampMs)` 作有效時間，晚於訂單 `deadlineMs` 走逾時分支；`evaluateWaitPerformance` 讓等於期限仍可交付。`tests/core/engine.test.ts` 含等於／晚於期限及回溯時間回歸案例。 | 靜態核對符合 ADR；測試尚未執行。 |
| 遊戲流程 | `handleStartRound` 自動生首單；排程生單受三張上限約束；茶底、甜度、冰量、珍珠、封膜、交付有事件分支；錯誤與逾時扣分、連擊獎勵、120 秒結算及重玩均有實作。`tests/integration/game-flow.test.ts` 涵蓋這些事件與 LocalStorage、音效。 | 靜態核對有完整路徑；滑鼠與觸控仍須真機操作驗證。 |
| 素材引用 | `public/assets/manifest.json` 列 21 張，檔名、尺寸與 `docs/asset-contract.md` 對應；`file public/assets/*.png` 顯示背景 1280×720 RGB、其餘 20 張 RGBA 且尺寸吻合。`src/assets/index.ts` 以 manifest 的 `id`／`path` 載入並設定錨點，瀏覽器模式呼叫 `Image.decode()` 核對尺寸。來源依 `docs/asset-sources.md` 記錄為 Codex GUI imagegen。 | 本次確認實檔存在、標頭尺寸與載入程式路徑；未重新做像素透明度／美術目視檢驗，也未在瀏覽器確認成功解碼。 |
| 手機佈局 | `src/core/layout.ts` 回傳直式區塊，但 `src/scenes/bootstrap.ts` 建立 Phaser 時仍固定 1280×720；`src/scenes/night-market-scene.ts` 的 `applyStageLayout` 也固定該尺寸、僅縮放人物。`ensureStageMounted` 將 DOM 攤位及客人圖設為透明。 | **待 Antigravity 修正：**讓 Phaser 相機／邏輯畫布與場景物件實際使用直式配置，檢查 390×844 與 720×1280 的客人、攤位及預覽位置。當前 CSS 在直式顯示同一批 manifest PNG 的 DOM 場景，暫時避免縮小的橫式畫布遮住人物。 |
| 手機訂單可見性 | 原 `src/styles/game.css` 在 620px 以下採橫向捲動，一次主要只露出一張訂單，另兩張對限時交付不易察覺；UI 還顯示「左右滑動查看」。 | **Codex 已修正：**直式手機採三張訂單縱列，交付鍵維持至少 48px 高，移除滑動提示。仍待實際裝置量測按鈕寬高與內容換行。 |
| 首頁、結算與工作台 | 原遮罩絕對定位於可能高於螢幕的 `.nm-shell`，手機上開始／重玩卡片可能落在可視區外；工作台配方摘要使用單行省略。 | **Codex 已修正：**遮罩固定於視窗且可捲動，直式手機配方摘要完整換行。 |

## 待 Antigravity 處理與再驗收

1. 將 `computeResponsiveLayout()` 的直式區塊真正接到 Phaser 場景與畫布配置；完成後由 Codex 移除 `src/styles/game.css` 的直式 DOM 圖片暫行顯示規則，避免兩份場景長期分歧。
2. 在瀏覽器實測桌面 1280×720、手機 390×844 與 720×1280：首頁可點開始、三張訂單與對應客人可辨識、所有選項可觸控、封膜與交付可成功及失敗、逾時／結算／重玩正常；量測所有操作目標至少 48 CSS px。
3. 執行既有核心與整合測試及建置檢查，並新增或補強真正讀取 DOM/CSS 尺寸與 Phaser 實際畫布的手機驗證。現有 `tests/integration/game-flow.test.ts` 手機案例只檢查 `computeResponsiveLayout()` 的資料欄位；其 Phaser 案例使用虛擬容器與紋理鍵，不能證明真實手機畫面與圖片解碼成功。

本紀錄為 Codex 對實際變更的審查及自身整合修正；沒有將 CLI 文字輸出記為圖片生成，也沒有宣稱已完成未執行的測試。

# ADR：第一關架構與驗證界線

日期：2026-10-23。依據三輪雙代理討論 Run `2002249b-25c2-4422-9eeb-3bba5efcbe8a`、擁有者核准項目 `83c7240e-cdc4-4dd3-8ecc-9ab4b2fcc46e`，以及 `docs/architecture.md`。完整討論索引見 `docs/discussion-summary.md`。

## 已決策

| 項目 | 決策與原因 |
|---|---|
| 技術分層 | TypeScript 純函式核心處理訂單與結算；Phaser 4.2.1 呈現場景；Vite 8.3.4 建置。依賴固定版本，以利重現。 |
| 時間判定 | 交付採事件時間與訂單絕對期限比較；晚於期限為逾時，等於期限可交付。局時 120 秒以絕對截止時間結算。 |
| 行動版 | 桌面邏輯畫布 1280×720；直式採 720×1280 舞台與重新排列的訂單、客人及工作台；操作目標至少 48 CSS px。 |
| 素材 | `docs/asset-contract.md` 及 `public/assets/manifest.json` 定義 21 張正式 PNG 的檔名、路徑、尺寸、透明度、錨點與來源。圖片由 Codex GUI 生成，Codex CLI 負責核對與整合。 |
| 關卡範圍 | 第一版可玩內容為珍珠奶茶；`StallDefinition` 預留雞排、臭豆腐、蚵仔煎及最終關接點。 |

## 已實測或已核對

- T6 的 Antigravity 審查紀錄回報在該工作樹執行 `pnpm test`，16/16 通過，且 `pnpm build` 成功。這是 T6 留下的結果，不等同本工作樹重新執行；範圍與證據見 `docs/reviews/antigravity-review.md`。
- 素材契約記錄曾逐張核對 21 張 PNG 的尺寸與透明像素，並目視抽查。來源與限制見 `docs/asset-contract.md` 及 `docs/asset-sources.md`。
- 本工作樹靜態核對 T6 所列兩項 CSS 問題，已移除直式隱藏 Phaser 畫布規則，並將直式縱列訂單樣式涵蓋 720×1280。此為程式與樣式核對，尚未實測瀏覽器畫面。
- 本工作樹唯讀核對 21 張 PNG 標頭與 manifest 尺寸一致；背景為 RGB，其餘 20 張為 RGBA。這不等於本輪重新驗證透明像素或執行時載入，方法與結果見 `docs/t7-verification.md`。

## 待驗證

- 本工作樹尚未執行建置、測試、開發伺服器或真實瀏覽器操作。T6 測試結果須在整合後重跑確認。
- 前次驗收訊號為 `tests_passed: false`、`test_failure: null`；沒有通過證據，也沒有可歸因的失敗訊息。它不否定 T6 審查文件的歷史回報，但本輪關卡仍待重新執行與回填結果。
- `Image.decode()` 與 Phaser 紋理存在檢查已有程式路徑；桌面與手機真實載入結果、所有按鈕的實際 CSS 像素尺寸，以及觸控／拖曳交付仍須瀏覽器實測。
- GUI 圖片生成紀錄不含本工作階段的圖片生成；模型實際回報欄位與 token 數值不在本工作樹可核對資料內，不推定數字。

# 第一版交付與後續關卡

## 分工、互審與處理狀態

| 代理 | 主責 | 審查對象 | 可追溯結果 |
|---|---|---|---|
| Codex CLI | 視覺方案、Asset Contract、素材檢核、載入與 UI | Antigravity 的核心、場景及測試 | `docs/reviews/codex-review.md`；指出直式舞台尚未接入，T6 由 Antigravity 修正。 |
| Antigravity CLI | 純函式核心、Phaser 場景、自動化測試 | Codex 的素材、UI 與樣式 | `docs/reviews/antigravity-review.md`；素材與 UI 靜態審查通過，提出兩項 CSS 收尾，已於本工作樹修正。 |

兩份審查紀錄對應不同工作階段。Codex 原審查的直式舞台問題，T6 紀錄已列程式修正與測試結果；本次 CSS 收尾後尚無 Antigravity 再審結論。不得把已修正直接寫成雙方已複驗通過。

本樹的逐項靜態核對、前次驗收訊號與待執行清單見 [`t7-verification.md`](t7-verification.md)。前次輸入的 `tests_passed: false`、`test_failure: null` 不提供通過證據，也未給失敗原因；T6 文件所記錄的 16/16 成績不能覆蓋此狀態。

## 本機啟動與檢查

專案是純前端。`package.json` 定義下列指令；在已具備相符 `node_modules` 的環境執行：

```sh
pnpm dev
pnpm test
pnpm build
pnpm typecheck
```

`pnpm dev` 使用 Vite 並綁定 `127.0.0.1`；依終端顯示的本機網址開啟。`pnpm test` 會先執行 PNG 檢核腳本，再由 Vitest 跑測試。上述是可用指令，並非本工作階段的執行紀錄；本階段遵守未核准命令限制，未執行這些指令，也未安裝依賴。

## 測試報告與限制

| 項目 | 現有證據 | 狀態 |
|---|---|---|
| 正誤飲品、逾時、連擊、三單上限、120 秒結算、重玩 | `tests/core/engine.test.ts`、`tests/integration/game-flow.test.ts`；T6 審查回報 16/16 通過 | T6 已回報；本樹未重跑 |
| 素材檔案與 manifest | `docs/asset-contract.md`、`docs/asset-sources.md` 記錄 21 張實檔檢驗；本次靜態核對 manifest 有 21 筆 | 檔案與契約已核對；本樹未測瀏覽器解碼 |
| 桌面與手機互動 | T6 測試含版面資料與模擬場景；真實桌面／手機操作尚無執行證據 | 待實測 |
| 本次直式 CSS 修正 | `src/styles/game.css` 規則已更新 | 靜態修正；待瀏覽器量測與互審 |
| 本樹 PNG 標頭核對 | `docs/t7-verification.md`；21/21 檔案格式及尺寸與 manifest 相符 | 標頭已核對；像素與執行時載入未於本輪測試 |

現有測試不能單獨證明真機觸控、所有 48 CSS px 目標的實際量測、Phaser 實際畫面與正式圖片在瀏覽器成功載入。部署、外部 API 與資料庫不在第一版範圍。

## 模型與使用量

- 討論規劃指定 Codex CLI `gpt-6-sol`、`model_reasoning_effort=medium`，Antigravity CLI `gemini-4-argon-medium`。`docs/discussion-summary.md` 記載三輪各三次 CLI 呼叫；原始紀錄位置在該文件。
- 該摘要指出兩套 CLI 的結構化事件沒有可辨識的 `reported_model`，因此指定模型不能當成實際回報模型。此工作樹未提供可核對的 token 數值；本文件不填造使用量。
- 9 張來源圖及衍生的 21 張 PNG 來自既有 Codex GUI imagegen 流程；本工作階段沒有生成圖片。來源細節見 `docs/asset-sources.md`。

## 後續關卡規劃

1. 先完成第一關真實瀏覽器驗收：桌面 1280×720、直式 390×844 與 720×1280；核對首頁、三單、點擊與拖曳、交付、結算、重玩、圖片載入及觸控尺寸。重跑建置與測試，再請雙方複驗本次樣式修正。
2. 以 `StallDefinition` 擴充雞排關：定義配方、步驟、等待時間、評分與獨立 Asset Contract；沿用事件核心與場景界面。
3. 臭豆腐、蚵仔煎分別新增工序及素材，先各自驗證配方狀態機和手機操作，再整合關卡選擇與進度。
4. 最終關在前述關卡穩定後設計跨攤位複合訂單及難度曲線；所需玩法、素材與驗收另立 ADR，不預先宣稱完成。

# 台灣夜市料理王：第一版交付與驗收

日期：2026-10-23（臺灣）。遊戲品牌：Samnetic Studio。交付分支：`codex/game-delivery`；Samnetic 整合分支：`agent/integration/1f08fc28`。原 `main` 未覆寫，所有工作樹及 SQLite 紀錄保留。

## 完成範圍

- 可玩的珍珠奶茶攤：首頁、說明、音效開關、120 秒營業、最多三張訂單、茶底／甜度／冰量／珍珠、封膜交付、正誤與逾時判定、金幣、連擊、星級結算及重玩。
- Phaser 4.2.1、TypeScript 7.0.2、Vite 8.3.4、Vitest 5.0.5，版本固定於 `package.json` 和 `pnpm-lock.yaml`。純前端，使用 LocalStorage 保存音效設定及最佳成績。
- 21 張正式 PNG 及 `public/assets/manifest.json`。9 次 Codex GUI `$imagegen` 產生來源圖後裁切、去背與規格化；來源與授權宣告見 `docs/asset-sources.md`。Codex CLI 負責 Asset Contract、載入及 UI 整合，沒有宣稱 CLI 自行生圖。
- `StallDefinition`、配方驗證與布局介面保留後續攤位擴充點；雞排、臭豆腐、蚵仔煎及最終關尚未實作。

## 雙 AI 協作與決策

架構討論 Run：`2002249b-25c2-4422-9eeb-3bba5efcbe8a`。Develop Run：`1f08fc28-0a25-4b7f-a0bb-b39c19a238a5`，兩者皆為 `Completed`。雙方獨立提案、三輪交叉評論與核准決策見 `docs/discussion-summary.md`、`docs/adr.md` 及 `.samnetic/decisions/`。T1–T7 均完成並逐批整合；Antigravity 實作核心與場景，Codex 實作素材整合、UI 與文件；每個任務皆由另一代理審查，發現存於 SQLite `findings` 表，書面摘要見 `docs/reviews/`。

Codex CLI 指定 `gpt-6-sol`、`model_reasoning_effort=medium`；Antigravity CLI 指定 `gemini-4-argon-medium`。模型預檢通過，兩 CLI 的結構化回覆未提供可辨識的實際模型欄位，因此 `reported_model` 為空，不把指定值冒充實際回報值。SQLite 共記錄 46 次真實代理呼叫：Codex 23 次、Antigravity 23 次；其中討論各 3 次，Develop 各 20 次。Codex 的 23 次皆有使用量資料；Antigravity 23 次中 21 次有使用量資料，兩次中斷／逾時無法取得 token 值。詳情以 `.samnetic/state.sqlite3` 的 `executions` 表為準。此專案的後續新 Run 已恢復保守的 24 次預設上限，不沿用本次核准的 46 次總額。

## 實際測試

| 驗證 | 2026-10-23 結果 |
|---|---|
| Samnetic Orchestrator Mock pytest | 20/20 通過 |
| 交付分支 `pnpm typecheck` | 成功 |
| 交付分支 `pnpm test` | 21/21 PNG 驗證；Vitest 2 個測試檔、16/16 通過 |
| 交付分支 `pnpm build` | 成功；Vite 提醒主程式包大於 500 kB，非建置失敗 |
| 桌面本機瀏覽器 | 正式夜市與飲品圖片可見；開始、客人自動出現、正確出餐得 30 金幣與 1 連擊、錯誤出餐顯示配方不符、120 秒結算與重玩均實際操作；瀏覽器 error 日誌為空 |
| 手機直式 | `390×844`、`720×1280` 邏輯布局、48 CSS px 目標與場景尺寸由自動測試及 CSS 核對；尚未用真手機實際觸控或量測瀏覽器元素 |

首次從根目錄跑 Vitest 曾顯示 120/120，因 `.samnetic/worktrees` 被一併掃描而重複計數；已將 Vitest 限定為本分支 `tests/**/*.test.ts`，修正後實跑結果為 16/16。`docs/t7-verification.md` 是 T7 代理當時的靜態紀錄，早於上述交付後驗收；以本報告的實際執行結果為最新狀態。

## 啟動與紀錄位置

```sh
cd /Users/samlin/Projects/Taiwan-Night-Market-Chef
export PATH="/Users/samlin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm dev
```

本機網址為 `http://127.0.0.1:5173/`。不需要後端或雲端部署。原始執行與審查資料在 `.samnetic/state.sqlite3`，ADR JSON 在 `.samnetic/decisions/`，事件 JSONL 在 `.samnetic/logs/`。`samnetic-ai status --project /Users/samlin/Projects/Taiwan-Night-Market-Chef` 可查看狀態。工作樹與整合分支保留供稽核；沒有推送或部署。

## 限制與後續關卡

目前缺少真手機觸控及不同桌面瀏覽器的實機驗收。較大的 Phaser 打包體積會影響低階手機載入速度，後續可評估程式碼切分。圖片為原創 AI 生成流程，未使用第三方遊戲圖像；素材來源文件須隨後續新增素材同步更新。無會員、雲端資料庫、付款或後端 API。

第二關雞排、第三關臭豆腐、第四關蚵仔煎應各自制定配方狀態機與 Asset Contract，沿用 `StallDefinition`、事件核心、評分與場景介面；最終關再設計跨攤位複合訂單。每關應另立 ADR、生成授權素材、加入測試並執行桌面與手機驗收，不預先宣稱完成。

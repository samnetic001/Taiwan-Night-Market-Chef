# 台灣夜市料理王

Samnetic Studio 製作的台灣夜市料理經營網頁遊戲。第一版「珍珠奶茶攤」已可在本機桌面瀏覽器遊玩：120 秒營業、最多三張訂單、選材封膜、正誤交付、金幣與連擊、結算及重玩。

## 本機啟動

在 `/Users/samlin/Projects/Taiwan-Night-Market-Chef` 執行：

```sh
export PATH="/Users/samlin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
pnpm dev
```

開啟終端顯示的 `http://127.0.0.1:5173/`。專案已具備鎖定版本的本機相依套件；若日後需重新還原，依 `pnpm-lock.yaml` 執行 `pnpm install --frozen-lockfile --ignore-scripts`。

```sh
pnpm typecheck
pnpm test
pnpm build
```

2026-10-23 交付分支實跑結果：型別檢查成功、素材驗證 21/21、Vitest 16/16、Vite 建置成功。桌面瀏覽器實際驗證開始、正確／錯誤交付、120 秒結算與重玩；手機直式由布局及整合測試涵蓋，尚未在真手機進行觸控驗收。完整證據、限制與雙代理紀錄見 [交付報告](docs/delivery.md)。

架構見 [ADR](docs/adr.md)，素材規格見 [Asset Contract](docs/asset-contract.md)，21 張 PNG 的來源見 [素材來源](docs/asset-sources.md)。開發成果位於 `codex/game-delivery` 分支；原 `main` 保留初始專案，Samnetic 整合分支為 `agent/integration/1f08fc28`。

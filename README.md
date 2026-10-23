# 台灣夜市料理王

Samnetic Studio 製作的台灣夜市料理經營遊戲。第一版聚焦珍珠奶茶攤。

第一關珍珠奶茶攤已具備首頁、120 秒營業、三張訂單、選材與交付、結算及重玩流程。桌面與手機可使用滑鼠或觸控操作；真實瀏覽器驗收狀態見 [交付與測試報告](docs/delivery.md)。

已有相符依賴的本機環境可執行 `pnpm dev` 啟動，並用 `pnpm typecheck`、`pnpm test`、`pnpm build` 檢查。此工作樹尚未重跑上述指令；前次驗收訊號為 `tests_passed: false`、`test_failure: null`，勿將 T6 的測試紀錄視為本次測試結果。靜態核對範圍與待驗收項目見 [T7 核對紀錄](docs/t7-verification.md)。

架構與決策見 [ADR](docs/adr.md)；素材規格及來源見 [Asset Contract](docs/asset-contract.md) 與 [素材來源](docs/asset-sources.md)；雙代理分工、互審與後續關卡見 [交付文件](docs/delivery.md)。

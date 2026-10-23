# 架構決策補充

來源：Samnetic 雙 AI 討論 Run `2002249b-25c2-4422-9eeb-3bba5efcbe8a`；ADR 位於 `.samnetic/decisions/2002249b-25c2-4422-9eeb-3bba5efcbe8a.json`。擁有者於核准項目 `83c7240e-cdc4-4dd3-8ecc-9ab4b2fcc46e` 接受下列精確處理：

1. 訂單交付使用事件時間戳與訂單截止時間比較；只有事件時間 `<= deadline` 才有效。更新延遲不能讓已過期訂單成功交付。局時 120 秒亦以絕對截止時間判定，結算不可重複。
2. 桌面採 1280×720 邏輯畫布；手機直式需重新排版訂單、客人與工作台，不可僅將桌面畫面等比例縮小。可操作目標至少 48 CSS px。
3. 純 TypeScript 可測核心與 Phaser 表現層分離，Asset Contract 先於程式載入；建置檢查 PNG，執行時檢查紋理載入。
4. Phaser 固定 4.2.1；Vite 8.3.4、TypeScript 7.0.2、Vitest 5.0.5 固定版本。
5. 第一版僅實作珍珠奶茶；以 `StallDefinition` 保留雞排、臭豆腐、蚵仔煎與最終關擴充介面。

此文件記錄使用者核准的分歧解法；原始雙代理提案與批評以 SQLite 討論紀錄為準。

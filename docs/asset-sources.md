# 美術素材來源與生成紀錄

以下 9 張原始圖由 Codex GUI 內建 `$imagegen` 生成，無第三方遊戲圖片。原圖留在 `art/source/`；21 張供遊戲使用的 PNG 經裁切、等比縮放及透明畫布規格化後放在 `public/assets/`。此步驟是 GUI 操作，不是 Codex CLI 自行生圖；Codex CLI 後續可審查契約與程式整合。

| 原圖 | 提示詞摘要 | 產出 |
|---|---|---|
| night-market.png | 16:9 暖色台灣夜市黃昏、燈籠、中央留攤位空間、無文字 | night-market.png |
| bubble-tea-stall.png | 透明 Q 版珍珠奶茶攤，木與青綠色、燈籠、無人 | bubble-tea-stall.png |
| boss.png | 透明 Q 版老闆，青綠圍裙、橘色上衣、手持珍奶 | boss.png |
| customer-1-sheet.png | 眼鏡黃外套客人，三欄高興／等待／不滿 | customer-1-*.png |
| customer-2-sheet.png | 銀髮花襯衫客人，三欄高興／等待／不滿 | customer-2-*.png |
| customer-3-sheet.png | 青綠帽 T 短髮客人，三欄高興／等待／不滿 | customer-3-*.png |
| ingredients-sheet.png | 六宮格紅茶、綠茶、珍珠、冰、空杯、成品 | tea-*.png、pearl.png、ice.png、cup.png |
| ui-sheet.png | 三欄圓形按鈕、金幣、星星 | ui-button.png、coin.png、star.png |
| finished-drink.png | 透明珍珠奶茶成品 | finished-drink.png |

共同視覺提示：精緻 2D 手繪 Q 版、暖琥珀燈光、青綠與珊瑚色、乾淨描邊、無可讀文字、無浮水印；除背景外均要求透明背景。一次生成一張原圖，總計 9 次。`public/assets/manifest.json` 為最終遊戲載入及授權來源清單。

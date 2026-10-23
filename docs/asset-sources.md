# 美術素材來源與生成紀錄

以下 9 張原始圖由 Codex GUI 內建 `$imagegen` 生成，來源紀錄未列第三方遊戲圖片。原圖留在 `art/source/`；21 張供遊戲使用的 PNG 經裁切、等比縮放及透明畫布規格化後放在 `public/assets/`。生成與處理紀錄歸於 GUI；Codex CLI 本次只核對檔案、契約與 manifest，不宣稱自行生圖。`licenseSource` 的值 `codex-gui-imagegen` 記錄生成來源，並非獨立的法律授權證明。

| 原圖 | 提示詞摘要 | 產出 |
|---|---|---|
| night-market.png | 16:9 暖色台灣夜市黃昏、燈籠、中央留攤位空間、無文字 | night-market.png |
| bubble-tea-stall.png | 透明 Q 版珍珠奶茶攤，木與青綠色、燈籠、無人 | bubble-tea-stall.png |
| boss.png | 透明 Q 版老闆，青綠圍裙、橘色上衣、手持珍奶 | boss.png |
| customer-1-sheet.png | 眼鏡黃外套客人，三欄高興／等待／不滿 | customer-1-*.png |
| customer-2-sheet.png | 銀髮花襯衫客人，三欄高興／等待／不滿 | customer-2-*.png |
| customer-3-sheet.png | 青綠帽 T 客人，三欄高興／等待／不滿 | customer-3-happy.png、customer-3-waiting.png、customer-3-angry.png |
| ingredients-sheet.png | 六宮格紅茶、綠茶、珍珠、冰、空杯、成品 | tea-black.png、tea-green.png、pearl.png、ice.png、cup.png；第六格未作遊戲成品檔 |
| ui-sheet.png | 三欄圓形按鈕、金幣、星星 | ui-button.png、coin.png、star.png |
| finished-drink.png | 透明珍珠奶茶成品 | finished-drink.png |

共同視覺提示：精緻 2D 手繪 Q 版、暖琥珀燈光、青綠與珊瑚色、乾淨描邊、無可讀文字、無浮水印；除背景外均要求透明背景。一次生成一張原圖，總計 9 次。`public/assets/manifest.json` 為最終遊戲載入及生成來源清單。

## 原圖、成品與核對結果

- `ingredients-sheet.png` 的原圖實際有棕藍漸層底，`ui-sheet.png` 的原圖實際有黑底；「要求透明背景」是生成意圖，不代表這兩張原始 sheet 本身透明。最終裁出的對應 PNG 經像素檢查有實際透明區域。背景 `night-market.png` 為不透明圖。
- `customer-3-sheet.png` 與成品呈現捲髮造型，先前「短髮」摘要過於簡略；成品仍為第三名獨立客人。九張客人檔案逐張目視核對，三位的高興、等待、不滿表情可辨識。
- `ingredients-sheet.png` 原圖第六格有成品飲料，但遊戲成品使用獨立生成的 `finished-drink.png`；前五格各對應五張原料／杯子成品。`cup.png` 是帶吸管的未裝飲料杯，不是純空白杯輪廓。
- 本次逐張解析 21 張遊戲 PNG：尺寸均與 manifest 相同，20 張前景圖有透明與非透明像素，背景無透明像素，沒有空白檔；並目視抽查全部 21 張。成品檔未嵌入 sRGB/ICC 色彩描述，視覺色彩以一般網頁顯示環境為準。錨點透明邊落差與修正值詳見 `docs/asset-contract.md`。
- 載入路徑使用 `/assets/<fileName>`，符合 Vite `public/assets/` 的靜態路徑規則；此為路徑規格核對，尚非瀏覽器／Phaser 執行時載入驗證。

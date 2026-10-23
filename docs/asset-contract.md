# Asset Contract v1

本契約以 `public/assets/manifest.json` 為唯一載入清單。素材由 Codex GUI `$imagegen` 產生，`licenseSource` 固定為 `codex-gui-imagegen`；Codex CLI 僅核對與整合，未產生這些圖片。Vite 的 `public/` 目錄對應網站根路徑，因此每筆 `path` 為 `/assets/<fileName>`。Phaser 應以 `id` 作為紋理鍵、以 `path` 載入，並依 `originX`、`originY` 設定定位。

| 素材鍵值 | 實際檔案 | 像素 | 實際透明度 | 錨點 `(x,y)` | 對應用途 |
|---|---|---:|---|---|---|
| `night_market` | `night-market.png` | 1280×720 | 無，RGB | (0.5, 0.5) | 夜市背景 |
| `stall` | `bubble-tea-stall.png` | 800×600 | 有，RGBA | (0.5, 0.96) | 珍珠奶茶攤 |
| `boss` | `boss.png` | 384×512 | 有，RGBA | (0.5, 0.959) | 攤位老闆 |
| `customer_1_happy` / `customer_1_waiting` / `customer_1_angry` | `customer-1-happy.png` / `customer-1-waiting.png` / `customer-1-angry.png` | 各 256×384 | 有，RGBA | (0.5, 0.9583) | 眼鏡黃外套客人：高興／等待／不滿 |
| `customer_2_happy` / `customer_2_waiting` / `customer_2_angry` | `customer-2-happy.png` / `customer-2-waiting.png` / `customer-2-angry.png` | 各 256×384 | 有，RGBA | (0.5, 0.9583) | 銀髮花襯衫客人：高興／等待／不滿 |
| `customer_3_happy` / `customer_3_waiting` / `customer_3_angry` | `customer-3-happy.png` / `customer-3-waiting.png` / `customer-3-angry.png` | 各 256×384 | 有，RGBA | (0.5, 0.9583) | 捲髮青綠帽 T 客人：高興／等待／不滿 |
| `tea_black` / `tea_green` | `tea-black.png` / `tea-green.png` | 各 192×192 | 有，RGBA | (0.5, 0.5) | 紅茶／綠茶茶底 |
| `pearl` / `ice` / `cup` | `pearl.png` / `ice.png` / `cup.png` | 各 192×192 | 有，RGBA | (0.5, 0.5) | 珍珠／冰塊／空杯圖示 |
| `finished_drink` | `finished-drink.png` | 256×384 | 有，RGBA | (0.5, 0.9583) | 成品珍珠奶茶 |
| `ui_button` / `coin` / `star` | `ui-button.png` / `coin.png` / `star.png` | 各 192×192 | 有，RGBA | (0.5, 0.5) | 通用操作按鈕／金幣／星級圖示 |

`ui_button` 是無文字的按鈕底圖；開始、交付、重新開始及各選項的文字與互動狀態須由介面實作。甜度與冰量選項沒有各自的 PNG，使用同一按鈕底圖搭配繁體中文標籤。`cup` 圖像含吸管，杯身未裝飲料；`finished_drink` 是示意成品，不替代訂單內容與正誤判定。

## 實檔核對與契約落差

- 已逐張讀取 21 張遊戲 PNG 的 IHDR 與解碼像素。每張尺寸均符合上表；背景為 8-bit RGB 且全幅有像素，其他 20 張為 8-bit RGBA，皆同時有透明與非透明像素，畫面不是空白。視覺抽查涵蓋背景、攤位、老闆、九張客人情緒、原料、按鈕、金幣、星級與成品。
- 原契約將攤位、老闆、客人與成品的 `originY` 設為 `1`，但主體下緣分別在畫布第 575、490、367、367 列（從 0 起算），下方尚有透明邊。manifest 已改為接近主體底緣的正規化錨點：攤位 `576/600 ≈ 0.96`、老闆 `491/512 ≈ 0.959`、客人與成品 `368/384 ≈ 0.9583`。錨點仍以整張紋理尺寸計算，並非裁切後尺寸。
- 原契約宣稱「所有 PNG 使用 sRGB」，但 21 張成品 PNG 只有 IHDR、IDAT、IEND 區塊，沒有內嵌 sRGB 或 ICC 色彩描述。視覺以一般網頁 sRGB 顯示環境為目標；檔案色彩設定尚未由內嵌中繼資料證實，不應將其記為已驗收的檔案屬性。
- `hasAlpha` 表示已確認實際透明像素，並非只看 PNG 副檔名或 RGBA 色彩類型。美術來源與原圖、成品間關係詳見 `docs/asset-sources.md`。瀏覽器／Phaser 實際載入及桌面、手機畫面仍須由遊戲整合階段驗證；本次檔案核對不宣稱已完成執行時載入測試。

正式美術方向為明亮暖色台灣夜市、精緻 Q 版人物、青綠與珊瑚配色。不可用純色方塊、Emoji、Prompt、空白圖或未授權第三方遊戲圖像替代。

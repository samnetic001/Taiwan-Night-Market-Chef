# Asset Contract v1

Samnetic Studio 自行生成的 Q 版夜市美術。來源欄位須標記 `codex-gui-imagegen` 或 `codex-cli`；不得把文字 Prompt、空白檔或未授權第三方圖像當成正式素材。所有 PNG 使用 sRGB，非背景必須有真正 alpha，載入時使用 manifest 的 path。

| ID | 檔案 | 標準像素 | alpha | origin | 用途 |
|---|---|---:|---|---|---|
| night_market | night-market.png | 1280×720 | 否 | .5,.5 | 主背景 |
| stall | bubble-tea-stall.png | 800×600 | 是 | .5,1 | 攤位 |
| boss | boss.png | 384×512 | 是 | .5,1 | 老闆 |
| customer_1_happy / waiting / angry | customer-1-{mood}.png | 256×384 | 是 | .5,1 | 顧客 1 |
| customer_2_happy / waiting / angry | customer-2-{mood}.png | 256×384 | 是 | .5,1 | 顧客 2 |
| customer_3_happy / waiting / angry | customer-3-{mood}.png | 256×384 | 是 | .5,1 | 顧客 3 |
| tea_black / tea_green | tea-{color}.png | 192×192 | 是 | .5,.5 | 茶底 |
| pearl / ice / cup | {id}.png | 192×192 | 是 | .5,.5 | 原料與杯 |
| finished_drink | finished-drink.png | 256×384 | 是 | .5,1 | 成品 |
| ui_button / coin / star | {id}.png | 192×192 | 是 | .5,.5 | 操作與結算 |

Manifest：`public/assets/manifest.json`；每筆包含 id、fileName、path、width、height、hasAlpha、originX、originY、usage、licenseSource。程式須依 manifest 使用檔案，不得硬編碼佔位圖片。圖片可由同一原始 sprite sheet 切出不同情緒或圖示；裁切後的正式檔案需個別通過尺寸、alpha、非空白像素檢查。背景與攤位維持一致的暖色燈箱、台灣夜市氛圍；角色用一致的 Q 版比例、柔和描邊與鮮明配色。

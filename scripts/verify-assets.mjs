import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'public/assets/manifest.json'), 'utf8'));
let checked = 0;
function verify(entry) {
  const file = join(root, 'public', entry.path.replace(/^\//, ''));
  if (!file.startsWith(join(root, 'public/assets/') ) || !existsSync(file)) throw new Error(`素材遺失或路徑不安全：${entry.id}`);
  const png = readFileSync(file);
  if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`PNG 檔頭無效：${entry.id}`);
  let pos = 8, width = 0, height = 0, color = 0, depth = 0, interlace = 0;
  const data = [];
  while (pos + 12 <= png.length) {
    const length = png.readUInt32BE(pos), type = png.toString('ascii', pos + 4, pos + 8);
    const chunk = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') { width=chunk.readUInt32BE(0); height=chunk.readUInt32BE(4); depth=chunk[8]; color=chunk[9]; interlace=chunk[12]; }
    if (type === 'IDAT') data.push(chunk);
    pos += length + 12;
    if (type === 'IEND') break;
  }
  if (width !== entry.width || height !== entry.height) throw new Error(`尺寸不符：${entry.id} ${width}×${height}`);
  if (depth !== 8 || interlace !== 0 || ![2,6].includes(color)) throw new Error(`不支援的 PNG 編碼：${entry.id}`);
  if (entry.hasAlpha && color !== 6) throw new Error(`缺少 RGBA 透明通道：${entry.id}`);
  const channels = color === 6 ? 4 : 3, stride = width * channels;
  const raw = inflateSync(Buffer.concat(data));
  if (raw.length !== (stride + 1) * height) throw new Error(`像素資料不完整：${entry.id}`);
  let previous = Buffer.alloc(stride), offset = 0, visible = 0, transparent = 0;
  const colors = new Set();
  for (let y=0; y<height; y++) {
    const filter = raw[offset++], row = Buffer.from(raw.subarray(offset, offset + stride)); offset += stride;
    for (let x=0; x<stride; x++) {
      const left = x >= channels ? row[x-channels] : 0, above=previous[x], upperLeft=x>=channels?previous[x-channels]:0;
      let predictor=0;
      if (filter===1) predictor=left;
      else if (filter===2) predictor=above;
      else if (filter===3) predictor=Math.floor((left+above)/2);
      else if (filter===4) { const p=left+above-upperLeft, a=Math.abs(p-left), b=Math.abs(p-above), c=Math.abs(p-upperLeft); predictor=a<=b&&a<=c?left:b<=c?above:upperLeft; }
      else if (filter!==0) throw new Error(`PNG 濾鏡無效：${entry.id}`);
      row[x]=(row[x]+predictor)&255;
    }
    for (let x=0; x<stride; x+=channels) {
      const alpha=channels===4?row[x+3]:255;
      if (alpha>10) { visible++; if (colors.size<100) colors.add(`${row[x]},${row[x+1]},${row[x+2]}`); }
      if (alpha===0) transparent++;
    }
    previous=row;
  }
  if (visible < width*height*0.02 || colors.size < 20) throw new Error(`空白或內容不足：${entry.id}`);
  if (entry.hasAlpha && transparent === 0) throw new Error(`透明背景缺失：${entry.id}`);
  checked++;
}
for (const entry of manifest.assets) verify(entry);
console.log(`素材驗證通過：${checked} 個 PNG，尺寸、透明度與非空白像素符合契約。`);

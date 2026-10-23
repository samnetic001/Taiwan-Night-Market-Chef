/** The public manifest is the only source of URLs for finished artwork. */
export const ASSET_MANIFEST_URL = '/assets/manifest.json';

export const REQUIRED_ASSET_IDS = [
  'night_market', 'stall', 'boss',
  'customer_1_happy', 'customer_1_waiting', 'customer_1_angry',
  'customer_2_happy', 'customer_2_waiting', 'customer_2_angry',
  'customer_3_happy', 'customer_3_waiting', 'customer_3_angry',
  'tea_black', 'tea_green', 'pearl', 'ice', 'cup',
  'finished_drink', 'ui_button', 'coin', 'star',
] as const;

export type AssetId = (typeof REQUIRED_ASSET_IDS)[number];
const requiredAssetIds = new Set<string>(REQUIRED_ASSET_IDS);

export interface AssetEntry {
  readonly id: AssetId;
  readonly fileName: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly originX: number;
  readonly originY: number;
  readonly usage: string;
  readonly licenseSource: string;
}

export interface AssetManifest {
  readonly version: number;
  readonly assets: readonly AssetEntry[];
}

export interface AssetRegistry {
  readonly manifest: AssetManifest;
  get(id: AssetId): AssetEntry;
  url(id: AssetId): string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validEntry(value: unknown): value is AssetEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && requiredAssetIds.has(value.id) &&
    typeof value.fileName === 'string' &&
    /^[a-z0-9-]+\.png$/.test(value.fileName) &&
    typeof value.path === 'string' &&
    value.path === `/assets/${value.fileName}` &&
    typeof value.width === 'number' &&
    Number.isInteger(value.width) && Number(value.width) > 0 &&
    typeof value.height === 'number' &&
    Number.isInteger(value.height) && Number(value.height) > 0 &&
    typeof value.hasAlpha === 'boolean' &&
    typeof value.originX === 'number' && value.originX >= 0 && value.originX <= 1 &&
    typeof value.originY === 'number' && value.originY >= 0 && value.originY <= 1 &&
    typeof value.usage === 'string' &&
    value.licenseSource === 'codex-gui-imagegen';
}

export function createAssetRegistry(raw: unknown): AssetRegistry {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.assets)) {
    throw new Error('素材 manifest 格式或版本不正確');
  }
  const entries = new Map<string, AssetEntry>();
  for (const entry of raw.assets) {
    if (!validEntry(entry) || entries.has(entry.id)) {
      throw new Error('素材 manifest 含無效或重複的項目');
    }
    entries.set(entry.id, entry);
  }
  for (const id of REQUIRED_ASSET_IDS) {
    if (!entries.has(id)) throw new Error(`素材 manifest 缺少 ${id}`);
  }
  const manifest = raw as unknown as AssetManifest;
  return {
    manifest,
    get(id) {
      const entry = entries.get(id);
      if (!entry) throw new Error(`找不到素材：${id}`);
      return entry;
    },
    url(id) { return this.get(id).path; },
  };
}

export async function loadAssetManifest(fetcher: typeof fetch = fetch): Promise<AssetRegistry> {
  const response = await fetcher(ASSET_MANIFEST_URL);
  if (!response.ok) throw new Error(`無法載入素材 manifest：${response.status}`);
  return createAssetRegistry(await response.json());
}

/** Decode every official PNG and check dimensions before showing the game. */
export async function verifyBrowserImages(assets: AssetRegistry): Promise<void> {
  await Promise.all(assets.manifest.assets.map(async (entry) => {
    const picture = new Image();
    picture.src = entry.path;
    try {
      await picture.decode();
    } catch {
      throw new Error(`圖片無法解碼：${entry.id}`);
    }
    if (picture.naturalWidth !== entry.width || picture.naturalHeight !== entry.height) {
      throw new Error(`圖片尺寸與 manifest 不符：${entry.id}`);
    }
  }));
}

/** Register all official PNGs with Phaser's loader using manifest IDs as texture keys. */
export function queuePhaserAssets(
  scene: { load: { image: (key: string, url: string) => unknown } },
  assets: AssetRegistry,
): void {
  for (const entry of assets.manifest.assets) scene.load.image(entry.id, entry.path);
}

/** Apply the contract origin when a scene adds an image or sprite. */
export function setManifestOrigin<T extends { setOrigin: (x: number, y: number) => T }>(
  image: T,
  assets: AssetRegistry,
  id: AssetId,
): T {
  const { originX, originY } = assets.get(id);
  return image.setOrigin(originX, originY);
}

/** Fail visibly if the browser/Phaser did not actually decode a queued texture. */
export function assertPhaserTextures(
  scene: { textures: { exists: (key: string) => boolean } },
  assets: AssetRegistry,
): void {
  for (const entry of assets.manifest.assets) {
    if (!scene.textures.exists(entry.id)) throw new Error(`圖片載入失敗：${entry.id}`);
  }
}

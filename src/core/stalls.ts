import type {
  BubbleTeaRecipe,
  BubbleTeaWorkbench,
  CustomerArchetype,
  CustomerMood,
  IceLevel,
  StallDefinition,
  StallId,
  StallOptionChoice,
  Sweetness,
  TeaBase,
} from './types.ts';

export const ROUND_DURATION_MS = 120_000;
export const MAX_ACTIVE_ORDERS = 3;

export const TEA_OPTIONS: readonly StallOptionChoice<TeaBase>[] = [
  { value: 'black', label: '紅茶', assetId: 'tea_black' },
  { value: 'green', label: '綠茶', assetId: 'tea_green' },
] as const;

export const SWEETNESS_OPTIONS: readonly StallOptionChoice<Sweetness>[] = [
  { value: 'full', label: '全糖' },
  { value: 'half', label: '半糖' },
  { value: 'none', label: '無糖' },
] as const;

export const ICE_OPTIONS: readonly StallOptionChoice<IceLevel>[] = [
  { value: 'regular', label: '正常冰', assetId: 'ice' },
  { value: 'less', label: '少冰', assetId: 'ice' },
  { value: 'none', label: '去冰' },
] as const;

export const CUSTOMER_ARCHETYPES: readonly CustomerArchetype[] = [
  'customer_1',
  'customer_2',
  'customer_3',
] as const;

export function formatTeaLabel(tea: TeaBase): string {
  return tea === 'black' ? '紅茶' : '綠茶';
}

export function formatSweetnessLabel(sweetness: Sweetness): string {
  switch (sweetness) {
    case 'full':
      return '全糖';
    case 'half':
      return '半糖';
    case 'none':
      return '無糖';
  }
}

export function formatIceLabel(ice: IceLevel): string {
  switch (ice) {
    case 'regular':
      return '正常冰';
    case 'less':
      return '少冰';
    case 'none':
      return '去冰';
  }
}

export function formatPearlLabel(pearl: boolean): string {
  return pearl ? '加珍珠' : '不加珍珠';
}

export function describeBubbleTeaRecipe(recipe: BubbleTeaRecipe): readonly string[] {
  return [
    formatTeaLabel(recipe.tea),
    formatSweetnessLabel(recipe.sweetness),
    formatIceLabel(recipe.ice),
    formatPearlLabel(recipe.pearl),
  ];
}

export function formatBubbleTeaRecipeTitle(recipe: BubbleTeaRecipe): string {
  const baseName = recipe.tea === 'black' ? '奶茶' : '奶綠';
  const pearlPrefix = recipe.pearl ? '珍珠' : '職人';
  return `${pearlPrefix}${baseName}（${formatSweetnessLabel(recipe.sweetness)}・${formatIceLabel(recipe.ice)}）`;
}

export function isSameBubbleTeaRecipe(
  expected: BubbleTeaRecipe,
  actual: BubbleTeaRecipe,
): boolean {
  return (
    expected.tea === actual.tea &&
    expected.sweetness === actual.sweetness &&
    expected.ice === actual.ice &&
    expected.pearl === actual.pearl
  );
}

export function createEmptyWorkbench(): BubbleTeaWorkbench {
  return {
    hasCup: false,
    tea: null,
    sweetness: null,
    ice: null,
    pearl: false,
    isFinished: false,
  };
}

export function isWorkbenchIngredientsSelected(workbench: BubbleTeaWorkbench): boolean {
  return (
    workbench.hasCup &&
    workbench.tea !== null &&
    workbench.sweetness !== null &&
    workbench.ice !== null
  );
}

export function isWorkbenchComplete(workbench: BubbleTeaWorkbench): boolean {
  return isWorkbenchIngredientsSelected(workbench) && workbench.isFinished;
}

export function toRecipeFromWorkbench(
  workbench: BubbleTeaWorkbench,
): BubbleTeaRecipe | null {
  if (!isWorkbenchComplete(workbench) || !workbench.tea || !workbench.sweetness || !workbench.ice) {
    return null;
  }
  return {
    tea: workbench.tea,
    sweetness: workbench.sweetness,
    ice: workbench.ice,
    pearl: workbench.pearl,
  };
}

export function getCustomerTextureId(
  customer: CustomerArchetype,
  mood: CustomerMood,
): string {
  return `${customer}_${mood}`;
}

export const BUBBLE_TEA_STALL: StallDefinition<BubbleTeaRecipe> = {
  id: 'bubble_tea',
  name: '阿強手搖珍奶攤',
  subtitle: '第一關：台灣經典珍珠奶茶',
  availability: 'playable',
  stageOrder: 1,
  roundDurationMs: ROUND_DURATION_MS,
  maxActiveOrders: MAX_ACTIVE_ORDERS,
  stallAssetId: 'stall',
  backgroundAssetId: 'night_market',
  bossAssetId: 'boss',
  finishedProductAssetId: 'finished_drink',
  unlockRequirementStars: 0,
  steps: [
    {
      id: 'cup',
      label: '拿取空杯',
      required: true,
      description: '拿起透明手搖杯準備調飲',
    },
    {
      id: 'tea',
      label: '選擇茶底',
      required: true,
      description: '選擇紅茶或綠茶基底',
    },
    {
      id: 'sweetness',
      label: '調整甜度',
      required: true,
      description: '設定全糖、半糖或無糖',
    },
    {
      id: 'ice',
      label: '調整冰量',
      required: true,
      description: '設定正常冰、少冰或去冰',
    },
    {
      id: 'pearl',
      label: '可選配料',
      required: false,
      description: '依訂單需求加入黑糖珍珠',
    },
    {
      id: 'serve',
      label: '封膜出杯',
      required: true,
      description: '完成搖製並交付給指定客人',
    },
  ],
  defaultRecipe: {
    tea: 'black',
    sweetness: 'full',
    ice: 'regular',
    pearl: true,
  },
  describeRecipe: describeBubbleTeaRecipe,
  isRecipeEqual: isSameBubbleTeaRecipe,
};

export interface PlannedStallRecipe {
  readonly mainBase: string;
  readonly seasoning: string;
  readonly doneness: string;
  readonly garnish: boolean;
}

const comparePlannedRecipe = (a: PlannedStallRecipe, b: PlannedStallRecipe): boolean =>
  a.mainBase === b.mainBase &&
  a.seasoning === b.seasoning &&
  a.doneness === b.doneness &&
  a.garnish === b.garnish;

const describePlannedRecipe = (recipe: PlannedStallRecipe): readonly string[] => [
  recipe.mainBase,
  recipe.seasoning,
  recipe.doneness,
  recipe.garnish ? '加配料' : '原味',
];

export const STALL_DEFINITIONS: Readonly<Record<StallId, StallDefinition<any>>> = {
  bubble_tea: BUBBLE_TEA_STALL,
  fried_chicken: {
    id: 'fried_chicken',
    name: '廟口豪大雞排攤',
    subtitle: '第二關：酥炸火候與椒鹽辣度控制',
    availability: 'planned',
    stageOrder: 2,
    roundDurationMs: ROUND_DURATION_MS,
    maxActiveOrders: MAX_ACTIVE_ORDERS,
    stallAssetId: 'stall_fried_chicken',
    backgroundAssetId: 'night_market',
    bossAssetId: 'boss',
    finishedProductAssetId: 'finished_fried_chicken',
    unlockRequirementStars: 2,
    steps: [
      { id: 'coat', label: '裹粉下鍋', required: true, description: '選擇地瓜粉或脆皮粉漿' },
      { id: 'fry', label: '控制油溫', required: true, description: '炸至金黃酥脆避免焦黑' },
      { id: 'seasoning', label: '撒粉調味', required: true, description: '選擇椒鹽、梅粉或辣粉' },
      { id: 'cut', label: '剪切裝袋', required: false, description: '依客人要求切塊或不切' },
    ],
    defaultRecipe: {
      mainBase: 'chicken_cutlet',
      seasoning: 'pepper_salt',
      doneness: 'golden_crispy',
      garnish: true,
    } satisfies PlannedStallRecipe,
    describeRecipe: describePlannedRecipe,
    isRecipeEqual: comparePlannedRecipe,
  },
  stinky_tofu: {
    id: 'stinky_tofu',
    name: '老張脆皮臭豆腐',
    subtitle: '第三關：外酥內嫩與台式泡菜搭配',
    availability: 'planned',
    stageOrder: 3,
    roundDurationMs: ROUND_DURATION_MS,
    maxActiveOrders: MAX_ACTIVE_ORDERS,
    stallAssetId: 'stall_stinky_tofu',
    backgroundAssetId: 'night_market',
    bossAssetId: 'boss',
    finishedProductAssetId: 'finished_stinky_tofu',
    unlockRequirementStars: 4,
    steps: [
      { id: 'fry_tofu', label: '雙鍋酥炸', required: true, description: '控制低溫定型與高溫搶酥' },
      { id: 'poke_sauce', label: '戳洞灌醬', required: true, description: '加入蒜蓉醬油與辣椒醬' },
      { id: 'kimchi', label: '夾配泡菜', required: false, description: '搭配台式酸甜高麗菜泡菜' },
    ],
    defaultRecipe: {
      mainBase: 'crispy_tofu',
      seasoning: 'garlic_soy',
      doneness: 'extra_crispy',
      garnish: true,
    } satisfies PlannedStallRecipe,
    describeRecipe: describePlannedRecipe,
    isRecipeEqual: comparePlannedRecipe,
  },
  oyster_omelet: {
    id: 'oyster_omelet',
    name: '海港脆皮蚵仔煎',
    subtitle: '第四關：鐵板粉漿、鮮蚵雞蛋與甜辣醬',
    availability: 'planned',
    stageOrder: 4,
    roundDurationMs: ROUND_DURATION_MS,
    maxActiveOrders: MAX_ACTIVE_ORDERS,
    stallAssetId: 'stall_oyster_omelet',
    backgroundAssetId: 'night_market',
    bossAssetId: 'boss',
    finishedProductAssetId: 'finished_oyster_omelet',
    unlockRequirementStars: 6,
    steps: [
      { id: 'oyster', label: '鮮蚵下煎', required: true, description: '放置東石鮮蚵與淋上番薯粉漿' },
      { id: 'egg_greens', label: '加蛋小白菜', required: true, description: '打蛋並加入青菜翻面煎熟' },
      { id: 'sweet_chili', label: '淋海山醬', required: true, description: '依口味淋上甜辣醬或醬油膏' },
    ],
    defaultRecipe: {
      mainBase: 'fresh_oyster',
      seasoning: 'sweet_chili_sauce',
      doneness: 'crispy_edge',
      garnish: true,
    } satisfies PlannedStallRecipe,
    describeRecipe: describePlannedRecipe,
    isRecipeEqual: comparePlannedRecipe,
  },
  night_market_finale: {
    id: 'night_market_finale',
    name: '台灣夜市總決賽・天王爭霸',
    subtitle: '最終關：四大名攤綜合料理挑戰',
    availability: 'planned',
    stageOrder: 5,
    roundDurationMs: ROUND_DURATION_MS,
    maxActiveOrders: MAX_ACTIVE_ORDERS,
    stallAssetId: 'stall_finale',
    backgroundAssetId: 'night_market',
    bossAssetId: 'boss',
    finishedProductAssetId: 'finished_drink',
    unlockRequirementStars: 9,
    steps: [
      { id: 'dispatch', label: '辨識攤位訂單', required: true, description: '快速切換對應料理工序' },
      { id: 'cook', label: '複合製作', required: true, description: '完成飲品與熱食組合' },
      { id: 'combo_serve', label: '總決賽出餐', required: true, description: '維持高連擊取得夜市料理王稱號' },
    ],
    defaultRecipe: {
      mainBase: 'night_market_combo',
      seasoning: 'signature',
      doneness: 'perfect',
      garnish: true,
    } satisfies PlannedStallRecipe,
    describeRecipe: describePlannedRecipe,
    isRecipeEqual: comparePlannedRecipe,
  },
};

export function getStallDefinition(stallId: StallId = 'bubble_tea'): StallDefinition<any> {
  return STALL_DEFINITIONS[stallId];
}

export function listStallDefinitions(): readonly StallDefinition<any>[] {
  return Object.values(STALL_DEFINITIONS).sort((a, b) => a.stageOrder - b.stageOrder);
}

export function getPlayableStalls(): readonly StallDefinition<any>[] {
  return listStallDefinitions().filter((stall) => stall.availability === 'playable');
}

export function getUpcomingStalls(): readonly StallDefinition<any>[] {
  return listStallDefinitions().filter((stall) => stall.availability === 'planned');
}

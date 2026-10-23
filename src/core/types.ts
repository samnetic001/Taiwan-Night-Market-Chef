export type StallId =
  | 'bubble_tea'
  | 'fried_chicken'
  | 'stinky_tofu'
  | 'oyster_omelet'
  | 'night_market_finale';

export type StallAvailability = 'playable' | 'planned';

export type TeaBase = 'black' | 'green';
export type Sweetness = 'full' | 'half' | 'none';
export type IceLevel = 'regular' | 'less' | 'none';

export type CustomerArchetype = 'customer_1' | 'customer_2' | 'customer_3';
export type CustomerMood = 'happy' | 'waiting' | 'angry';

export type DifficultyTier = 1 | 2 | 3;

export type WaitRating = 'perfect' | 'good' | 'slow' | 'wrong' | 'expired';

export type RoundStatus = 'idle' | 'playing' | 'settled';

export interface BubbleTeaRecipe {
  readonly tea: TeaBase;
  readonly sweetness: Sweetness;
  readonly ice: IceLevel;
  readonly pearl: boolean;
}

export interface BubbleTeaWorkbench {
  readonly hasCup: boolean;
  readonly tea: TeaBase | null;
  readonly sweetness: Sweetness | null;
  readonly ice: IceLevel | null;
  readonly pearl: boolean;
  readonly isFinished: boolean;
}

export interface DifficultySnapshot {
  readonly tier: DifficultyTier;
  readonly label: string;
  readonly elapsedMs: number;
  readonly orderDurationMs: number;
  readonly spawnIntervalMs: number;
  readonly baseCoins: number;
  readonly pearlProbability: number;
}

export type OrderSlotIndex = 0 | 1 | 2;

export interface CustomerOrder<TRecipe = BubbleTeaRecipe> {
  readonly id: string;
  readonly slotIndex: OrderSlotIndex;
  readonly customer: CustomerArchetype;
  readonly recipe: TRecipe;
  readonly createdAtMs: number;
  readonly deadlineMs: number;
  readonly durationMs: number;
  readonly baseCoins: number;
  readonly mood: CustomerMood;
}

export type DeliveryOutcomeReason =
  | 'served'
  | 'wrong_recipe'
  | 'expired_before_delivery'
  | 'order_not_found'
  | 'workbench_incomplete'
  | 'round_not_active';

export interface DeliveryEvaluation {
  readonly orderId: string;
  readonly deliveredAtMs: number;
  readonly deadlineMs: number | null;
  readonly isOnTime: boolean;
  readonly isRecipeMatch: boolean;
  readonly accepted: boolean;
  readonly remainingMs: number;
  readonly remainingRatio: number;
  readonly waitRating: WaitRating;
  readonly customerMood: CustomerMood;
  readonly baseCoins: number;
  readonly speedBonusCoins: number;
  readonly streakBonusCoins: number;
  readonly penaltyCoins: number;
  readonly coinsDelta: number;
  readonly newStreak: number;
  readonly reason: DeliveryOutcomeReason;
}

export interface SettlementSummary {
  readonly stallId: StallId;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly totalCoins: number;
  readonly servedCount: number;
  readonly failedCount: number;
  readonly expiredCount: number;
  readonly wrongDeliveryCount: number;
  readonly maxStreak: number;
  readonly stars: 1 | 2 | 3;
  readonly title: string;
}

export interface StallOptionChoice<TValue extends string = string> {
  readonly value: TValue;
  readonly label: string;
  readonly assetId?: string;
}

export interface StallStationStep {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly description: string;
}

export interface StallDefinition<TRecipe = unknown> {
  readonly id: StallId;
  readonly name: string;
  readonly subtitle: string;
  readonly availability: StallAvailability;
  readonly stageOrder: number;
  readonly roundDurationMs: number;
  readonly maxActiveOrders: number;
  readonly stallAssetId: string;
  readonly backgroundAssetId: string;
  readonly bossAssetId: string;
  readonly finishedProductAssetId: string;
  readonly steps: readonly StallStationStep[];
  readonly unlockRequirementStars: number;
  readonly defaultRecipe: TRecipe;
  readonly describeRecipe: (recipe: TRecipe) => readonly string[];
  readonly isRecipeEqual: (expected: TRecipe, actual: TRecipe) => boolean;
}

export interface GameConfig {
  readonly stallId: StallId;
  readonly roundDurationMs: number;
  readonly maxActiveOrders: number;
  readonly initialSeed: number;
  readonly autoSpawnOnStart: boolean;
  readonly wrongRecipePenaltyCoins: number;
  readonly expiredOrderPenaltyCoins: number;
  readonly streakBonusPerLevel: number;
  readonly maxStreakBonusCoins: number;
}

export interface GameState {
  readonly config: GameConfig;
  readonly stallId: StallId;
  readonly status: RoundStatus;
  readonly rngState: number;
  readonly startedAtMs: number;
  readonly currentTimeMs: number;
  readonly roundDeadlineMs: number;
  readonly remainingRoundMs: number;
  readonly nextSpawnAtMs: number;
  readonly orderSequence: number;
  readonly difficulty: DifficultySnapshot;
  readonly activeOrders: readonly CustomerOrder<BubbleTeaRecipe>[];
  readonly workbench: BubbleTeaWorkbench;
  readonly coins: number;
  readonly servedCount: number;
  readonly failedCount: number;
  readonly expiredCount: number;
  readonly wrongDeliveryCount: number;
  readonly streak: number;
  readonly maxStreak: number;
  readonly lastEvaluation: DeliveryEvaluation | null;
  readonly settlement: SettlementSummary | null;
  readonly settlementCount: number;
}

export type GameEvent =
  | {
      readonly type: 'START_ROUND';
      readonly timestampMs: number;
      readonly seed?: number;
      readonly stallId?: StallId;
    }
  | {
      readonly type: 'ADVANCE_TIME';
      readonly timestampMs: number;
    }
  | {
      readonly type: 'SPAWN_ORDER';
      readonly timestampMs: number;
      readonly recipe?: BubbleTeaRecipe;
      readonly customer?: CustomerArchetype;
      readonly orderId?: string;
      readonly durationMs?: number;
    }
  | {
      readonly type: 'TAKE_CUP';
      readonly timestampMs: number;
    }
  | {
      readonly type: 'SELECT_TEA';
      readonly timestampMs: number;
      readonly tea: TeaBase;
    }
  | {
      readonly type: 'SELECT_SWEETNESS';
      readonly timestampMs: number;
      readonly sweetness: Sweetness;
    }
  | {
      readonly type: 'SELECT_ICE';
      readonly timestampMs: number;
      readonly ice: IceLevel;
    }
  | {
      readonly type: 'TOGGLE_PEARL';
      readonly timestampMs: number;
      readonly pearl?: boolean;
    }
  | {
      readonly type: 'FINISH_DRINK';
      readonly timestampMs: number;
    }
  | {
      readonly type: 'RESET_WORKBENCH';
      readonly timestampMs: number;
    }
  | {
      readonly type: 'DELIVER_ORDER';
      readonly timestampMs: number;
      readonly orderId: string;
      readonly recipe?: BubbleTeaRecipe;
    }
  | {
      readonly type: 'SETTLE_ROUND';
      readonly timestampMs: number;
    }
  | {
      readonly type: 'RESTART_ROUND';
      readonly timestampMs: number;
      readonly seed?: number;
    };

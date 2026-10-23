import {
  CUSTOMER_ARCHETYPES,
  ICE_OPTIONS,
  MAX_ACTIVE_ORDERS,
  ROUND_DURATION_MS,
  SWEETNESS_OPTIONS,
  TEA_OPTIONS,
  createEmptyWorkbench,
  isSameBubbleTeaRecipe,
  toRecipeFromWorkbench,
} from './stalls.ts';
import type {
  BubbleTeaRecipe,
  CustomerArchetype,
  CustomerMood,
  CustomerOrder,
  DeliveryEvaluation,
  DifficultySnapshot,
  GameConfig,
  GameEvent,
  GameState,
  OrderSlotIndex,
  SettlementSummary,
  WaitRating,
} from './types.ts';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  stallId: 'bubble_tea',
  roundDurationMs: ROUND_DURATION_MS,
  maxActiveOrders: MAX_ACTIVE_ORDERS,
  initialSeed: 20261023,
  autoSpawnOnStart: true,
  wrongRecipePenaltyCoins: 10,
  expiredOrderPenaltyCoins: 15,
  streakBonusPerLevel: 5,
  maxStreakBonusCoins: 25,
};

export interface RandomStep {
  readonly value: number;
  readonly nextSeed: number;
}

/**
 * 決定性 32-bit 偽隨機數產生器（Mulberry32 變體），確保相同初始狀態與事件序列產生完全相同結果。
 */
export function nextRandom(seed: number): RandomStep {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed };
}

function pickFromArray<T>(
  items: readonly T[],
  seed: number,
): { readonly item: T; readonly nextSeed: number } {
  const step = nextRandom(seed);
  const index = Math.min(items.length - 1, Math.floor(step.value * items.length));
  return {
    item: items[index]!,
    nextSeed: step.nextSeed,
  };
}

/**
 * 依經過時間計算難度階段：隨時間增加，客人等待耐心縮短、出現頻率加快、基礎金幣提高。
 */
export function getDifficultySnapshot(elapsedMs: number): DifficultySnapshot {
  const clampedElapsed = Math.max(0, elapsedMs);
  if (clampedElapsed < 40_000) {
    return {
      tier: 1,
      label: '夜市剛開張',
      elapsedMs: clampedElapsed,
      orderDurationMs: 24_000,
      spawnIntervalMs: 6_000,
      baseCoins: 30,
      pearlProbability: 0.4,
    };
  }
  if (clampedElapsed < 80_000) {
    return {
      tier: 2,
      label: '人潮湧現',
      elapsedMs: clampedElapsed,
      orderDurationMs: 19_000,
      spawnIntervalMs: 4_500,
      baseCoins: 35,
      pearlProbability: 0.55,
    };
  }
  return {
    tier: 3,
    label: '尖峰大排長龍',
    elapsedMs: clampedElapsed,
    orderDurationMs: 15_000,
    spawnIntervalMs: 3_500,
    baseCoins: 40,
    pearlProbability: 0.7,
  };
}

/**
 * 依目前時間與訂單期限計算客人情緒（happy / waiting / angry）。
 */
export function evaluateCustomerMood(
  currentTimeMs: number,
  createdAtMs: number,
  deadlineMs: number,
): CustomerMood {
  if (currentTimeMs > deadlineMs) {
    return 'angry';
  }
  const duration = Math.max(1, deadlineMs - createdAtMs);
  const remainingRatio = Math.max(0, (deadlineMs - currentTimeMs) / duration);
  if (remainingRatio >= 0.6) {
    return 'happy';
  }
  if (remainingRatio >= 0.3) {
    return 'waiting';
  }
  return 'angry';
}

/**
 * 依交付時間與訂單期限計算等待評價與速度獎勵金幣。
 * 嚴格遵守：`deliveredAtMs <= deadlineMs` 才視為準時；`deliveredAtMs === deadlineMs` 仍可交付。
 */
export function evaluateWaitPerformance(
  deliveredAtMs: number,
  createdAtMs: number,
  deadlineMs: number,
): {
  readonly isOnTime: boolean;
  readonly remainingMs: number;
  readonly remainingRatio: number;
  readonly waitRating: WaitRating;
  readonly speedBonusCoins: number;
} {
  if (deliveredAtMs > deadlineMs) {
    return {
      isOnTime: false,
      remainingMs: deadlineMs - deliveredAtMs,
      remainingRatio: 0,
      waitRating: 'expired',
      speedBonusCoins: 0,
    };
  }
  const duration = Math.max(1, deadlineMs - createdAtMs);
  const remainingMs = deadlineMs - deliveredAtMs;
  const remainingRatio = Math.max(0, Math.min(1, remainingMs / duration));

  if (remainingRatio >= 0.6) {
    return {
      isOnTime: true,
      remainingMs,
      remainingRatio,
      waitRating: 'perfect',
      speedBonusCoins: 15,
    };
  }
  if (remainingRatio >= 0.3) {
    return {
      isOnTime: true,
      remainingMs,
      remainingRatio,
      waitRating: 'good',
      speedBonusCoins: 8,
    };
  }
  return {
    isOnTime: true,
    remainingMs,
    remainingRatio,
    waitRating: 'slow',
    speedBonusCoins: 0,
  };
}

export function calculateStreakBonusCoins(
  streak: number,
  bonusPerLevel = DEFAULT_GAME_CONFIG.streakBonusPerLevel,
  maxBonus = DEFAULT_GAME_CONFIG.maxStreakBonusCoins,
): number {
  if (streak <= 1) {
    return 0;
  }
  return Math.min(maxBonus, (streak - 1) * bonusPerLevel);
}

export function calculateStarRating(
  totalCoins: number,
  servedCount: number,
  failedCount: number,
): 1 | 2 | 3 {
  if ((totalCoins >= 220 && servedCount >= 5 && failedCount <= 1) || totalCoins >= 260) {
    return 3;
  }
  if (totalCoins >= 110 && servedCount >= 3) {
    return 2;
  }
  return 1;
}

export function getStarTitle(stars: 1 | 2 | 3): string {
  switch (stars) {
    case 3:
      return '夜市珍奶傳奇';
    case 2:
      return '人氣手搖名攤';
    case 1:
      return '夜市新星攤長';
  }
}

export function generateBubbleTeaRecipe(
  seed: number,
  pearlProbability = 0.5,
): { readonly recipe: BubbleTeaRecipe; readonly nextSeed: number } {
  const teaPick = pickFromArray(TEA_OPTIONS, seed);
  const sweetnessPick = pickFromArray(SWEETNESS_OPTIONS, teaPick.nextSeed);
  const icePick = pickFromArray(ICE_OPTIONS, sweetnessPick.nextSeed);
  const pearlStep = nextRandom(icePick.nextSeed);

  return {
    recipe: {
      tea: teaPick.item.value,
      sweetness: sweetnessPick.item.value,
      ice: icePick.item.value,
      pearl: pearlStep.value < pearlProbability,
    },
    nextSeed: pearlStep.nextSeed,
  };
}

function findAvailableSlotIndex(
  activeOrders: readonly CustomerOrder<BubbleTeaRecipe>[],
  maxOrders: number,
): OrderSlotIndex | null {
  const usedSlots = new Set<number>(activeOrders.map((o) => o.slotIndex));
  for (let slot = 0; slot < Math.min(3, maxOrders); slot++) {
    if (!usedSlots.has(slot)) {
      return slot as OrderSlotIndex;
    }
  }
  return null;
}

export function createInitialGameState(
  overrides: Partial<GameConfig> = {},
): GameState {
  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    ...overrides,
  };
  const initialDifficulty = getDifficultySnapshot(0);
  return {
    config,
    stallId: config.stallId,
    status: 'idle',
    rngState: config.initialSeed >>> 0,
    startedAtMs: 0,
    currentTimeMs: 0,
    roundDeadlineMs: config.roundDurationMs,
    remainingRoundMs: config.roundDurationMs,
    nextSpawnAtMs: 0,
    orderSequence: 0,
    difficulty: initialDifficulty,
    activeOrders: [],
    workbench: createEmptyWorkbench(),
    coins: 0,
    servedCount: 0,
    failedCount: 0,
    expiredCount: 0,
    wrongDeliveryCount: 0,
    streak: 0,
    maxStreak: 0,
    lastEvaluation: null,
    settlement: null,
    settlementCount: 0,
  };
}

function spawnSingleOrderInternal(
  state: GameState,
  timestampMs: number,
  options?: {
    readonly recipe?: BubbleTeaRecipe;
    readonly customer?: CustomerArchetype;
    readonly orderId?: string;
    readonly durationMs?: number;
  },
): GameState {
  if (state.status !== 'playing') {
    return state;
  }
  if (timestampMs >= state.roundDeadlineMs) {
    return state;
  }
  if (state.activeOrders.length >= state.config.maxActiveOrders) {
    return state;
  }
  const slotIndex = findAvailableSlotIndex(state.activeOrders, state.config.maxActiveOrders);
  if (slotIndex === null) {
    return state;
  }

  const elapsedMs = Math.max(0, timestampMs - state.startedAtMs);
  const difficulty = getDifficultySnapshot(elapsedMs);
  let rngState = state.rngState;

  let customer: CustomerArchetype;
  if (options?.customer) {
    customer = options.customer;
  } else {
    const customerPick = pickFromArray(CUSTOMER_ARCHETYPES, rngState);
    customer = customerPick.item;
    rngState = customerPick.nextSeed;
  }

  let recipe: BubbleTeaRecipe;
  if (options?.recipe) {
    recipe = { ...options.recipe };
  } else {
    const generated = generateBubbleTeaRecipe(rngState, difficulty.pearlProbability);
    recipe = generated.recipe;
    rngState = generated.nextSeed;
  }

  const durationMs = options?.durationMs ?? difficulty.orderDurationMs;
  const nextSeq = state.orderSequence + 1;
  const orderId = options?.orderId ?? `order_${nextSeq}`;
  const deadlineMs = timestampMs + durationMs;

  const newOrder: CustomerOrder<BubbleTeaRecipe> = {
    id: orderId,
    slotIndex,
    customer,
    recipe,
    createdAtMs: timestampMs,
    deadlineMs,
    durationMs,
    baseCoins: difficulty.baseCoins,
    mood: evaluateCustomerMood(timestampMs, timestampMs, deadlineMs),
  };

  return {
    ...state,
    rngState,
    orderSequence: nextSeq,
    difficulty,
    activeOrders: [...state.activeOrders, newOrder],
  };
}

const expiredOrdersRegistry = new WeakMap<
  GameState,
  ReadonlyMap<string, CustomerOrder<BubbleTeaRecipe>>
>();

function getExpiredOrders(
  state: GameState,
): ReadonlyMap<string, CustomerOrder<BubbleTeaRecipe>> {
  return expiredOrdersRegistry.get(state) ?? new Map();
}

function withExpiredOrders(
  prevState: GameState,
  nextState: GameState,
  newlyExpired: readonly CustomerOrder<BubbleTeaRecipe>[] = [],
): GameState {
  const prevMap = getExpiredOrders(prevState);
  if (prevMap.size === 0 && newlyExpired.length === 0) {
    return nextState;
  }
  const merged = new Map(prevMap);
  for (const order of newlyExpired) {
    merged.set(order.id, order);
  }
  expiredOrdersRegistry.set(nextState, merged);
  return nextState;
}

/**
 * 處理在 effectiveTimeMs 時已逾時的訂單（嚴格比較 `order.deadlineMs < effectiveTimeMs`）。
 * 當 `effectiveTimeMs === order.deadlineMs` 時訂單尚未逾時，仍可交付。
 */
function expireOverdueOrdersAt(
  state: GameState,
  effectiveTimeMs: number,
): GameState {
  const remainingOrders: CustomerOrder<BubbleTeaRecipe>[] = [];
  const newlyExpired: CustomerOrder<BubbleTeaRecipe>[] = [];

  for (const order of state.activeOrders) {
    if (effectiveTimeMs > order.deadlineMs) {
      newlyExpired.push(order);
    } else {
      remainingOrders.push({
        ...order,
        mood: evaluateCustomerMood(effectiveTimeMs, order.createdAtMs, order.deadlineMs),
      });
    }
  }

  const expiredNowCount = newlyExpired.length;
  if (expiredNowCount === 0) {
    return withExpiredOrders(state, {
      ...state,
      activeOrders: remainingOrders,
    });
  }

  const totalPenalty = expiredNowCount * state.config.expiredOrderPenaltyCoins;
  return withExpiredOrders(
    state,
    {
      ...state,
      activeOrders: remainingOrders,
      coins: Math.max(0, state.coins - totalPenalty),
      failedCount: state.failedCount + expiredNowCount,
      expiredCount: state.expiredCount + expiredNowCount,
      streak: 0,
    },
    newlyExpired,
  );
}

function finalizeSettlement(
  state: GameState,
  endedAtMs: number,
): GameState {
  if (state.status === 'settled' && state.settlement !== null) {
    return state;
  }

  const clampedEndMs = Math.min(
    Math.max(state.startedAtMs, endedAtMs),
    state.roundDeadlineMs,
  );
  const stars = calculateStarRating(state.coins, state.servedCount, state.failedCount);
  const settlement: SettlementSummary = {
    stallId: state.stallId,
    startedAtMs: state.startedAtMs,
    endedAtMs: clampedEndMs,
    durationMs: clampedEndMs - state.startedAtMs,
    totalCoins: state.coins,
    servedCount: state.servedCount,
    failedCount: state.failedCount,
    expiredCount: state.expiredCount,
    wrongDeliveryCount: state.wrongDeliveryCount,
    maxStreak: state.maxStreak,
    stars,
    title: getStarTitle(stars),
  };

  return withExpiredOrders(state, {
    ...state,
    status: 'settled',
    currentTimeMs: clampedEndMs,
    remainingRoundMs: 0,
    workbench: createEmptyWorkbench(),
    settlement,
    settlementCount: state.settlementCount + 1,
  });
}

function advanceScheduledSpawnsUpTo(
  state: GameState,
  cappedTimeMs: number,
  options?: { readonly preserveOrderId?: string },
): GameState {
  let nextState = state;

  // 依序推進自動生單時間點，確保長時間跳躍時逾時與補單順序仍具決定性
  while (
    nextState.nextSpawnAtMs > 0 &&
    nextState.nextSpawnAtMs <= cappedTimeMs &&
    nextState.nextSpawnAtMs < nextState.roundDeadlineMs
  ) {
    const spawnTimeMs = nextState.nextSpawnAtMs;
    if (options?.preserveOrderId) {
      const preserved = nextState.activeOrders.find(
        (o) => o.id === options.preserveOrderId,
      );
      const others = nextState.activeOrders.filter(
        (o) => o.id !== options.preserveOrderId,
      );
      const expiredOthersState = expireOverdueOrdersAt(
        withExpiredOrders(nextState, { ...nextState, activeOrders: others }),
        spawnTimeMs,
      );
      nextState = withExpiredOrders(expiredOthersState, {
        ...expiredOthersState,
        activeOrders: preserved
          ? [...expiredOthersState.activeOrders, preserved]
          : expiredOthersState.activeOrders,
      });
    } else {
      nextState = expireOverdueOrdersAt(nextState, spawnTimeMs);
    }

    const elapsedAtSpawn = Math.max(0, spawnTimeMs - nextState.startedAtMs);
    const difficultyAtSpawn = getDifficultySnapshot(elapsedAtSpawn);

    if (nextState.activeOrders.length < nextState.config.maxActiveOrders) {
      nextState = withExpiredOrders(
        nextState,
        spawnSingleOrderInternal(nextState, spawnTimeMs),
      );
    }

    nextState = withExpiredOrders(nextState, {
      ...nextState,
      currentTimeMs: spawnTimeMs,
      difficulty: difficultyAtSpawn,
      nextSpawnAtMs: spawnTimeMs + difficultyAtSpawn.spawnIntervalMs,
    });
  }

  return nextState;
}

function advanceTimeInternal(
  state: GameState,
  timestampMs: number,
): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const targetTimeMs = Math.max(state.currentTimeMs, timestampMs);
  const cappedTimeMs = Math.min(targetTimeMs, state.roundDeadlineMs);

  let nextState = advanceScheduledSpawnsUpTo(state, cappedTimeMs);

  nextState = expireOverdueOrdersAt(nextState, cappedTimeMs);
  const elapsedMs = Math.max(0, cappedTimeMs - nextState.startedAtMs);
  const currentDifficulty = getDifficultySnapshot(elapsedMs);
  const remainingRoundMs = Math.max(0, nextState.roundDeadlineMs - cappedTimeMs);

  nextState = withExpiredOrders(nextState, {
    ...nextState,
    currentTimeMs: cappedTimeMs,
    remainingRoundMs,
    difficulty: currentDifficulty,
  });

  if (targetTimeMs >= nextState.roundDeadlineMs) {
    return finalizeSettlement(nextState, nextState.roundDeadlineMs);
  }

  return nextState;
}

function handleStartRound(
  state: GameState,
  timestampMs: number,
  seed?: number,
  stallId = state.config.stallId,
): GameState {
  const initialSeed = (seed ?? state.config.initialSeed) >>> 0;
  const difficulty = getDifficultySnapshot(0);
  const roundDeadlineMs = timestampMs + state.config.roundDurationMs;
  const nextSpawnAtMs = state.config.autoSpawnOnStart
    ? timestampMs + difficulty.spawnIntervalMs
    : 0;

  let nextState: GameState = {
    ...state,
    stallId,
    status: 'playing',
    rngState: initialSeed,
    startedAtMs: timestampMs,
    currentTimeMs: timestampMs,
    roundDeadlineMs,
    remainingRoundMs: state.config.roundDurationMs,
    nextSpawnAtMs,
    orderSequence: 0,
    difficulty,
    activeOrders: [],
    workbench: createEmptyWorkbench(),
    coins: 0,
    servedCount: 0,
    failedCount: 0,
    expiredCount: 0,
    wrongDeliveryCount: 0,
    streak: 0,
    maxStreak: 0,
    lastEvaluation: null,
    settlement: null,
    settlementCount: 0,
  };

  if (nextState.config.autoSpawnOnStart) {
    nextState = spawnSingleOrderInternal(nextState, timestampMs);
  }

  return nextState;
}

function handleDeliverOrder(
  state: GameState,
  timestampMs: number,
  orderId: string,
  explicitRecipe?: BubbleTeaRecipe,
): GameState {
  const effectiveTimeMs = Math.max(state.currentTimeMs, timestampMs);

  if (state.status !== 'playing') {
    const expiredOrder =
      state.status === 'settled' ? (getExpiredOrders(state).get(orderId) ?? null) : null;
    const deadlineMs =
      state.status === 'settled'
        ? (expiredOrder?.deadlineMs ?? state.roundDeadlineMs)
        : null;
    const evaluation: DeliveryEvaluation = {
      orderId,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs,
      isOnTime: false,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: deadlineMs !== null ? deadlineMs - effectiveTimeMs : 0,
      remainingRatio: 0,
      waitRating: 'expired',
      customerMood: 'angry',
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins: 0,
      coinsDelta: 0,
      newStreak: state.streak,
      reason: expiredOrder ? 'expired_before_delivery' : 'round_not_active',
    };
    return withExpiredOrders(state, {
      ...state,
      lastEvaluation: evaluation,
    });
  }

  // 若有效交付時間已經晚於整局 120 秒截止時間，視為局時已過並拒絕交付
  if (effectiveTimeMs > state.roundDeadlineMs) {
    const preAdvanced = advanceScheduledSpawnsUpTo(state, state.roundDeadlineMs, {
      preserveOrderId: orderId,
    });
    const targetOrder =
      preAdvanced.activeOrders.find((o) => o.id === orderId) ??
      getExpiredOrders(preAdvanced).get(orderId) ??
      null;
    const expiredState = expireOverdueOrdersAt(preAdvanced, preAdvanced.roundDeadlineMs);
    const settledState = finalizeSettlement(expiredState, preAdvanced.roundDeadlineMs);
    const evaluation: DeliveryEvaluation = {
      orderId,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs: targetOrder?.deadlineMs ?? preAdvanced.roundDeadlineMs,
      isOnTime: false,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: (targetOrder?.deadlineMs ?? preAdvanced.roundDeadlineMs) - effectiveTimeMs,
      remainingRatio: 0,
      waitRating: 'expired',
      customerMood: 'angry',
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins: preAdvanced.config.expiredOrderPenaltyCoins,
      coinsDelta: -Math.min(preAdvanced.coins, preAdvanced.config.expiredOrderPenaltyCoins),
      newStreak: 0,
      reason: 'expired_before_delivery',
    };
    return withExpiredOrders(settledState, {
      ...settledState,
      lastEvaluation: evaluation,
    });
  }

  const stateAtDeliveryTime = advanceScheduledSpawnsUpTo(state, effectiveTimeMs, {
    preserveOrderId: orderId,
  });
  const elapsedMs = Math.max(0, effectiveTimeMs - stateAtDeliveryTime.startedAtMs);
  const currentDifficulty = getDifficultySnapshot(elapsedMs);
  const remainingRoundMs = Math.max(0, stateAtDeliveryTime.roundDeadlineMs - effectiveTimeMs);

  const targetOrder = stateAtDeliveryTime.activeOrders.find((o) => o.id === orderId);
  if (!targetOrder) {
    const cleanedState = expireOverdueOrdersAt(stateAtDeliveryTime, effectiveTimeMs);
    const previouslyExpiredOrder = getExpiredOrders(cleanedState).get(orderId) ?? null;
    if (previouslyExpiredOrder) {
      const evaluation: DeliveryEvaluation = {
        orderId: previouslyExpiredOrder.id,
        deliveredAtMs: effectiveTimeMs,
        deadlineMs: previouslyExpiredOrder.deadlineMs,
        isOnTime: false,
        isRecipeMatch: false,
        accepted: false,
        remainingMs: previouslyExpiredOrder.deadlineMs - effectiveTimeMs,
        remainingRatio: 0,
        waitRating: 'expired',
        customerMood: 'angry',
        baseCoins: 0,
        speedBonusCoins: 0,
        streakBonusCoins: 0,
        penaltyCoins: 0,
        coinsDelta: 0,
        newStreak: 0,
        reason: 'expired_before_delivery',
      };
      const nextState = withExpiredOrders(cleanedState, {
        ...cleanedState,
        currentTimeMs: effectiveTimeMs,
        remainingRoundMs,
        difficulty: currentDifficulty,
        workbench: createEmptyWorkbench(),
        lastEvaluation: evaluation,
      });
      if (effectiveTimeMs >= nextState.roundDeadlineMs) {
        return finalizeSettlement(nextState, nextState.roundDeadlineMs);
      }
      return nextState;
    }

    const evaluation: DeliveryEvaluation = {
      orderId,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs: null,
      isOnTime: false,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: 0,
      remainingRatio: 0,
      waitRating: 'wrong',
      customerMood: 'angry',
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins: 0,
      coinsDelta: 0,
      newStreak: cleanedState.streak,
      reason: 'order_not_found',
    };
    const nextState = withExpiredOrders(cleanedState, {
      ...cleanedState,
      currentTimeMs: effectiveTimeMs,
      remainingRoundMs,
      difficulty: currentDifficulty,
      lastEvaluation: evaluation,
    });
    if (effectiveTimeMs >= nextState.roundDeadlineMs) {
      return finalizeSettlement(nextState, nextState.roundDeadlineMs);
    }
    return nextState;
  }

  // 核心規則：以單調不倒退的有效交付時間（effectiveTimeMs = max(state.currentTimeMs, timestampMs)）
  // 與訂單截止時間比較；effectiveTimeMs > deadlineMs 必定逾時，不可用較早的 timestampMs 回溯交付！
  if (effectiveTimeMs > targetOrder.deadlineMs) {
    const updatedOrders: CustomerOrder<BubbleTeaRecipe>[] = [];
    const newlyExpired: CustomerOrder<BubbleTeaRecipe>[] = [];

    for (const order of stateAtDeliveryTime.activeOrders) {
      if (order.id === targetOrder.id || effectiveTimeMs > order.deadlineMs) {
        newlyExpired.push(order);
      } else {
        updatedOrders.push({
          ...order,
          mood: evaluateCustomerMood(effectiveTimeMs, order.createdAtMs, order.deadlineMs),
        });
      }
    }

    const expiredCountDelta = newlyExpired.length;
    const totalPenalty = expiredCountDelta * stateAtDeliveryTime.config.expiredOrderPenaltyCoins;
    const coinsDelta = -Math.min(stateAtDeliveryTime.coins, totalPenalty);
    const evaluation: DeliveryEvaluation = {
      orderId: targetOrder.id,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs: targetOrder.deadlineMs,
      isOnTime: false,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: targetOrder.deadlineMs - effectiveTimeMs,
      remainingRatio: 0,
      waitRating: 'expired',
      customerMood: 'angry',
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins: stateAtDeliveryTime.config.expiredOrderPenaltyCoins,
      coinsDelta,
      newStreak: 0,
      reason: 'expired_before_delivery',
    };

    const nextState = withExpiredOrders(
      stateAtDeliveryTime,
      {
        ...stateAtDeliveryTime,
        currentTimeMs: effectiveTimeMs,
        remainingRoundMs,
        difficulty: currentDifficulty,
        activeOrders: updatedOrders,
        workbench: createEmptyWorkbench(),
        coins: Math.max(0, stateAtDeliveryTime.coins - totalPenalty),
        failedCount: stateAtDeliveryTime.failedCount + expiredCountDelta,
        expiredCount: stateAtDeliveryTime.expiredCount + expiredCountDelta,
        streak: 0,
        lastEvaluation: evaluation,
      },
      newlyExpired,
    );

    if (effectiveTimeMs >= nextState.roundDeadlineMs) {
      return finalizeSettlement(nextState, nextState.roundDeadlineMs);
    }
    return nextState;
  }

  // 先清理其他在 effectiveTimeMs 之前已過期的訂單（不含 targetOrder，因 targetOrder.deadlineMs >= effectiveTimeMs）
  const activeOrdersBeforeDelivery: CustomerOrder<BubbleTeaRecipe>[] = [];
  const otherExpiredOrders: CustomerOrder<BubbleTeaRecipe>[] = [];
  for (const order of stateAtDeliveryTime.activeOrders) {
    if (order.id !== targetOrder.id && effectiveTimeMs > order.deadlineMs) {
      otherExpiredOrders.push(order);
    } else {
      activeOrdersBeforeDelivery.push(order);
    }
  }

  const otherExpiredCount = otherExpiredOrders.length;
  const baseStateAfterOtherExpiries: GameState =
    otherExpiredCount > 0
      ? withExpiredOrders(
          stateAtDeliveryTime,
          {
            ...stateAtDeliveryTime,
            activeOrders: activeOrdersBeforeDelivery,
            coins: Math.max(
              0,
              stateAtDeliveryTime.coins -
                otherExpiredCount * stateAtDeliveryTime.config.expiredOrderPenaltyCoins,
            ),
            failedCount: stateAtDeliveryTime.failedCount + otherExpiredCount,
            expiredCount: stateAtDeliveryTime.expiredCount + otherExpiredCount,
            streak: 0,
          },
          otherExpiredOrders,
        )
      : stateAtDeliveryTime;

  const deliveredRecipe = explicitRecipe ?? toRecipeFromWorkbench(baseStateAfterOtherExpiries.workbench);
  if (!deliveredRecipe) {
    const evaluation: DeliveryEvaluation = {
      orderId: targetOrder.id,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs: targetOrder.deadlineMs,
      isOnTime: true,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: targetOrder.deadlineMs - effectiveTimeMs,
      remainingRatio:
        (targetOrder.deadlineMs - effectiveTimeMs) / Math.max(1, targetOrder.durationMs),
      waitRating: 'wrong',
      customerMood: evaluateCustomerMood(
        effectiveTimeMs,
        targetOrder.createdAtMs,
        targetOrder.deadlineMs,
      ),
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins: 0,
      coinsDelta: 0,
      newStreak: baseStateAfterOtherExpiries.streak,
      reason: 'workbench_incomplete',
    };
    return withExpiredOrders(baseStateAfterOtherExpiries, {
      ...baseStateAfterOtherExpiries,
      currentTimeMs: effectiveTimeMs,
      remainingRoundMs,
      difficulty: currentDifficulty,
      lastEvaluation: evaluation,
    });
  }

  const remainingOrders = baseStateAfterOtherExpiries.activeOrders
    .filter((o) => o.id !== targetOrder.id)
    .map((o) => ({
      ...o,
      mood: evaluateCustomerMood(effectiveTimeMs, o.createdAtMs, o.deadlineMs),
    }));

  const isRecipeMatch = isSameBubbleTeaRecipe(targetOrder.recipe, deliveredRecipe);
  const waitPerf = evaluateWaitPerformance(
    effectiveTimeMs,
    targetOrder.createdAtMs,
    targetOrder.deadlineMs,
  );

  if (!isRecipeMatch) {
    const penaltyCoins = baseStateAfterOtherExpiries.config.wrongRecipePenaltyCoins;
    const coinsDelta = -Math.min(baseStateAfterOtherExpiries.coins, penaltyCoins);
    const evaluation: DeliveryEvaluation = {
      orderId: targetOrder.id,
      deliveredAtMs: effectiveTimeMs,
      deadlineMs: targetOrder.deadlineMs,
      isOnTime: true,
      isRecipeMatch: false,
      accepted: false,
      remainingMs: waitPerf.remainingMs,
      remainingRatio: waitPerf.remainingRatio,
      waitRating: 'wrong',
      customerMood: 'angry',
      baseCoins: 0,
      speedBonusCoins: 0,
      streakBonusCoins: 0,
      penaltyCoins,
      coinsDelta,
      newStreak: 0,
      reason: 'wrong_recipe',
    };

    const nextState = withExpiredOrders(baseStateAfterOtherExpiries, {
      ...baseStateAfterOtherExpiries,
      currentTimeMs: effectiveTimeMs,
      remainingRoundMs,
      difficulty: currentDifficulty,
      activeOrders: remainingOrders,
      workbench: createEmptyWorkbench(),
      coins: Math.max(0, baseStateAfterOtherExpiries.coins - penaltyCoins),
      failedCount: baseStateAfterOtherExpiries.failedCount + 1,
      wrongDeliveryCount: baseStateAfterOtherExpiries.wrongDeliveryCount + 1,
      streak: 0,
      lastEvaluation: evaluation,
    });

    if (effectiveTimeMs >= nextState.roundDeadlineMs) {
      return finalizeSettlement(nextState, nextState.roundDeadlineMs);
    }
    return nextState;
  }

  // 配方正確且 effectiveTimeMs <= deadlineMs
  const newStreak = baseStateAfterOtherExpiries.streak + 1;
  const streakBonusCoins = calculateStreakBonusCoins(
    newStreak,
    baseStateAfterOtherExpiries.config.streakBonusPerLevel,
    baseStateAfterOtherExpiries.config.maxStreakBonusCoins,
  );
  const coinsDelta =
    targetOrder.baseCoins + waitPerf.speedBonusCoins + streakBonusCoins;

  const evaluation: DeliveryEvaluation = {
    orderId: targetOrder.id,
    deliveredAtMs: effectiveTimeMs,
    deadlineMs: targetOrder.deadlineMs,
    isOnTime: true,
    isRecipeMatch: true,
    accepted: true,
    remainingMs: waitPerf.remainingMs,
    remainingRatio: waitPerf.remainingRatio,
    waitRating: waitPerf.waitRating,
    customerMood: 'happy',
    baseCoins: targetOrder.baseCoins,
    speedBonusCoins: waitPerf.speedBonusCoins,
    streakBonusCoins,
    penaltyCoins: 0,
    coinsDelta,
    newStreak,
    reason: 'served',
  };

  const nextState = withExpiredOrders(baseStateAfterOtherExpiries, {
    ...baseStateAfterOtherExpiries,
    currentTimeMs: effectiveTimeMs,
    remainingRoundMs,
    difficulty: currentDifficulty,
    activeOrders: remainingOrders,
    workbench: createEmptyWorkbench(),
    coins: baseStateAfterOtherExpiries.coins + coinsDelta,
    servedCount: baseStateAfterOtherExpiries.servedCount + 1,
    streak: newStreak,
    maxStreak: Math.max(baseStateAfterOtherExpiries.maxStreak, newStreak),
    lastEvaluation: evaluation,
  });

  if (effectiveTimeMs >= nextState.roundDeadlineMs) {
    return finalizeSettlement(nextState, nextState.roundDeadlineMs);
  }
  return nextState;
}

/**
 * 純函式狀態轉移核心：給定目前 GameState 與單一 GameEvent，回傳全新的不可變 GameState。
 */
export function applyGameEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'START_ROUND':
      return handleStartRound(state, event.timestampMs, event.seed, event.stallId);

    case 'RESTART_ROUND':
      return handleStartRound(
        state,
        event.timestampMs,
        event.seed ?? state.config.initialSeed,
        state.stallId,
      );

    case 'ADVANCE_TIME':
      return advanceTimeInternal(state, event.timestampMs);

    case 'SPAWN_ORDER': {
      if (state.status !== 'playing') {
        return state;
      }
      const effectiveTimeMs = Math.max(state.currentTimeMs, event.timestampMs);
      if (effectiveTimeMs >= state.roundDeadlineMs) {
        const preAdvanced = advanceScheduledSpawnsUpTo(state, state.roundDeadlineMs);
        return finalizeSettlement(
          expireOverdueOrdersAt(preAdvanced, preAdvanced.roundDeadlineMs),
          preAdvanced.roundDeadlineMs,
        );
      }
      const scheduledState = advanceScheduledSpawnsUpTo(state, effectiveTimeMs);
      const cleanedState = expireOverdueOrdersAt(
        withExpiredOrders(scheduledState, {
          ...scheduledState,
          currentTimeMs: effectiveTimeMs,
          remainingRoundMs: Math.max(0, scheduledState.roundDeadlineMs - effectiveTimeMs),
          difficulty: getDifficultySnapshot(
            Math.max(0, effectiveTimeMs - scheduledState.startedAtMs),
          ),
        }),
        effectiveTimeMs,
      );
      return withExpiredOrders(
        cleanedState,
        spawnSingleOrderInternal(cleanedState, effectiveTimeMs, {
          recipe: event.recipe,
          customer: event.customer,
          orderId: event.orderId,
          durationMs: event.durationMs,
        }),
      );
    }

    case 'TAKE_CUP': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
        },
      });
    }

    case 'SELECT_TEA': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
          tea: event.tea,
          isFinished: false,
        },
      });
    }

    case 'SELECT_SWEETNESS': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
          sweetness: event.sweetness,
          isFinished: false,
        },
      });
    }

    case 'SELECT_ICE': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
          ice: event.ice,
          isFinished: false,
        },
      });
    }

    case 'TOGGLE_PEARL': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
          pearl: event.pearl !== undefined ? event.pearl : !advancedState.workbench.pearl,
          isFinished: false,
        },
      });
    }

    case 'FINISH_DRINK': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      const ready =
        advancedState.workbench.tea !== null &&
        advancedState.workbench.sweetness !== null &&
        advancedState.workbench.ice !== null;
      if (!ready) {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: {
          ...advancedState.workbench,
          hasCup: true,
          isFinished: true,
        },
      });
    }

    case 'RESET_WORKBENCH': {
      if (state.status !== 'playing') {
        return state;
      }
      const advancedState = advanceTimeInternal(state, event.timestampMs);
      if (advancedState.status !== 'playing') {
        return advancedState;
      }
      return withExpiredOrders(advancedState, {
        ...advancedState,
        workbench: createEmptyWorkbench(),
      });
    }

    case 'DELIVER_ORDER':
      return handleDeliverOrder(state, event.timestampMs, event.orderId, event.recipe);

    case 'SETTLE_ROUND': {
      if (state.status === 'idle') {
        return state;
      }
      if (state.status === 'settled') {
        return state;
      }
      const effectiveEndMs = Math.min(
        Math.max(state.currentTimeMs, event.timestampMs),
        state.roundDeadlineMs,
      );
      const scheduledState = advanceScheduledSpawnsUpTo(state, effectiveEndMs);
      const cleanedState = expireOverdueOrdersAt(scheduledState, effectiveEndMs);
      return finalizeSettlement(cleanedState, effectiveEndMs);
    }
  }
}

/**
 * 決定性事件序列執行器：從初始狀態依序套用事件陣列並回傳最終狀態。
 */
export function runGameEvents(
  initialState: GameState,
  events: readonly GameEvent[],
): GameState {
  let current = initialState;
  for (const event of events) {
    current = applyGameEvent(current, event);
  }
  return current;
}

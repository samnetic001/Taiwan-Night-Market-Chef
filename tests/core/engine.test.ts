import { describe, expect, it } from 'vitest';
import {
  BUBBLE_TEA_STALL,
  DESKTOP_LOGICAL_HEIGHT,
  DESKTOP_LOGICAL_WIDTH,
  MAX_ACTIVE_ORDERS,
  MIN_TOUCH_TARGET_CSS_PX,
  ROUND_DURATION_MS,
  STALL_DEFINITIONS,
  applyGameEvent,
  computeResponsiveLayout,
  createInitialGameState,
  describeBubbleTeaRecipe,
  evaluateCustomerMood,
  evaluateWaitPerformance,
  getDifficultySnapshot,
  getPlayableStalls,
  getStallDefinition,
  getUpcomingStalls,
  loadAudioEnabled,
  loadBestRecord,
  runGameEvents,
  saveAudioEnabled,
  saveSettlementToBestRecord,
  type BubbleTeaRecipe,
  type GameEvent,
  type StorageLike,
} from '../../src/core/index.ts';

class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('台灣夜市料理王：珍珠奶茶純函式事件核心', () => {
  it('支援 120 秒回合初始化、自動生成首張訂單與倒數計時', () => {
    const initial = createInitialGameState({ initialSeed: 1001 });
    expect(initial.status).toBe('idle');
    expect(initial.config.roundDurationMs).toBe(120_000);
    expect(ROUND_DURATION_MS).toBe(120_000);

    const started = applyGameEvent(initial, {
      type: 'START_ROUND',
      timestampMs: 1_000,
      seed: 1001,
    });

    expect(started.status).toBe('playing');
    expect(started.startedAtMs).toBe(1_000);
    expect(started.roundDeadlineMs).toBe(121_000);
    expect(started.remainingRoundMs).toBe(120_000);
    expect(started.activeOrders).toHaveLength(1);
    expect(started.activeOrders[0]?.slotIndex).toBe(0);
    expect(started.activeOrders[0]?.createdAtMs).toBe(1_000);
    expect(started.activeOrders[0]?.deadlineMs).toBe(25_000);
  });

  it('嚴格限制同時最多三張訂單（MAX_ACTIVE_ORDERS = 3），超額生單不會突破上限', () => {
    expect(MAX_ACTIVE_ORDERS).toBe(3);

    const state0 = createInitialGameState({
      initialSeed: 42,
      autoSpawnOnStart: false,
    });
    const events: GameEvent[] = [
      { type: 'START_ROUND', timestampMs: 0, seed: 42 },
      { type: 'SPAWN_ORDER', timestampMs: 100, orderId: 'o1' },
      { type: 'SPAWN_ORDER', timestampMs: 200, orderId: 'o2' },
      { type: 'SPAWN_ORDER', timestampMs: 300, orderId: 'o3' },
      { type: 'SPAWN_ORDER', timestampMs: 400, orderId: 'o4_ignored' },
      { type: 'SPAWN_ORDER', timestampMs: 500, orderId: 'o5_ignored' },
    ];

    const state = runGameEvents(state0, events);
    expect(state.activeOrders).toHaveLength(3);
    expect(state.activeOrders.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(state.activeOrders.map((o) => o.slotIndex)).toEqual([0, 1, 2]);
  });

  it('隨時間推進難度遞增（Tier 1 -> Tier 2 -> Tier 3），縮短訂單時限並加快生單間隔', () => {
    const tier1 = getDifficultySnapshot(0);
    const tier2 = getDifficultySnapshot(45_000);
    const tier3 = getDifficultySnapshot(90_000);

    expect(tier1.tier).toBe(1);
    expect(tier2.tier).toBe(2);
    expect(tier3.tier).toBe(3);

    expect(tier1.orderDurationMs).toBeGreaterThan(tier2.orderDurationMs);
    expect(tier2.orderDurationMs).toBeGreaterThan(tier3.orderDurationMs);

    expect(tier1.spawnIntervalMs).toBeGreaterThan(tier2.spawnIntervalMs);
    expect(tier2.spawnIntervalMs).toBeGreaterThan(tier3.spawnIntervalMs);

    expect(tier1.baseCoins).toBeLessThan(tier2.baseCoins);
    expect(tier2.baseCoins).toBeLessThan(tier3.baseCoins);
  });

  it('正確配方與錯誤配方判定、等待評價（perfect/good/slow）與金幣獎懲', () => {
    const targetRecipe: BubbleTeaRecipe = {
      tea: 'black',
      sweetness: 'half',
      ice: 'less',
      pearl: true,
    };

    const state0 = createInitialGameState({ autoSpawnOnStart: false });
    const afterStart = runGameEvents(state0, [
      { type: 'START_ROUND', timestampMs: 0, seed: 77 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_fast',
        recipe: targetRecipe,
        durationMs: 20_000,
      },
      { type: 'TAKE_CUP', timestampMs: 1_000 },
      { type: 'SELECT_TEA', timestampMs: 1_500, tea: 'black' },
      { type: 'SELECT_SWEETNESS', timestampMs: 2_000, sweetness: 'half' },
      { type: 'SELECT_ICE', timestampMs: 2_500, ice: 'less' },
      { type: 'TOGGLE_PEARL', timestampMs: 3_000, pearl: true },
      { type: 'FINISH_DRINK', timestampMs: 3_500 },
      { type: 'DELIVER_ORDER', timestampMs: 4_000, orderId: 'order_fast' },
    ]);

    expect(afterStart.lastEvaluation?.accepted).toBe(true);
    expect(afterStart.lastEvaluation?.isRecipeMatch).toBe(true);
    expect(afterStart.lastEvaluation?.waitRating).toBe('perfect');
    expect(afterStart.lastEvaluation?.customerMood).toBe('happy');
    expect(afterStart.servedCount).toBe(1);
    expect(afterStart.failedCount).toBe(0);
    expect(afterStart.coins).toBe(45); // base 30 + perfect speed bonus 15
    expect(afterStart.workbench.hasCup).toBe(false);

    // 測試未執行 FINISH_DRINK（封膜出杯）時，即使已選好茶、甜度與冰量，也不得交付得分
    const afterUnfinishedAttempt = runGameEvents(afterStart, [
      {
        type: 'SPAWN_ORDER',
        timestampMs: 5_000,
        orderId: 'order_wrong',
        recipe: targetRecipe,
        durationMs: 20_000,
      },
      { type: 'SELECT_TEA', timestampMs: 5_200, tea: 'black' },
      { type: 'SELECT_SWEETNESS', timestampMs: 5_300, sweetness: 'half' },
      { type: 'SELECT_ICE', timestampMs: 5_400, ice: 'less' },
      { type: 'TOGGLE_PEARL', timestampMs: 5_500, pearl: true },
      { type: 'DELIVER_ORDER', timestampMs: 5_600, orderId: 'order_wrong' },
    ]);

    expect(afterUnfinishedAttempt.lastEvaluation?.accepted).toBe(false);
    expect(afterUnfinishedAttempt.lastEvaluation?.reason).toBe('workbench_incomplete');
    expect(afterUnfinishedAttempt.servedCount).toBe(1);
    expect(afterUnfinishedAttempt.coins).toBe(45);
    expect(afterUnfinishedAttempt.activeOrders).toHaveLength(1);

    // 測試錯誤配方交付：完成 FINISH_DRINK 後交付錯誤茶底，應扣減金幣、中斷連擊並計入失敗數與錯誤交付數
    const afterWrong = runGameEvents(afterUnfinishedAttempt, [
      { type: 'SELECT_TEA', timestampMs: 5_700, tea: 'green' }, // 茶底錯誤，且修改材料後需重新封膜
      { type: 'FINISH_DRINK', timestampMs: 5_800 },
      { type: 'DELIVER_ORDER', timestampMs: 6_000, orderId: 'order_wrong' },
    ]);

    expect(afterWrong.lastEvaluation?.accepted).toBe(false);
    expect(afterWrong.lastEvaluation?.isRecipeMatch).toBe(false);
    expect(afterWrong.lastEvaluation?.reason).toBe('wrong_recipe');
    expect(afterWrong.lastEvaluation?.customerMood).toBe('angry');
    expect(afterWrong.failedCount).toBe(1);
    expect(afterWrong.wrongDeliveryCount).toBe(1);
    expect(afterWrong.streak).toBe(0);
    expect(afterWrong.coins).toBe(35); // 45 - 10 錯誤罰則

    // 測試等待評價區間與顧客情緒
    expect(evaluateWaitPerformance(5_000, 0, 20_000).waitRating).toBe('perfect');
    expect(evaluateWaitPerformance(12_000, 0, 20_000).waitRating).toBe('good');
    expect(evaluateWaitPerformance(18_000, 0, 20_000).waitRating).toBe('slow');
    expect(evaluateCustomerMood(2_000, 0, 20_000)).toBe('happy');
    expect(evaluateCustomerMood(10_000, 0, 20_000)).toBe('waiting');
    expect(evaluateCustomerMood(17_000, 0, 20_000)).toBe('angry');
  });

  it('驗證期限邊界：交付時間等於期限（timestampMs === deadlineMs）仍可成功交付；晚於期限（timestampMs > deadlineMs）必定逾時', () => {
    const recipe: BubbleTeaRecipe = {
      tea: 'green',
      sweetness: 'none',
      ice: 'regular',
      pearl: false,
    };

    const initial = createInitialGameState({ autoSpawnOnStart: false });

    // 1. 等於期限（timestampMs === deadlineMs = 20_000）仍可交付
    const exactDeadlineState = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 555 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_exact_deadline',
        recipe,
        durationMs: 20_000,
      },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 20_000,
        orderId: 'order_exact_deadline',
        recipe,
      },
    ]);

    expect(exactDeadlineState.lastEvaluation?.accepted).toBe(true);
    expect(exactDeadlineState.lastEvaluation?.isOnTime).toBe(true);
    expect(exactDeadlineState.lastEvaluation?.remainingMs).toBe(0);
    expect(exactDeadlineState.lastEvaluation?.waitRating).toBe('slow');
    expect(exactDeadlineState.servedCount).toBe(1);
    expect(exactDeadlineState.expiredCount).toBe(0);

    // 2. 晚於期限 1 毫秒（timestampMs = 20_001 > deadlineMs = 20_000），即使未先呼叫 ADVANCE_TIME 也必定視為逾時！
    const lateByOneMsState = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 555 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_late_1ms',
        recipe,
        durationMs: 20_000,
      },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 20_001,
        orderId: 'order_late_1ms',
        recipe,
      },
    ]);

    expect(lateByOneMsState.lastEvaluation?.accepted).toBe(false);
    expect(lateByOneMsState.lastEvaluation?.isOnTime).toBe(false);
    expect(lateByOneMsState.lastEvaluation?.waitRating).toBe('expired');
    expect(lateByOneMsState.lastEvaluation?.reason).toBe('expired_before_delivery');
    expect(lateByOneMsState.servedCount).toBe(0);
    expect(lateByOneMsState.failedCount).toBe(1);
    expect(lateByOneMsState.expiredCount).toBe(1);
    expect(lateByOneMsState.activeOrders).toHaveLength(0);
  });

  it('時間邊界回歸：SPAWN_ORDER 在整局截止時間等於 120 秒時不可再產生訂單，並應完成回合結算', () => {
    const initial = createInitialGameState({
      initialSeed: 2026,
      autoSpawnOnStart: false,
    });

    // 1. 距離截止尚有 1ms（119_999ms < roundDeadlineMs = 120_000ms）時仍可生單
    const beforeDeadline = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 2026 },
      { type: 'SPAWN_ORDER', timestampMs: 119_999, orderId: 'order_before_end' },
    ]);
    expect(beforeDeadline.status).toBe('playing');
    expect(beforeDeadline.activeOrders.map((o) => o.id)).toEqual(['order_before_end']);

    // 2. 整局截止時間正好等於 120 秒（timestampMs === roundDeadlineMs = 120_000ms）時不可再產生新訂單
    const atExactRoundDeadline = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 2026 },
      { type: 'SPAWN_ORDER', timestampMs: 120_000, orderId: 'order_at_120s_forbidden' },
    ]);
    expect(atExactRoundDeadline.status).toBe('settled');
    expect(atExactRoundDeadline.currentTimeMs).toBe(120_000);
    expect(atExactRoundDeadline.remainingRoundMs).toBe(0);
    expect(atExactRoundDeadline.activeOrders).toHaveLength(0);
    expect(atExactRoundDeadline.orderSequence).toBe(0);
    expect(atExactRoundDeadline.settlement).not.toBeNull();

    // 3. 非零起點（startedAtMs = 1_000, roundDeadlineMs = 121_000）於 121_000ms 呼叫 SPAWN_ORDER 亦不可產生該訂單
    const offsetStartState = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 1_000, seed: 2026 },
      { type: 'SPAWN_ORDER', timestampMs: 121_000, orderId: 'order_at_offset_120s' },
    ]);
    expect(offsetStartState.status).toBe('settled');
    expect(offsetStartState.activeOrders).toHaveLength(0);
    expect(offsetStartState.orderSequence).toBe(0);
  });

  it('時間邊界回歸：DELIVER_ORDER 不可用早於 state.currentTimeMs 的事件時間回溯取得及時交付或速度獎勵', () => {
    const recipe: BubbleTeaRecipe = {
      tea: 'black',
      sweetness: 'half',
      ice: 'less',
      pearl: true,
    };

    const initial = createInitialGameState({
      initialSeed: 3030,
      autoSpawnOnStart: false,
    });

    // 1. 防止回溯取得速度獎勵：state.currentTimeMs 已推進至 18_000ms（剩餘 2_000ms，應為 slow / +0 速度獎勵），
    //    此時傳入 timestampMs = 2_000ms 的 DELIVER_ORDER 不得回溯取得 perfect（+15 速度獎勵）
    const noBackdatedSpeedBonus = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 3030 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_speed_check',
        recipe,
        durationMs: 20_000,
      },
      { type: 'ADVANCE_TIME', timestampMs: 18_000 },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 2_000,
        orderId: 'order_speed_check',
        recipe,
      },
    ]);

    expect(noBackdatedSpeedBonus.currentTimeMs).toBe(18_000);
    expect(noBackdatedSpeedBonus.lastEvaluation?.accepted).toBe(true);
    expect(noBackdatedSpeedBonus.lastEvaluation?.deliveredAtMs).toBe(18_000);
    expect(noBackdatedSpeedBonus.lastEvaluation?.remainingMs).toBe(2_000);
    expect(noBackdatedSpeedBonus.lastEvaluation?.waitRating).toBe('slow');
    expect(noBackdatedSpeedBonus.lastEvaluation?.speedBonusCoins).toBe(0);
    expect(noBackdatedSpeedBonus.coins).toBe(30); // 僅基礎 30 金幣，無 perfect 速度獎勵

    // 2. 防止透過其他訂單的回溯時間戳保留已過期訂單並回溯取得及時交付：
    //    order_short 期限為 20_000ms，order_long 期限為 30_000ms；
    //    當時間已來到 25_000ms 時，即使連續傳入 timestampMs = 10_000ms 的回溯 DELIVER_ORDER，
    //    order_short 也已在有效時間 25_000ms 逾時，絕不可被回溯成功交付！
    const stateAt20s = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 3030 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_short',
        recipe,
        durationMs: 20_000,
      },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_long',
        recipe,
        durationMs: 30_000,
      },
      { type: 'ADVANCE_TIME', timestampMs: 20_000 },
    ]);

    // 模擬 state.currentTimeMs 已在 25_000ms（超過 order_short 期限 20_000ms），但呼叫端試圖以 timestampMs = 10_000ms 回溯交付
    const stateWithAdvancedClock = {
      ...stateAt20s,
      currentTimeMs: 25_000,
      remainingRoundMs: 95_000,
    };

    const backdatedTimelyAttempt = applyGameEvent(stateWithAdvancedClock, {
      type: 'DELIVER_ORDER',
      timestampMs: 10_000,
      orderId: 'order_short',
      recipe,
    });

    expect(backdatedTimelyAttempt.lastEvaluation?.accepted).toBe(false);
    expect(backdatedTimelyAttempt.lastEvaluation?.isOnTime).toBe(false);
    expect(backdatedTimelyAttempt.lastEvaluation?.deliveredAtMs).toBe(25_000);
    expect(backdatedTimelyAttempt.lastEvaluation?.waitRating).toBe('expired');
    expect(backdatedTimelyAttempt.lastEvaluation?.reason).toBe('expired_before_delivery');
    expect(backdatedTimelyAttempt.servedCount).toBe(0);
    expect(backdatedTimelyAttempt.expiredCount).toBe(1);

    // 3. 先交付 order_long 使 currentTimeMs 推進至 25_000ms 時，order_short 應立即按有效時間 25_000ms 判定逾時，
    //    後續再以 timestampMs = 10_000ms 交付 order_short 亦不可成功
    const afterDeliverLongThenBackdatedShort = runGameEvents(stateWithAdvancedClock, [
      {
        type: 'DELIVER_ORDER',
        timestampMs: 10_000,
        orderId: 'order_long',
        recipe,
      },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 10_000,
        orderId: 'order_short',
        recipe,
      },
    ]);

    expect(afterDeliverLongThenBackdatedShort.servedCount).toBe(1);
    expect(afterDeliverLongThenBackdatedShort.expiredCount).toBe(1);
    expect(afterDeliverLongThenBackdatedShort.lastEvaluation?.accepted).toBe(false);
    expect(afterDeliverLongThenBackdatedShort.lastEvaluation?.isOnTime).toBe(false);

    // 4. 製作事件（TAKE_CUP、選料、FINISH_DRINK）會依 timestampMs 單調遞增推進時間：
    //    在 18_000ms 完成製作後，以較早的 timestampMs = 2_000ms 送出 DELIVER_ORDER，不可取得 perfect 速度獎勵
    const craftedLateThenBackdatedDeliver = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 3030 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_crafted_late',
        recipe,
        durationMs: 20_000,
      },
      { type: 'TAKE_CUP', timestampMs: 15_000 },
      { type: 'SELECT_TEA', timestampMs: 16_000, tea: recipe.tea },
      { type: 'SELECT_SWEETNESS', timestampMs: 16_500, sweetness: recipe.sweetness },
      { type: 'SELECT_ICE', timestampMs: 17_000, ice: recipe.ice },
      { type: 'TOGGLE_PEARL', timestampMs: 17_500, pearl: recipe.pearl },
      { type: 'FINISH_DRINK', timestampMs: 18_000 },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 2_000,
        orderId: 'order_crafted_late',
      },
    ]);

    expect(craftedLateThenBackdatedDeliver.currentTimeMs).toBe(18_000);
    expect(craftedLateThenBackdatedDeliver.lastEvaluation?.accepted).toBe(true);
    expect(craftedLateThenBackdatedDeliver.lastEvaluation?.deliveredAtMs).toBe(18_000);
    expect(craftedLateThenBackdatedDeliver.lastEvaluation?.waitRating).toBe('slow');
    expect(craftedLateThenBackdatedDeliver.lastEvaluation?.speedBonusCoins).toBe(0);
    expect(craftedLateThenBackdatedDeliver.coins).toBe(30);

    // 5. 在超過訂單期限（25_000ms > 20_000ms）或超過整局 120 秒（125_000ms）後才送出 TAKE_CUP、選料與 FINISH_DRINK，
    //    再以較早的 DELIVER_ORDER 時間（2_000ms）交付，絕不可取得及時交付或速度獎勵，且超過 120 秒應完成回合結算
    const craftedAfterOrderDeadline = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 3030 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_expired_during_craft',
        recipe,
        durationMs: 20_000,
      },
      { type: 'TAKE_CUP', timestampMs: 21_000 },
      { type: 'SELECT_TEA', timestampMs: 22_000, tea: recipe.tea },
      { type: 'SELECT_SWEETNESS', timestampMs: 23_000, sweetness: recipe.sweetness },
      { type: 'SELECT_ICE', timestampMs: 24_000, ice: recipe.ice },
      { type: 'TOGGLE_PEARL', timestampMs: 24_500, pearl: recipe.pearl },
      { type: 'FINISH_DRINK', timestampMs: 25_000 },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 2_000,
        orderId: 'order_expired_during_craft',
      },
    ]);

    expect(craftedAfterOrderDeadline.currentTimeMs).toBe(25_000);
    expect(craftedAfterOrderDeadline.servedCount).toBe(0);
    expect(craftedAfterOrderDeadline.expiredCount).toBe(1);
    expect(craftedAfterOrderDeadline.lastEvaluation?.accepted).toBe(false);
    expect(craftedAfterOrderDeadline.lastEvaluation?.isOnTime).toBe(false);
    expect(craftedAfterOrderDeadline.lastEvaluation?.waitRating).toBe('expired');
    expect(craftedAfterOrderDeadline.lastEvaluation?.reason).toBe('expired_before_delivery');

    const craftedAfterRoundDeadline = runGameEvents(initial, [
      { type: 'START_ROUND', timestampMs: 0, seed: 3030 },
      {
        type: 'SPAWN_ORDER',
        timestampMs: 0,
        orderId: 'order_after_120s_craft',
        recipe,
        durationMs: 20_000,
      },
      { type: 'TAKE_CUP', timestampMs: 121_000 },
      { type: 'SELECT_TEA', timestampMs: 122_000, tea: recipe.tea },
      { type: 'SELECT_SWEETNESS', timestampMs: 123_000, sweetness: recipe.sweetness },
      { type: 'SELECT_ICE', timestampMs: 124_000, ice: recipe.ice },
      { type: 'TOGGLE_PEARL', timestampMs: 124_500, pearl: recipe.pearl },
      { type: 'FINISH_DRINK', timestampMs: 125_000 },
      {
        type: 'DELIVER_ORDER',
        timestampMs: 2_000,
        orderId: 'order_after_120s_craft',
      },
    ]);

    expect(craftedAfterRoundDeadline.status).toBe('settled');
    expect(craftedAfterRoundDeadline.currentTimeMs).toBe(120_000);
    expect(craftedAfterRoundDeadline.servedCount).toBe(0);
    expect(craftedAfterRoundDeadline.coins).toBe(0);
    expect(craftedAfterRoundDeadline.workbench.isFinished).toBe(false);
    expect(craftedAfterRoundDeadline.lastEvaluation?.accepted).toBe(false);
    expect(craftedAfterRoundDeadline.lastEvaluation?.isOnTime).toBe(false);
    expect(craftedAfterRoundDeadline.lastEvaluation?.waitRating).toBe('expired');
  });

  it('支援連續成功 Bonus（連擊加成）、逾時中斷連擊、回合結算與不可重複結算、重新開始', () => {
    const recipe: BubbleTeaRecipe = {
      tea: 'black',
      sweetness: 'full',
      ice: 'regular',
      pearl: true,
    };

    const state0 = createInitialGameState({ autoSpawnOnStart: false });
    const afterStreak = runGameEvents(state0, [
      { type: 'START_ROUND', timestampMs: 0, seed: 888 },
      { type: 'SPAWN_ORDER', timestampMs: 0, orderId: 's1', recipe, durationMs: 20_000 },
      { type: 'DELIVER_ORDER', timestampMs: 2_000, orderId: 's1', recipe },
      { type: 'SPAWN_ORDER', timestampMs: 3_000, orderId: 's2', recipe, durationMs: 20_000 },
      { type: 'DELIVER_ORDER', timestampMs: 5_000, orderId: 's2', recipe },
      { type: 'SPAWN_ORDER', timestampMs: 6_000, orderId: 's3', recipe, durationMs: 20_000 },
      { type: 'DELIVER_ORDER', timestampMs: 8_000, orderId: 's3', recipe },
    ]);

    expect(afterStreak.streak).toBe(3);
    expect(afterStreak.maxStreak).toBe(3);
    expect(afterStreak.lastEvaluation?.streakBonusCoins).toBe(10); // (3 - 1) * 5
    // 第 1 單 45 + 第 2 單 50 + 第 3 單 55 = 150
    expect(afterStreak.coins).toBe(150);

    // 推進至 120 秒結束，觸發自動結算
    const settledOnce = applyGameEvent(afterStreak, {
      type: 'ADVANCE_TIME',
      timestampMs: 120_000,
    });

    expect(settledOnce.status).toBe('settled');
    expect(settledOnce.settlement).not.toBeNull();
    expect(settledOnce.settlementCount).toBe(1);
    expect(settledOnce.settlement?.totalCoins).toBe(settledOnce.coins);
    expect(settledOnce.settlement?.maxStreak).toBe(3);
    expect(settledOnce.settlement?.stars).toBeGreaterThanOrEqual(1);

    // 再次呼叫 SETTLE_ROUND 或 ADVANCE_TIME 不得重複結算
    const settledTwice = runGameEvents(settledOnce, [
      { type: 'SETTLE_ROUND', timestampMs: 125_000 },
      { type: 'ADVANCE_TIME', timestampMs: 130_000 },
    ]);
    expect(settledTwice.settlementCount).toBe(1);
    expect(settledTwice.settlement).toEqual(settledOnce.settlement);

    // 重新開始（RESTART_ROUND）應清空狀態並開啟新局
    const restarted = applyGameEvent(settledTwice, {
      type: 'RESTART_ROUND',
      timestampMs: 200_000,
      seed: 999,
    });
    expect(restarted.status).toBe('playing');
    expect(restarted.startedAtMs).toBe(200_000);
    expect(restarted.roundDeadlineMs).toBe(320_000);
    expect(restarted.coins).toBe(0);
    expect(restarted.servedCount).toBe(0);
    expect(restarted.failedCount).toBe(0);
    expect(restarted.streak).toBe(0);
    expect(restarted.settlement).toBeNull();
    expect(restarted.settlementCount).toBe(0);
  });

  it('決定性重播：相同初始狀態與事件序列必定產生完全相同的結果', () => {
    const events: readonly GameEvent[] = [
      { type: 'START_ROUND', timestampMs: 1_000, seed: 20261023 },
      { type: 'ADVANCE_TIME', timestampMs: 7_500 },
      { type: 'TAKE_CUP', timestampMs: 8_000 },
      { type: 'SELECT_TEA', timestampMs: 8_200, tea: 'black' },
      { type: 'SELECT_SWEETNESS', timestampMs: 8_400, sweetness: 'full' },
      { type: 'SELECT_ICE', timestampMs: 8_600, ice: 'regular' },
      { type: 'TOGGLE_PEARL', timestampMs: 8_800, pearl: true },
      { type: 'FINISH_DRINK', timestampMs: 9_000 },
      { type: 'DELIVER_ORDER', timestampMs: 9_500, orderId: 'order_1' },
      { type: 'ADVANCE_TIME', timestampMs: 45_000 },
      { type: 'ADVANCE_TIME', timestampMs: 90_000 },
      { type: 'SETTLE_ROUND', timestampMs: 121_000 },
    ];

    const initialA = createInitialGameState({ initialSeed: 20261023 });
    const initialB = createInitialGameState({ initialSeed: 20261023 });

    const resultA = runGameEvents(initialA, events);
    const resultB = runGameEvents(initialB, events);

    expect(resultA).toEqual(resultB);
    expect(JSON.stringify(resultA)).toBe(JSON.stringify(resultB));
  });

  it('DELIVER_ORDER 會先推進時間並執行排程自動生單（如開局後直接於第 7 秒交付首單，第 6 秒應生成的自動訂單必定出現）', () => {
    const initial = createInitialGameState({ initialSeed: 20261023 });
    const started = applyGameEvent(initial, {
      type: 'START_ROUND',
      timestampMs: 0,
      seed: 20261023,
    });

    expect(started.activeOrders).toHaveLength(1);
    const firstOrder = started.activeOrders[0]!;
    expect(firstOrder.id).toBe('order_1');
    expect(started.nextSpawnAtMs).toBe(6_000);

    // 不呼叫 ADVANCE_TIME，直接在第 7 秒（7_000 ms）交付首單
    const afterDirectDeliver = runGameEvents(started, [
      { type: 'TAKE_CUP', timestampMs: 1_000 },
      { type: 'SELECT_TEA', timestampMs: 2_000, tea: firstOrder.recipe.tea },
      {
        type: 'SELECT_SWEETNESS',
        timestampMs: 3_000,
        sweetness: firstOrder.recipe.sweetness,
      },
      { type: 'SELECT_ICE', timestampMs: 4_000, ice: firstOrder.recipe.ice },
      {
        type: 'TOGGLE_PEARL',
        timestampMs: 5_000,
        pearl: firstOrder.recipe.pearl,
      },
      { type: 'FINISH_DRINK', timestampMs: 5_500 },
      { type: 'DELIVER_ORDER', timestampMs: 7_000, orderId: firstOrder.id },
    ]);

    expect(afterDirectDeliver.servedCount).toBe(1);
    // 第 6 秒（6_000 ms）排程的 order_2 應已自動生成並留在 activeOrders 中
    expect(afterDirectDeliver.activeOrders).toHaveLength(1);
    expect(afterDirectDeliver.activeOrders[0]?.id).toBe('order_2');
    expect(afterDirectDeliver.activeOrders[0]?.createdAtMs).toBe(6_000);
    expect(afterDirectDeliver.nextSpawnAtMs).toBe(12_000);

    // 與先呼叫 ADVANCE_TIME(7_000) 再 DELIVER_ORDER(7_000) 的生單結果完全一致
    const afterAdvanceThenDeliver = runGameEvents(started, [
      { type: 'TAKE_CUP', timestampMs: 1_000 },
      { type: 'SELECT_TEA', timestampMs: 2_000, tea: firstOrder.recipe.tea },
      {
        type: 'SELECT_SWEETNESS',
        timestampMs: 3_000,
        sweetness: firstOrder.recipe.sweetness,
      },
      { type: 'SELECT_ICE', timestampMs: 4_000, ice: firstOrder.recipe.ice },
      {
        type: 'TOGGLE_PEARL',
        timestampMs: 5_000,
        pearl: firstOrder.recipe.pearl,
      },
      { type: 'FINISH_DRINK', timestampMs: 5_500 },
      { type: 'ADVANCE_TIME', timestampMs: 7_000 },
      { type: 'DELIVER_ORDER', timestampMs: 7_000, orderId: firstOrder.id },
    ]);

    expect(afterDirectDeliver).toEqual(afterAdvanceThenDeliver);
  });

  it('保留其他攤位的設定擴充點（雞排、臭豆腐、蚵仔煎與最終關）且滿足介面契約', () => {
    expect(BUBBLE_TEA_STALL.id).toBe('bubble_tea');
    expect(getPlayableStalls().map((s) => s.id)).toEqual(['bubble_tea']);

    const upcomingIds = getUpcomingStalls().map((s) => s.id);
    expect(upcomingIds).toEqual([
      'fried_chicken',
      'stinky_tofu',
      'oyster_omelet',
      'night_market_finale',
    ]);

    for (const stallId of Object.keys(STALL_DEFINITIONS) as Array<
      keyof typeof STALL_DEFINITIONS
    >) {
      const def = getStallDefinition(stallId);
      expect(def.roundDurationMs).toBe(120_000);
      expect(def.maxActiveOrders).toBe(3);
      expect(def.steps.length).toBeGreaterThan(0);
      expect(def.isRecipeEqual(def.defaultRecipe, def.defaultRecipe)).toBe(true);
      expect(def.describeRecipe(def.defaultRecipe).length).toBeGreaterThan(0);
    }

    expect(
      describeBubbleTeaRecipe({
        tea: 'green',
        sweetness: 'half',
        ice: 'none',
        pearl: true,
      }),
    ).toEqual(['綠茶', '半糖', '去冰', '加珍珠']);
  });

  it('桌面與手機直式版面配置及 LocalStorage 最佳紀錄與音效開關保存', () => {
    const desktop = computeResponsiveLayout(1280, 720);
    expect(desktop.orientation).toBe('landscape');
    expect(desktop.logicalWidth).toBe(DESKTOP_LOGICAL_WIDTH);
    expect(desktop.logicalHeight).toBe(DESKTOP_LOGICAL_HEIGHT);
    expect(desktop.minTouchTargetCssPx).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_CSS_PX);

    const mobile = computeResponsiveLayout(390, 844);
    expect(mobile.orientation).toBe('portrait');
    expect(mobile.minTouchTargetCssPx).toBeGreaterThanOrEqual(48);
    expect(mobile.ordersRegion.y).toBeLessThan(mobile.customersRegion.y);
    expect(mobile.customersRegion.y).toBeLessThan(mobile.workbenchRegion.y);

    const storage = new MemoryStorage();
    expect(loadAudioEnabled(storage)).toBe(true);
    saveAudioEnabled(false, storage);
    expect(loadAudioEnabled(storage)).toBe(false);

    const initialBest = loadBestRecord(storage);
    expect(initialBest.maxCoins).toBe(0);

    const updatedBest = saveSettlementToBestRecord(
      {
        stallId: 'bubble_tea',
        startedAtMs: 0,
        endedAtMs: 120_000,
        durationMs: 120_000,
        totalCoins: 280,
        servedCount: 6,
        failedCount: 0,
        expiredCount: 0,
        wrongDeliveryCount: 0,
        maxStreak: 6,
        stars: 3,
        title: '夜市珍奶傳奇',
      },
      storage,
    );
    expect(updatedBest.maxCoins).toBe(280);
    expect(updatedBest.maxStars).toBe(3);
    expect(loadBestRecord(storage).maxStreak).toBe(6);
  });
});

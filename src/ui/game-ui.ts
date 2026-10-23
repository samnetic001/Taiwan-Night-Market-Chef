import type { AssetId, AssetRegistry } from '../assets/index.ts';
import type { BestScoreRecord, GameEvent, GameState } from '../core/index.ts';
import { describeBubbleTeaRecipe, formatIceLabel, formatSweetnessLabel, formatTeaLabel, isWorkbenchIngredientsSelected } from '../core/stalls.ts';
import '../styles/game.css';

export interface GameUiOptions {
  readonly host: HTMLElement;
  readonly assets: AssetRegistry;
  readonly onEvent: (event: GameEvent) => void;
  readonly onAudioChange?: (enabled: boolean) => void;
  readonly audioEnabled?: boolean;
  readonly bestRecord?: BestScoreRecord;
}

export interface GameUi {
  render(state: GameState): void;
  setAudioEnabled(enabled: boolean): void;
  destroy(): void;
}

type UntimedGameEvent = GameEvent extends infer E
  ? E extends { readonly timestampMs: number } ? Omit<E, 'timestampMs'> : never
  : never;

const html = (value: unknown): string => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

function image(assets: AssetRegistry, id: AssetId, className = ''): string {
  const entry = assets.get(id);
  return `<img class="${className}" src="${html(entry.path)}" width="${entry.width}" height="${entry.height}" alt="" draggable="false">`;
}

/** Keep live controls in place while the timer and order progress update. */
function reconcile(parent: Node, next: Node): void {
  const oldChildren = Array.from(parent.childNodes);
  const newChildren = Array.from(next.childNodes);
  for (let index = 0; index < newChildren.length; index += 1) {
    const wanted = newChildren[index];
    const existing = oldChildren[index];
    if (!existing) {
      parent.appendChild(wanted.cloneNode(true));
      continue;
    }
    const sameElement = existing instanceof Element && wanted instanceof Element &&
      existing.tagName === wanted.tagName &&
      existing.getAttribute('data-order-id') === wanted.getAttribute('data-order-id');
    if (existing.nodeType !== wanted.nodeType ||
      (existing instanceof Element && !sameElement)) {
      parent.replaceChild(wanted.cloneNode(true), existing);
      continue;
    }
    if (existing instanceof Text && wanted instanceof Text) {
      if (existing.data !== wanted.data) existing.data = wanted.data;
    } else if (sameElement) {
      const oldElement = existing as Element;
      const newElement = wanted as Element;
      for (const attribute of Array.from(oldElement.attributes)) {
        // showModal() owns this state; a timer tick must not close the dialog.
        if (oldElement instanceof HTMLDialogElement && attribute.name === 'open') continue;
        if (!newElement.hasAttribute(attribute.name)) oldElement.removeAttribute(attribute.name);
      }
      for (const attribute of Array.from(newElement.attributes)) {
        if (oldElement.getAttribute(attribute.name) !== attribute.value) {
          oldElement.setAttribute(attribute.name, attribute.value);
        }
      }
      reconcile(oldElement, newElement);
    }
  }
  for (let index = newChildren.length; index < oldChildren.length; index += 1) {
    parent.removeChild(oldChildren[index]);
  }
}

const seconds = (milliseconds: number): string => `${Math.max(0, Math.ceil(milliseconds / 1000))} 秒`;

/** DOM layer that a Phaser scene can mount above its canvas and update after each core event. */
export function mountGameUi(options: GameUiOptions): GameUi {
  const { host, assets, onEvent } = options;
  let audioEnabled = options.audioEnabled ?? true;
  let currentState: GameState | null = null;
  host.classList.add('nm-game-host');
  const root = document.createElement('div');
  const nextView = document.createElement('div');
  root.className = 'nm-ui';
  root.style.setProperty('--nm-night-market', `url("${assets.url('night_market')}")`);
  root.style.setProperty('--nm-button-art', `url("${assets.url('ui_button')}")`);
  host.append(root);

  const emit = (event: UntimedGameEvent): void => {
    onEvent({ ...event, timestampMs: Date.now() } as GameEvent);
  };

  const onClick = (pointer: MouseEvent): void => {
    const button = (pointer.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'audio') {
      audioEnabled = !audioEnabled;
      options.onAudioChange?.(audioEnabled);
      if (currentState) render(currentState);
      return;
    }
    if (action === 'instructions') {
      root.querySelector<HTMLDialogElement>('.nm-instructions')?.showModal();
      return;
    }
    if (action === 'close-instructions') {
      root.querySelector<HTMLDialogElement>('.nm-instructions')?.close();
      return;
    }
    if (action === 'start') return emit({ type: 'START_ROUND' });
    if (action === 'restart') return emit({ type: 'RESTART_ROUND' });
    if (currentState?.status !== 'playing') return;
    if (action === 'cup') return emit({ type: 'TAKE_CUP' });
    if (action === 'tea' && (button.dataset.value === 'black' || button.dataset.value === 'green')) {
      return emit({ type: 'SELECT_TEA', tea: button.dataset.value });
    }
    if (action === 'sweetness' && (button.dataset.value === 'full' || button.dataset.value === 'half' || button.dataset.value === 'none')) {
      return emit({ type: 'SELECT_SWEETNESS', sweetness: button.dataset.value });
    }
    if (action === 'ice' && (button.dataset.value === 'regular' || button.dataset.value === 'less' || button.dataset.value === 'none')) {
      return emit({ type: 'SELECT_ICE', ice: button.dataset.value });
    }
    if (action === 'pearl') return emit({ type: 'TOGGLE_PEARL' });
    if (action === 'finish') return emit({ type: 'FINISH_DRINK' });
    if (action === 'reset') return emit({ type: 'RESET_WORKBENCH' });
    if (action === 'deliver' && button.dataset.orderId) {
      return emit({ type: 'DELIVER_ORDER', orderId: button.dataset.orderId });
    }
  };
  root.addEventListener('click', onClick);

  function render(state: GameState): void {
    currentState = state;
    const isIdle = state.status === 'idle';
    const isSettled = state.status === 'settled';
    const workbench = state.workbench;
    const latest = state.lastEvaluation;
    const feedback = latest?.reason === 'served' ? `出杯成功！獲得 ${latest.coinsDelta} 金幣` :
      latest?.reason === 'wrong_recipe' ? '配方不符，請仔細核對訂單' :
      latest?.reason === 'expired_before_delivery' ? '客人已等太久，訂單逾時' :
      latest?.reason === 'workbench_incomplete' ? '請先完成飲料再交付' : '';
    const orders = [...state.activeOrders].sort((a, b) => a.slotIndex - b.slotIndex);
    const orderCards = [0, 1, 2].map((slot) => {
      const order = orders.find((item) => item.slotIndex === slot);
      if (!order) return `<div class="nm-order nm-order-empty"><span>等待下一位客人</span></div>`;
      const remaining = Math.max(0, order.deadlineMs - state.currentTimeMs);
      const progress = Math.max(0, Math.min(100, remaining / order.durationMs * 100));
      return `<article class="nm-order ${progress < 30 ? 'nm-order-urgent' : ''}" data-order-id="${html(order.id)}">
        <div class="nm-order-top"><strong>第 ${slot + 1} 位客人</strong><span>${seconds(remaining)}</span></div>
        <div class="nm-order-title">${html(order.recipe.pearl ? '珍珠' : '')}${order.recipe.tea === 'black' ? '奶茶' : '奶綠'}</div>
        <div class="nm-order-tags">${describeBubbleTeaRecipe(order.recipe).map((part) => `<span>${html(part)}</span>`).join('')}</div>
        <div class="nm-wait-track"><span style="width:${progress}%"></span></div>
        <button class="nm-action nm-deliver" data-action="deliver" data-order-id="${html(order.id)}" ${workbench.isFinished ? '' : 'disabled'}>交付這位客人</button>
      </article>`;
    }).join('');
    const customers = orders.map((order) => {
      const id = `${order.customer}_${order.mood}` as AssetId;
      return `<div class="nm-customer" aria-label="第 ${order.slotIndex + 1} 位客人，${order.mood === 'angry' ? '不滿' : order.mood === 'waiting' ? '等待中' : '心情愉快'}">
        ${image(assets, id)}<span>客人 ${order.slotIndex + 1}</span>
      </div>`;
    }).join('');
    const option = (action: string, value: string, label: string, selected: boolean, assetId?: AssetId) =>
      `<button class="nm-choice ${selected ? 'is-selected' : ''}" data-action="${action}" data-value="${value}" aria-pressed="${selected}">${assetId ? image(assets, assetId) : ''}<span>${label}</span></button>`;

    nextView.innerHTML = `<div class="nm-shell">
      <header class="nm-header">
        <div class="nm-brand"><span class="nm-brand-kicker">SAMNETIC STUDIO</span><strong>台灣夜市料理王</strong><small>第一關・阿強手搖珍奶攤</small></div>
        <div class="nm-stats" aria-live="polite">
          <span class="nm-stat"><b>剩餘</b><strong>${seconds(state.remainingRoundMs)}</strong></span>
          <span class="nm-stat">${image(assets, 'coin')}<strong>${state.coins}</strong></span>
          <span class="nm-stat"><b>連擊</b><strong>${state.streak}</strong></span>
        </div>
        <button class="nm-quiet" data-action="audio" aria-label="${audioEnabled ? '關閉音效' : '開啟音效'}">音效${audioEnabled ? '開' : '關'}</button>
      </header>
      <main class="nm-play">
        <section class="nm-orders" aria-label="客人訂單"><h2>客人訂單 <span>${orders.length}/3</span></h2><div class="nm-order-list">${orderCards}</div></section>
        <section class="nm-scene" aria-label="夜市攤位與客人"><div class="nm-scene-art">${image(assets, 'stall', 'nm-stall')}${image(assets, 'boss', 'nm-boss')}</div><div class="nm-customer-list">${customers || '<span class="nm-awaiting">準備迎接客人！</span>'}</div></section>
        <section class="nm-workbench" aria-label="珍珠奶茶工作台">
          <div class="nm-workbench-head"><h2>調飲工作台</h2><span>${workbench.isFinished ? '飲料完成・選擇客人交付' : '依訂單選材、封膜出杯'}</span></div>
          <div class="nm-controls">
            <div class="nm-control-group"><h3>① 杯子與茶底</h3><div class="nm-choice-row">${option('cup', 'cup', '拿杯子', workbench.hasCup, 'cup')}${option('tea', 'black', '紅茶', workbench.tea === 'black', 'tea_black')}${option('tea', 'green', '綠茶', workbench.tea === 'green', 'tea_green')}</div></div>
            <div class="nm-control-group"><h3>② 甜度</h3><div class="nm-choice-row">${(['full', 'half', 'none'] as const).map((v) => option('sweetness', v, formatSweetnessLabel(v), workbench.sweetness === v)).join('')}</div></div>
            <div class="nm-control-group"><h3>③ 冰量</h3><div class="nm-choice-row">${(['regular', 'less', 'none'] as const).map((v) => option('ice', v, formatIceLabel(v), workbench.ice === v, v === 'none' ? undefined : 'ice')).join('')}</div></div>
            <div class="nm-control-group"><h3>④ 配料</h3><div class="nm-choice-row">${option('pearl', 'pearl', '加珍珠', workbench.pearl, 'pearl')}</div></div>
          </div>
          <div class="nm-assembly">${image(assets, workbench.isFinished ? 'finished_drink' : 'cup', 'nm-preview')}<div><strong>${workbench.isFinished ? '飲料已完成' : '正在調製'}</strong><span>${workbench.tea ? formatTeaLabel(workbench.tea) : '未選茶底'}・${workbench.sweetness ? formatSweetnessLabel(workbench.sweetness) : '未選甜度'}・${workbench.ice ? formatIceLabel(workbench.ice) : '未選冰量'}${workbench.pearl ? '・珍珠' : ''}</span></div><button class="nm-action nm-finish" data-action="finish" ${isWorkbenchIngredientsSelected(workbench) && !workbench.isFinished ? '' : 'disabled'}>封膜出杯</button><button class="nm-quiet" data-action="reset">清空</button></div>
          <p class="nm-feedback" role="status">${feedback}</p>
        </section>
      </main>
      <dialog class="nm-instructions"><h2>操作說明</h2><p>120 秒內依照訂單拿杯、選茶底、甜度、冰量及珍珠。封膜完成後，點選對應訂單交付。越快又越準，獎勵越多！</p><button class="nm-action" data-action="close-instructions">我知道了</button></dialog>
      ${isIdle ? `<div class="nm-overlay"><div class="nm-overlay-card">${image(assets, 'finished_drink', 'nm-hero-drink')}<span class="nm-brand-kicker">SAMNETIC STUDIO 呈獻</span><h1>台灣夜市料理王</h1><p>從一杯香濃的珍珠奶茶開始，招呼夜市裡的每一位客人！</p><div class="nm-overlay-actions"><button class="nm-action nm-primary" data-action="start">開始營業</button><button class="nm-action" data-action="instructions">操作說明</button><button class="nm-action" data-action="audio" aria-label="${audioEnabled ? '關閉音效' : '開啟音效'}">音效${audioEnabled ? '開' : '關'}</button></div>${options.bestRecord ? `<small>最佳營業額：${options.bestRecord.maxCoins} 金幣</small>` : ''}</div></div>` : ''}
      ${isSettled && state.settlement ? `<div class="nm-overlay"><div class="nm-overlay-card nm-results"><span class="nm-brand-kicker">SAMNETIC STUDIO・今日結算</span><h1>${html(state.settlement.title)}</h1><div class="nm-stars">${Array.from({ length: state.settlement.stars }, () => image(assets, 'star')).join('')}</div><dl><div><dt>營業額</dt><dd>${state.settlement.totalCoins} 金幣</dd></div><div><dt>成功</dt><dd>${state.settlement.servedCount} 杯</dd></div><div><dt>失敗</dt><dd>${state.settlement.failedCount} 杯</dd></div><div><dt>最高連擊</dt><dd>${state.settlement.maxStreak}</dd></div></dl><button class="nm-action nm-primary" data-action="restart">再玩一次</button></div></div>` : ''}
    </div>`;
    reconcile(root, nextView);
  }

  return {
    render,
    setAudioEnabled(enabled) { audioEnabled = enabled; if (currentState) render(currentState); },
    destroy() { root.removeEventListener('click', onClick); root.remove(); host.classList.remove('nm-game-host'); },
  };
}

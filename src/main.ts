import './styles/game.css';
import { launchNightMarketGame, type RunningNightMarketGame } from './scenes/index.ts';

declare global {
  interface Window {
    __NIGHT_MARKET_GAME__?: RunningNightMarketGame;
  }
}

export async function bootApplication(
  hostElement: HTMLElement | null = typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('#app')
    : null,
): Promise<RunningNightMarketGame | null> {
  if (!hostElement) {
    return null;
  }
  try {
    const running = await launchNightMarketGame({
      host: hostElement,
    });
    if (typeof window !== 'undefined') {
      window.__NIGHT_MARKET_GAME__ = running;
    }
    return running;
  } catch (error) {
    const message = error instanceof Error ? error.message : '遊戲啟動失敗';
    hostElement.innerHTML = `<div class="nm-shell" role="alert"><h1>台灣夜市料理王</h1><p>${message}</p></div>`;
    return null;
  }
}

if (typeof document !== 'undefined') {
  const appEl = document.querySelector<HTMLElement>('#app');
  if (appEl && !appEl.hasAttribute('data-manual-boot')) {
    void bootApplication(appEl);
  }
}

export interface GameDomRefs {
  gameFileInput: HTMLInputElement;
  fitButton: HTMLButtonElement;
  gameInfoLabel: HTMLElement;
  mapInfoLabel: HTMLElement;
  playerPositionLabel: HTMLElement;
  storeList: HTMLElement;
  statusLine: HTMLElement;
}

export interface GameDomHandlers {
  onLoadGame: () => void;
  onFitView: () => void;
}

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element #${id}`);
  }
  return el as T;
}

export function getGameDomRefs(): GameDomRefs {
  return {
    gameFileInput: must<HTMLInputElement>('game-scenario-json-file'),
    fitButton: must<HTMLButtonElement>('game-fit-view'),
    gameInfoLabel: must<HTMLElement>('game-scenario-info'),
    mapInfoLabel: must<HTMLElement>('game-map-info'),
    playerPositionLabel: must<HTMLElement>('game-player-position'),
    storeList: must<HTMLElement>('game-store-list'),
    statusLine: must<HTMLElement>('game-status-line')
  };
}

export function bindGameDomEvents(dom: GameDomRefs, handlers: GameDomHandlers): void {
  dom.gameFileInput.addEventListener('change', handlers.onLoadGame);
  dom.fitButton.addEventListener('click', handlers.onFitView);
}

export function refreshGameMetadataUI(dom: GameDomRefs, gameName: string, mapId: string): void {
  dom.gameInfoLabel.textContent = gameName ? `Game: ${gameName}` : 'No game loaded.';
  dom.mapInfoLabel.textContent = mapId ? `Map: ${mapId}` : 'No map loaded.';
}

export function refreshPlayerPositionUI(dom: GameDomRefs, x: number, y: number): void {
  dom.playerPositionLabel.textContent = `Player position: ${Math.round(x)}, ${Math.round(y)}`;
}

export function refreshStoreUI(dom: GameDomRefs, store: Record<string, number>): void {
  const entries = Object.entries(store).sort(([a], [b]) => a.localeCompare(b));
  dom.storeList.innerHTML = entries.length
    ? entries
        .map(
          ([key, value]) =>
            `<div class="store-row"><span>${escapeHtml(key)}</span><strong>${formatNumber(value)}</strong></div>`
        )
        .join('')
    : '<div class="small-note">Store is empty.</div>';
}

export function setGameStatus(dom: GameDomRefs, text: string): void {
  dom.statusLine.textContent = text;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

import type { MapArea } from '../types';
import type { AreaGameScenario } from './types';
import type { ScenarioActionOperation } from '../scenario/types';

export interface GameEditorDomRefs {
  modeButtons: {
    map: HTMLButtonElement;
    editor: HTMLButtonElement;
    game: HTMLButtonElement;
  };
  gameIdInput: HTMLInputElement;
  gameNameInput: HTMLInputElement;
  mapJsonPathInput: HTMLInputElement;
  mapJsonFileInput: HTMLInputElement;
  gameJsonFileInput: HTMLInputElement;
  newGameButton: HTMLButtonElement;
  saveFilenameInput: HTMLInputElement;
  saveGameButton: HTMLButtonElement;
  fitButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  followTransitionButton: HTMLButtonElement;
  currentMapLabel: HTMLElement;
  currentPathLabel: HTMLElement;
  configuredAreasLabel: HTMLElement;
  selectedAreaLabel: HTMLElement;
  selectedAreaMeta: HTMLElement;
  showLabelCheckbox: HTMLInputElement;
  showIconCheckbox: HTMLInputElement;
  showBackgroundCheckbox: HTMLInputElement;
  transitionMapFileInput: HTMLInputElement;
  transitionMapFileButton: HTMLButtonElement;
  transitionMapFileStatus: HTMLElement;
  transitionTargetMapIdInput: HTMLInputElement;
  transitionTargetMapJsonPathInput: HTMLInputElement;
  transitionReturnMapLabel: HTMLElement;
  enterActionsList: HTMLElement;
  addEnterActionButton: HTMLButtonElement;
  enterMessageText: HTMLTextAreaElement;
  enterMessageSeconds: HTMLInputElement;
  exitActionsList: HTMLElement;
  addExitActionButton: HTMLButtonElement;
  exitMessageText: HTMLTextAreaElement;
  exitMessageSeconds: HTMLInputElement;
  permissionsList: HTMLElement;
  addPermissionButton: HTMLButtonElement;
  qaList: HTMLElement;
  addQaButton: HTMLButtonElement;
  statusLine: HTMLElement;
}

export interface GameEditorDomHandlers {
  onGameMetaInput: () => void;
  onMapJsonPathInput: () => void;
  onLoadMapJson: () => void;
  onLoadGameJson: () => void;
  onNewGame: () => void;
  onSaveGame: () => void;
  onFitView: () => void;
  onGoBack: () => void;
  onFollowTransition: () => void;
  onLoadTransitionMapJson: () => void;
  onDisplayToggle: (field: 'showLabel' | 'showIcon' | 'showBackground', checked: boolean) => void;
  onTransitionInput: (field: 'targetMapId' | 'targetMapJsonPath', value: string) => void;
  onAddAction: (kind: 'enter' | 'exit') => void;
  onUpdateAction: (kind: 'enter' | 'exit', index: number, field: 'operation' | 'what' | 'qty', value: string) => void;
  onDeleteAction: (kind: 'enter' | 'exit', index: number) => void;
  onMessageChange: (kind: 'enter' | 'exit', field: 'text' | 'seconds', value: string) => void;
  onAddPermission: () => void;
  onUpdatePermission: (index: number, field: 'key' | 'value', value: string) => void;
  onDeletePermission: (index: number) => void;
  onAddQa: () => void;
  onUpdateQa: (index: number, field: 'question' | 'answer', value: string) => void;
  onDeleteQa: (index: number) => void;
}

interface MetadataView {
  gameName: string;
  currentMapId: string;
  currentMapPath: string;
  configuredAreas: number;
  totalAreas: number;
  canGoBack: boolean;
  canFollowTransition: boolean;
}

const ACTION_OPTIONS: ScenarioActionOperation[] = ['assign', 'give', 'take', 'display', 'transition'];

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element #${id}`);
  }
  return el as T;
}

export function getGameEditorDomRefs(): GameEditorDomRefs {
  return {
    modeButtons: {
      map: must<HTMLButtonElement>('mode-map'),
      editor: must<HTMLButtonElement>('mode-scenario'),
      game: must<HTMLButtonElement>('mode-game')
    },
    gameIdInput: must<HTMLInputElement>('game-editor-id'),
    gameNameInput: must<HTMLInputElement>('game-editor-name'),
    mapJsonPathInput: must<HTMLInputElement>('game-editor-map-json-path'),
    mapJsonFileInput: must<HTMLInputElement>('game-editor-map-json-file'),
    gameJsonFileInput: must<HTMLInputElement>('game-editor-json-file'),
    newGameButton: must<HTMLButtonElement>('new-game-editor-btn'),
    saveFilenameInput: must<HTMLInputElement>('game-editor-save-filename'),
    saveGameButton: must<HTMLButtonElement>('save-game-editor-btn'),
    fitButton: must<HTMLButtonElement>('game-editor-fit-view'),
    backButton: must<HTMLButtonElement>('game-editor-back-btn'),
    followTransitionButton: must<HTMLButtonElement>('game-editor-follow-transition-btn'),
    currentMapLabel: must<HTMLElement>('game-editor-current-map'),
    currentPathLabel: must<HTMLElement>('game-editor-current-path'),
    configuredAreasLabel: must<HTMLElement>('game-editor-configured-areas'),
    selectedAreaLabel: must<HTMLElement>('game-editor-selected-area'),
    selectedAreaMeta: must<HTMLElement>('game-editor-selected-area-meta'),
    showLabelCheckbox: must<HTMLInputElement>('game-editor-display-label'),
    showIconCheckbox: must<HTMLInputElement>('game-editor-display-icon'),
    showBackgroundCheckbox: must<HTMLInputElement>('game-editor-display-background'),
    transitionMapFileInput: must<HTMLInputElement>('game-editor-transition-map-file'),
    transitionMapFileButton: must<HTMLButtonElement>('game-editor-transition-map-file-btn'),
    transitionMapFileStatus: must<HTMLElement>('game-editor-transition-map-file-status'),
    transitionTargetMapIdInput: must<HTMLInputElement>('game-editor-transition-map-id'),
    transitionTargetMapJsonPathInput: must<HTMLInputElement>('game-editor-transition-map-path'),
    transitionReturnMapLabel: must<HTMLElement>('game-editor-transition-return'),
    enterActionsList: must<HTMLElement>('game-editor-enter-actions-list'),
    addEnterActionButton: must<HTMLButtonElement>('game-editor-add-enter-action'),
    enterMessageText: must<HTMLTextAreaElement>('game-editor-enter-message'),
    enterMessageSeconds: must<HTMLInputElement>('game-editor-enter-message-seconds'),
    exitActionsList: must<HTMLElement>('game-editor-exit-actions-list'),
    addExitActionButton: must<HTMLButtonElement>('game-editor-add-exit-action'),
    exitMessageText: must<HTMLTextAreaElement>('game-editor-exit-message'),
    exitMessageSeconds: must<HTMLInputElement>('game-editor-exit-message-seconds'),
    permissionsList: must<HTMLElement>('game-editor-permissions-list'),
    addPermissionButton: must<HTMLButtonElement>('game-editor-add-permission'),
    qaList: must<HTMLElement>('game-editor-qa-list'),
    addQaButton: must<HTMLButtonElement>('game-editor-add-qa'),
    statusLine: must<HTMLElement>('game-editor-status-line')
  };
}

let activeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

export function bindGameEditorDomEvents(dom: GameEditorDomRefs, handlers: GameEditorDomHandlers): void {
  dom.gameIdInput.addEventListener('input', handlers.onGameMetaInput);
  dom.gameNameInput.addEventListener('input', handlers.onGameMetaInput);
  dom.mapJsonPathInput.addEventListener('input', handlers.onMapJsonPathInput);
  dom.mapJsonFileInput.addEventListener('change', handlers.onLoadMapJson);
  dom.gameJsonFileInput.addEventListener('change', handlers.onLoadGameJson);
  dom.newGameButton.addEventListener('click', handlers.onNewGame);
  dom.saveGameButton.addEventListener('click', handlers.onSaveGame);
  dom.fitButton.addEventListener('click', handlers.onFitView);
  dom.backButton.addEventListener('click', handlers.onGoBack);
  dom.followTransitionButton.addEventListener('click', handlers.onFollowTransition);
  dom.transitionMapFileButton.addEventListener('click', () => dom.transitionMapFileInput.click());
  dom.transitionMapFileInput.addEventListener('change', handlers.onLoadTransitionMapJson);
  dom.showLabelCheckbox.addEventListener('change', () => handlers.onDisplayToggle('showLabel', dom.showLabelCheckbox.checked));
  dom.showIconCheckbox.addEventListener('change', () => handlers.onDisplayToggle('showIcon', dom.showIconCheckbox.checked));
  dom.showBackgroundCheckbox.addEventListener('change', () =>
    handlers.onDisplayToggle('showBackground', dom.showBackgroundCheckbox.checked)
  );
  dom.transitionTargetMapIdInput.addEventListener('input', () =>
    handlers.onTransitionInput('targetMapId', dom.transitionTargetMapIdInput.value)
  );
  dom.transitionTargetMapJsonPathInput.addEventListener('input', () =>
    handlers.onTransitionInput('targetMapJsonPath', dom.transitionTargetMapJsonPathInput.value)
  );
  dom.addEnterActionButton.addEventListener('click', () => handlers.onAddAction('enter'));
  dom.addExitActionButton.addEventListener('click', () => handlers.onAddAction('exit'));
  dom.enterMessageText.addEventListener('input', () => handlers.onMessageChange('enter', 'text', dom.enterMessageText.value));
  dom.enterMessageSeconds.addEventListener('input', () =>
    handlers.onMessageChange('enter', 'seconds', dom.enterMessageSeconds.value)
  );
  dom.exitMessageText.addEventListener('input', () => handlers.onMessageChange('exit', 'text', dom.exitMessageText.value));
  dom.exitMessageSeconds.addEventListener('input', () =>
    handlers.onMessageChange('exit', 'seconds', dom.exitMessageSeconds.value)
  );
  dom.addPermissionButton.addEventListener('click', handlers.onAddPermission);
  dom.addQaButton.addEventListener('click', handlers.onAddQa);

  bindActionList(dom.enterActionsList, 'enter', handlers);
  bindActionList(dom.exitActionsList, 'exit', handlers);
  bindKeyValueList(dom.permissionsList, 'permission', handlers);
  bindKeyValueList(dom.qaList, 'qa', handlers);

  if (activeKeydownHandler) {
    window.removeEventListener('keydown', activeKeydownHandler);
  }
  activeKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        active.blur();
      }
    }
  };
  window.addEventListener('keydown', activeKeydownHandler);
}

export function refreshGameEditorMetadataUI(dom: GameEditorDomRefs, view: MetadataView, gameId: string): void {
  dom.gameIdInput.value = gameId;
  dom.gameNameInput.value = view.gameName;
  dom.currentMapLabel.textContent = view.currentMapId ? `Map: ${view.currentMapId}` : 'No map loaded.';
  dom.currentPathLabel.textContent = view.currentMapPath ? `JSON path: ${view.currentMapPath}` : 'No map JSON path set.';
  dom.configuredAreasLabel.textContent = `Configured areas: ${view.configuredAreas} / ${view.totalAreas}`;
  dom.backButton.disabled = !view.canGoBack;
  dom.followTransitionButton.disabled = !view.canFollowTransition;
}

export function refreshGameEditorSelectionUI(
  dom: GameEditorDomRefs,
  area: MapArea | null,
  areaScenario: AreaGameScenario | undefined
): void {
  const disabled = !area;
  dom.addEnterActionButton.disabled = disabled;
  dom.enterMessageText.disabled = disabled;
  dom.enterMessageSeconds.disabled = disabled;
  dom.addExitActionButton.disabled = disabled;
  dom.exitMessageText.disabled = disabled;
  dom.exitMessageSeconds.disabled = disabled;
  dom.addPermissionButton.disabled = disabled;
  dom.addQaButton.disabled = disabled;
  dom.showLabelCheckbox.disabled = disabled;
  dom.showIconCheckbox.disabled = disabled;
  dom.showBackgroundCheckbox.disabled = disabled;
  dom.transitionMapFileButton.disabled = disabled;
  dom.transitionTargetMapIdInput.disabled = disabled;
  dom.transitionTargetMapJsonPathInput.disabled = disabled;

  if (!area) {
    dom.selectedAreaLabel.textContent = 'No area selected.';
    dom.selectedAreaMeta.textContent = '';
    dom.showLabelCheckbox.checked = true;
    dom.showIconCheckbox.checked = true;
    dom.showBackgroundCheckbox.checked = true;
    dom.transitionMapFileStatus.textContent = 'No file chosen.';
    dom.transitionTargetMapIdInput.value = '';
    dom.transitionTargetMapJsonPathInput.value = '';
    dom.transitionReturnMapLabel.textContent = '';
    renderActionRows(dom.enterActionsList, []);
    renderActionRows(dom.exitActionsList, []);
    renderKeyValueRows(dom.permissionsList, [], 'key', 'value');
    renderKeyValueRows(dom.qaList, [], 'question', 'answer');
    dom.enterMessageText.value = '';
    dom.enterMessageSeconds.value = '';
    dom.exitMessageText.value = '';
    dom.exitMessageSeconds.value = '';
    return;
  }

  dom.selectedAreaLabel.textContent = `Selected: ${area.id}`;
  dom.selectedAreaMeta.textContent = [area.label && `Label: ${area.label}`, `Shape: ${area.shape.type}`].filter(Boolean).join(' | ');
  dom.showLabelCheckbox.checked = areaScenario?.display?.showLabel ?? true;
  dom.showIconCheckbox.checked = areaScenario?.display?.showIcon ?? true;
  dom.showBackgroundCheckbox.checked = areaScenario?.display?.showBackground ?? true;
  dom.transitionMapFileStatus.textContent = areaScenario?.transition?.targetMapJsonPath
    ? `Chosen file: ${getFileName(areaScenario.transition.targetMapJsonPath)}`
    : 'No file chosen.';
  dom.transitionTargetMapIdInput.value = areaScenario?.transition?.targetMapId ?? '';
  dom.transitionTargetMapJsonPathInput.value = areaScenario?.transition?.targetMapJsonPath ?? '';
  dom.transitionReturnMapLabel.textContent = areaScenario?.transition?.returnToMapId
    ? `Returns to ${areaScenario.transition.returnToMapId}${areaScenario.transition.returnToAreaId ? ` via ${areaScenario.transition.returnToAreaId}` : ''}`
    : '';
  renderActionRows(dom.enterActionsList, areaScenario?.onEnterActions ?? []);
  renderActionRows(dom.exitActionsList, areaScenario?.onExitActions ?? []);
  renderKeyValueRows(dom.permissionsList, Object.entries(areaScenario?.permissions ?? {}), 'key', 'value');
  renderKeyValueRows(dom.qaList, Object.entries(areaScenario?.qa ?? {}), 'question', 'answer');
  dom.enterMessageText.value = areaScenario?.onEnterMessage?.text ?? '';
  dom.enterMessageSeconds.value =
    areaScenario?.onEnterMessage?.seconds === undefined ? '' : String(areaScenario.onEnterMessage.seconds);
  dom.exitMessageText.value = areaScenario?.onExitMessage?.text ?? '';
  dom.exitMessageSeconds.value =
    areaScenario?.onExitMessage?.seconds === undefined ? '' : String(areaScenario.onExitMessage.seconds);
}

function getFileName(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return 'No file chosen.';
  }
  const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

export function setGameEditorStatus(dom: GameEditorDomRefs, text: string): void {
  dom.statusLine.textContent = text;
}

function bindActionList(container: HTMLElement, kind: 'enter' | 'exit', handlers: GameEditorDomHandlers): void {
  container.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    const row = target?.closest<HTMLElement>('[data-action-index]');
    if (!target || !row) return;
    handlers.onUpdateAction(kind, Number(row.dataset.actionIndex), target.dataset.field as 'operation' | 'what' | 'qty', target.value);
  });

  container.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-delete-action]');
    const row = button?.closest<HTMLElement>('[data-action-index]');
    if (!button || !row) return;
    handlers.onDeleteAction(kind, Number(row.dataset.actionIndex));
  });
}

function bindKeyValueList(container: HTMLElement, kind: 'permission' | 'qa', handlers: GameEditorDomHandlers): void {
  container.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    const row = target?.closest<HTMLElement>('[data-kv-index]');
    if (!target || !row) return;
    const index = Number(row.dataset.kvIndex);
    if (kind === 'permission') {
      handlers.onUpdatePermission(index, target.dataset.field as 'key' | 'value', target.value);
      return;
    }
    handlers.onUpdateQa(index, target.dataset.field as 'question' | 'answer', target.value);
  });

  container.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-delete-kv]');
    const row = button?.closest<HTMLElement>('[data-kv-index]');
    if (!button || !row) return;
    const index = Number(row.dataset.kvIndex);
    if (kind === 'permission') {
      handlers.onDeletePermission(index);
    } else {
      handlers.onDeleteQa(index);
    }
  });
}

function renderActionRows(container: HTMLElement, actions: AreaGameScenario['onEnterActions'] | AreaGameScenario['onExitActions']): void {
  container.innerHTML = actions && actions.length > 0
    ? actions
        .map(
          (action, index) => `
            <div class="list-row triple-row" data-action-index="${index}">
              <select data-field="operation">
                ${ACTION_OPTIONS.map((option) => `<option value="${option}" ${option === action.operation ? 'selected' : ''}>${option}</option>`).join('')}
              </select>
              <input type="text" data-field="what" value="${escapeAttr(action.what)}" placeholder="what" />
              <input type="number" data-field="qty" value="${Number.isFinite(action.qty) ? action.qty : 0}" step="0.1" />
              <button type="button" data-delete-action>Delete</button>
            </div>
          `
        )
        .join('')
    : '<div class="small-note">No actions.</div>';
}

function renderKeyValueRows(
  container: HTMLElement,
  entries: Array<[string, string]>,
  keyField: 'key' | 'question',
  valueField: 'value' | 'answer'
): void {
  container.innerHTML = entries.length > 0
    ? entries
        .map(
          ([key, value], index) => `
            <div class="list-row double-row" data-kv-index="${index}">
              <input type="text" data-field="${keyField}" value="${escapeAttr(key)}" placeholder="${keyField}" />
              <input type="text" data-field="${valueField}" value="${escapeAttr(value)}" placeholder="${valueField}" />
              <button type="button" data-delete-kv>Delete</button>
            </div>
          `
        )
        .join('')
    : '<div class="small-note">No entries.</div>';
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

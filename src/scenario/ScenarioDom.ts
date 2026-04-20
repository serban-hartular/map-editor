import type { MapArea } from '../types';
import type { AreaScenario, ScenarioActionOperation } from './types';

export interface ScenarioDomRefs {
  modeButtons: {
    map: HTMLButtonElement;
    scenario: HTMLButtonElement;
  };
  mapJsonPathInput: HTMLInputElement;
  mapJsonFileInput: HTMLInputElement;
  scenarioJsonFileInput: HTMLInputElement;
  newScenarioButton: HTMLButtonElement;
  saveFilenameInput: HTMLInputElement;
  saveScenarioButton: HTMLButtonElement;
  fitButton: HTMLButtonElement;
  mapInfoLabel: HTMLElement;
  configuredAreasLabel: HTMLElement;
  selectedAreaLabel: HTMLElement;
  selectedAreaMeta: HTMLElement;
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

export interface ScenarioDomHandlers {
  onMapJsonPathInput: () => void;
  onLoadMapJson: () => void;
  onLoadScenarioJson: () => void;
  onNewScenario: () => void;
  onSaveScenario: () => void;
  onFitView: () => void;
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

const ACTION_OPTIONS: ScenarioActionOperation[] = ['assign', 'give', 'take', 'display', 'transition'];

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element #${id}`);
  }
  return el as T;
}

export function getScenarioDomRefs(): ScenarioDomRefs {
  return {
    modeButtons: {
      map: must<HTMLButtonElement>('mode-map'),
      scenario: must<HTMLButtonElement>('mode-scenario')
    },
    mapJsonPathInput: must<HTMLInputElement>('scenario-map-json-path'),
    mapJsonFileInput: must<HTMLInputElement>('scenario-map-json-file'),
    scenarioJsonFileInput: must<HTMLInputElement>('scenario-json-file'),
    newScenarioButton: must<HTMLButtonElement>('new-scenario-btn'),
    saveFilenameInput: must<HTMLInputElement>('scenario-save-filename'),
    saveScenarioButton: must<HTMLButtonElement>('save-scenario-btn'),
    fitButton: must<HTMLButtonElement>('scenario-fit-view'),
    mapInfoLabel: must<HTMLElement>('scenario-map-info'),
    configuredAreasLabel: must<HTMLElement>('scenario-configured-areas'),
    selectedAreaLabel: must<HTMLElement>('scenario-selected-area'),
    selectedAreaMeta: must<HTMLElement>('scenario-selected-area-meta'),
    enterActionsList: must<HTMLElement>('scenario-enter-actions-list'),
    addEnterActionButton: must<HTMLButtonElement>('scenario-add-enter-action'),
    enterMessageText: must<HTMLTextAreaElement>('scenario-enter-message'),
    enterMessageSeconds: must<HTMLInputElement>('scenario-enter-message-seconds'),
    exitActionsList: must<HTMLElement>('scenario-exit-actions-list'),
    addExitActionButton: must<HTMLButtonElement>('scenario-add-exit-action'),
    exitMessageText: must<HTMLTextAreaElement>('scenario-exit-message'),
    exitMessageSeconds: must<HTMLInputElement>('scenario-exit-message-seconds'),
    permissionsList: must<HTMLElement>('scenario-permissions-list'),
    addPermissionButton: must<HTMLButtonElement>('scenario-add-permission'),
    qaList: must<HTMLElement>('scenario-qa-list'),
    addQaButton: must<HTMLButtonElement>('scenario-add-qa'),
    statusLine: must<HTMLElement>('scenario-status-line')
  };
}

let activeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

export function bindScenarioDomEvents(dom: ScenarioDomRefs, handlers: ScenarioDomHandlers): void {
  dom.mapJsonPathInput.addEventListener('input', handlers.onMapJsonPathInput);
  dom.mapJsonFileInput.addEventListener('change', handlers.onLoadMapJson);
  dom.scenarioJsonFileInput.addEventListener('change', handlers.onLoadScenarioJson);
  dom.newScenarioButton.addEventListener('click', handlers.onNewScenario);
  dom.saveScenarioButton.addEventListener('click', handlers.onSaveScenario);
  dom.fitButton.addEventListener('click', handlers.onFitView);
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

function bindActionList(container: HTMLElement, kind: 'enter' | 'exit', handlers: ScenarioDomHandlers): void {
  container.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    const row = target?.closest<HTMLElement>('[data-action-index]');
    if (!target || !row) return;
    const index = Number(row.dataset.actionIndex);
    const field = target.dataset.field as 'operation' | 'what' | 'qty';
    handlers.onUpdateAction(kind, index, field, target.value);
  });

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-delete-action]');
    if (!button) return;
    const row = button.closest<HTMLElement>('[data-action-index]');
    if (!row) return;
    handlers.onDeleteAction(kind, Number(row.dataset.actionIndex));
  });
}

function bindKeyValueList(container: HTMLElement, kind: 'permission' | 'qa', handlers: ScenarioDomHandlers): void {
  container.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    const row = target?.closest<HTMLElement>('[data-kv-index]');
    if (!target || !row) return;
    const index = Number(row.dataset.kvIndex);
    const field = target.dataset.field as 'key' | 'value' | 'question' | 'answer';
    if (kind === 'permission') {
      handlers.onUpdatePermission(index, field as 'key' | 'value', target.value);
      return;
    }
    handlers.onUpdateQa(index, field as 'question' | 'answer', target.value);
  });

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-delete-kv]');
    if (!button) return;
    const row = button.closest<HTMLElement>('[data-kv-index]');
    if (!row) return;
    const index = Number(row.dataset.kvIndex);
    if (kind === 'permission') {
      handlers.onDeletePermission(index);
      return;
    }
    handlers.onDeleteQa(index);
  });
}

export function refreshScenarioMetadataUI(
  dom: ScenarioDomRefs,
  mapJsonPath: string,
  mapId: string,
  configuredAreas: number,
  totalAreas: number
): void {
  dom.mapJsonPathInput.value = mapJsonPath;
  dom.mapInfoLabel.textContent = mapId ? `Map: ${mapId}` : 'No map loaded.';
  dom.configuredAreasLabel.textContent = `Configured areas: ${configuredAreas} / ${totalAreas}`;
}

export function refreshScenarioSelectionUI(
  dom: ScenarioDomRefs,
  area: MapArea | null,
  areaScenario: AreaScenario | undefined
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

  if (!area) {
    dom.selectedAreaLabel.textContent = 'No area selected.';
    dom.selectedAreaMeta.textContent = '';
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
  dom.selectedAreaMeta.textContent = [area.label && `Label: ${area.label}`, `Shape: ${area.shape.type}`]
    .filter(Boolean)
    .join(' | ');
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

export function setScenarioStatus(dom: ScenarioDomRefs, text: string): void {
  dom.statusLine.textContent = text;
}

function renderActionRows(container: HTMLElement, actions: AreaScenario['onEnterActions'] | AreaScenario['onExitActions']): void {
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

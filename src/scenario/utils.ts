import type { AreaScenario, ScenarioAction, ScenarioActionOperation, ScenarioData, ScenarioMessage } from './types';

const ACTION_OPERATIONS: readonly ScenarioActionOperation[] = ['assign', 'give', 'take', 'display', 'transition'];

export function createEmptyScenarioData(): ScenarioData {
  return {
    mapJsonPath: '',
    mapId: '',
    areas: {}
  };
}

export function sanitizeScenarioData(raw: unknown): ScenarioData {
  const data = raw as Partial<ScenarioData>;
  const areas = data.areas && typeof data.areas === 'object' ? data.areas : {};

  return {
    mapJsonPath: typeof data.mapJsonPath === 'string' ? data.mapJsonPath : '',
    mapId: typeof data.mapId === 'string' ? data.mapId : '',
    areas: Object.fromEntries(
      Object.entries(areas as Record<string, unknown>)
        .filter(([key]) => Boolean(key))
        .map(([key, value]) => [key, sanitizeAreaScenario(value)])
    )
  };
}

export function cloneAreaScenario(areaScenario: AreaScenario | undefined): AreaScenario {
  if (!areaScenario) {
    return {};
  }

  return {
    onEnterActions: areaScenario.onEnterActions?.map(cloneAction),
    onExitActions: areaScenario.onExitActions?.map(cloneAction),
    onEnterMessage: cloneMessage(areaScenario.onEnterMessage),
    onExitMessage: cloneMessage(areaScenario.onExitMessage),
    permissions: areaScenario.permissions ? { ...areaScenario.permissions } : undefined,
    qa: areaScenario.qa ? { ...areaScenario.qa } : undefined
  };
}

export function formatScenarioJson(data: ScenarioData): string {
  return JSON.stringify(data, null, 2);
}

function sanitizeAreaScenario(raw: unknown): AreaScenario {
  const area = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    onEnterActions: sanitizeActionList(area.onEnterActions),
    onExitActions: sanitizeActionList(area.onExitActions),
    onEnterMessage: sanitizeMessage(area.onEnterMessage),
    onExitMessage: sanitizeMessage(area.onExitMessage),
    permissions: sanitizeStringMap(area.permissions),
    qa: sanitizeStringMap(area.qa)
  };
}

function sanitizeActionList(raw: unknown): ScenarioAction[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const actions = raw
    .map((item) => sanitizeAction(item))
    .filter((item): item is ScenarioAction => item !== null);
  return actions.length > 0 ? actions : undefined;
}

function sanitizeAction(raw: unknown): ScenarioAction | null {
  const action = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const operation = typeof action.operation === 'string' ? action.operation : '';
  if (!ACTION_OPERATIONS.includes(operation as ScenarioActionOperation)) {
    return null;
  }

  return {
    operation: operation as ScenarioActionOperation,
    what: typeof action.what === 'string' ? action.what : '',
    qty: typeof action.qty === 'number' && Number.isFinite(action.qty) ? action.qty : 0
  };
}

function cloneAction(action: ScenarioAction): ScenarioAction {
  return { ...action };
}

function sanitizeMessage(raw: unknown): ScenarioMessage | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const message = raw as Record<string, unknown>;
  const text = typeof message.text === 'string' ? message.text : '';
  const seconds = typeof message.seconds === 'number' && Number.isFinite(message.seconds) ? message.seconds : undefined;
  if (!text && seconds === undefined) {
    return undefined;
  }

  return { text, seconds };
}

function cloneMessage(message: ScenarioMessage | undefined): ScenarioMessage | undefined {
  return message ? { ...message } : undefined;
}

function sanitizeStringMap(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const entries = Object.entries(raw as Record<string, unknown>).filter(([key, value]) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      return false;
    }
    return key.trim() !== '' || value.trim() !== '';
  });
  return entries.length > 0 ? Object.fromEntries(entries as [string, string][]) : undefined;
}

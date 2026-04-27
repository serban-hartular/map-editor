import type { ScenarioAction, ScenarioActionOperation, ScenarioMessage } from '../scenario/types';
import type {
  AreaDisplayConfig,
  AreaGameScenario,
  AreaTransition,
  GameData,
  GameMapScenario,
  PlayerState,
  Task,
  TaskCondition,
  TaskConditionOp
} from './types';

const ACTION_OPERATIONS: readonly ScenarioActionOperation[] = ['assign', 'give', 'take', 'display', 'transition'];
const CONDITION_OPERATIONS: readonly TaskConditionOp[] = ['==', '!=', '<', '>', '<=', '>=', 'exists'];

export function createDefaultPlayerState(): PlayerState {
  return {
    mapId: '',
    areaId: null,
    position: { x: 0, y: 0 },
    vehicle: '',
    store: {}
  };
}

export function createEmptyGameData(): GameData {
  return {
    id: 'new_game',
    name: 'New Game',
    initialPlayerState: createDefaultPlayerState(),
    tasks: [],
    maps: {}
  };
}

export function createEmptyGameMapScenario(mapId = '', mapJsonPath = ''): GameMapScenario {
  return {
    mapId,
    mapJsonPath,
    areas: {}
  };
}

export function sanitizeGameData(raw: unknown): GameData {
  const data = raw as Partial<GameData>;
  const maps = data.maps && typeof data.maps === 'object' ? data.maps : {};

  return {
    id: typeof data.id === 'string' ? data.id : 'new_game',
    name: typeof data.name === 'string' ? data.name : 'New Game',
    initialPlayerState: sanitizePlayerState(data.initialPlayerState),
    tasks: sanitizeTasks(data.tasks),
    maps: Object.fromEntries(
      Object.entries(maps as Record<string, unknown>)
        .filter(([key]) => Boolean(key))
        .map(([key, value]) => [key, sanitizeGameMapScenario(value, key)])
    )
  };
}

export function cloneGameData(gameData: GameData): GameData {
  return {
    id: gameData.id,
    name: gameData.name,
    initialPlayerState: clonePlayerState(gameData.initialPlayerState),
    tasks: gameData.tasks.map(cloneTask),
    maps: Object.fromEntries(Object.entries(gameData.maps).map(([key, value]) => [key, cloneGameMapScenario(value)]))
  };
}

export function formatGameJson(data: GameData): string {
  return JSON.stringify(data, null, 2);
}

function sanitizePlayerState(raw: unknown): PlayerState {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPlayerState();
  }

  const state = raw as Record<string, unknown>;
  return {
    mapId: typeof state.mapId === 'string' ? state.mapId : '',
    areaId: typeof state.areaId === 'string' ? state.areaId : null,
    position: sanitizePosition(state.position),
    vehicle: typeof state.vehicle === 'string' ? state.vehicle : '',
    store: sanitizeNumberMap(state.store) ?? {},
    justEnteredAreaId:
      state.justEnteredAreaId === null || typeof state.justEnteredAreaId === 'string' ? (state.justEnteredAreaId as
        | string
        | null
        | undefined) : undefined,
    justExitedAreaId:
      state.justExitedAreaId === null || typeof state.justExitedAreaId === 'string' ? (state.justExitedAreaId as
        | string
        | null
        | undefined) : undefined
  };
}

function sanitizePosition(raw: unknown): PlayerState['position'] {
  if (!raw || typeof raw !== 'object') {
    return { x: 0, y: 0 };
  }

  const position = raw as Record<string, unknown>;
  return {
    x: typeof position.x === 'number' && Number.isFinite(position.x) ? position.x : 0,
    y: typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : 0
  };
}

function sanitizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((task) => sanitizeTask(task))
    .filter((task): task is Task => task !== null);
}

function sanitizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const task = raw as Record<string, unknown>;
  return {
    id: typeof task.id === 'string' ? task.id : 'task',
    name: typeof task.name === 'string' ? task.name : '',
    inceptionMessage: sanitizeMessage(task.inceptionMessage),
    completionMessage: sanitizeMessage(task.completionMessage),
    conditions: sanitizeConditions(task.conditions),
    actions: sanitizeActionList(task.actions)
  };
}

function sanitizeConditions(raw: unknown): TaskCondition[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((condition) => sanitizeCondition(condition))
    .filter((condition): condition is TaskCondition => condition !== null);
}

function sanitizeCondition(raw: unknown): TaskCondition | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const condition = raw as Record<string, unknown>;
  const op = typeof condition.op === 'string' ? condition.op : '';
  if (!CONDITION_OPERATIONS.includes(op as TaskConditionOp)) {
    return null;
  }

  const variable = typeof condition.variable === 'string' ? condition.variable : '';
  if (!variable) {
    return null;
  }

  const value =
    typeof condition.value === 'string' || (typeof condition.value === 'number' && Number.isFinite(condition.value))
      ? condition.value
      : undefined;

  return op === 'exists' ? { variable, op: 'exists' } : { variable, op: op as TaskConditionOp, value };
}

function sanitizeGameMapScenario(raw: unknown, key: string): GameMapScenario {
  if (!raw || typeof raw !== 'object') {
    return createEmptyGameMapScenario(key, '');
  }

  const mapScenario = raw as Record<string, unknown>;
  const areas = mapScenario.areas && typeof mapScenario.areas === 'object' ? mapScenario.areas : {};

  return {
    mapId: typeof mapScenario.mapId === 'string' ? mapScenario.mapId : key,
    mapJsonPath: typeof mapScenario.mapJsonPath === 'string' ? mapScenario.mapJsonPath : '',
    parentMapId: typeof mapScenario.parentMapId === 'string' ? mapScenario.parentMapId : undefined,
    parentAreaId: typeof mapScenario.parentAreaId === 'string' ? mapScenario.parentAreaId : undefined,
    areas: Object.fromEntries(
      Object.entries(areas as Record<string, unknown>)
        .filter(([areaId]) => Boolean(areaId))
        .map(([areaId, value]) => [areaId, sanitizeAreaGameScenario(value)])
    )
  };
}

function sanitizeAreaGameScenario(raw: unknown): AreaGameScenario {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const area = raw as Record<string, unknown>;
  return {
    display: sanitizeAreaDisplayConfig(area.display),
    onEnterActions: sanitizeActionList(area.onEnterActions),
    onExitActions: sanitizeActionList(area.onExitActions),
    onEnterMessage: sanitizeMessage(area.onEnterMessage),
    onExitMessage: sanitizeMessage(area.onExitMessage),
    permissions: sanitizeStringMap(area.permissions),
    qa: sanitizeStringMap(area.qa),
    transition: sanitizeTransition(area.transition)
  };
}

function sanitizeAreaDisplayConfig(raw: unknown): AreaDisplayConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const display = raw as Record<string, unknown>;
  const normalized: AreaDisplayConfig = {
    showLabel: typeof display.showLabel === 'boolean' ? display.showLabel : undefined,
    showIcon: typeof display.showIcon === 'boolean' ? display.showIcon : undefined,
    showBackground: typeof display.showBackground === 'boolean' ? display.showBackground : undefined
  };

  return normalized.showLabel === undefined && normalized.showIcon === undefined && normalized.showBackground === undefined
    ? undefined
    : normalized;
}

function sanitizeTransition(raw: unknown): AreaTransition | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const transition = raw as Record<string, unknown>;
  const targetMapId = typeof transition.targetMapId === 'string' ? transition.targetMapId : '';
  const targetMapJsonPath = typeof transition.targetMapJsonPath === 'string' ? transition.targetMapJsonPath : '';

  if (!targetMapId || !targetMapJsonPath) {
    return undefined;
  }

  return {
    targetMapId,
    targetMapJsonPath,
    returnToMapId: typeof transition.returnToMapId === 'string' ? transition.returnToMapId : undefined,
    returnToAreaId: typeof transition.returnToAreaId === 'string' ? transition.returnToAreaId : undefined
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
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const action = raw as Record<string, unknown>;
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

function sanitizeNumberMap(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([key, value]) => typeof key === 'string' && typeof value === 'number' && Number.isFinite(value)
  );
  return entries.length > 0 ? Object.fromEntries(entries as [string, number][]) : undefined;
}

function clonePlayerState(playerState: PlayerState): PlayerState {
  return {
    mapId: playerState.mapId,
    areaId: playerState.areaId,
    position: { ...playerState.position },
    vehicle: playerState.vehicle,
    store: { ...playerState.store },
    justEnteredAreaId: playerState.justEnteredAreaId,
    justExitedAreaId: playerState.justExitedAreaId
  };
}

function cloneTask(task: Task): Task {
  return {
    id: task.id,
    name: task.name,
    inceptionMessage: cloneMessage(task.inceptionMessage),
    completionMessage: cloneMessage(task.completionMessage),
    conditions: task.conditions.map(cloneCondition),
    actions: task.actions?.map((action) => ({ ...action }))
  };
}

function cloneCondition(condition: TaskCondition): TaskCondition {
  return { ...condition };
}

function cloneGameMapScenario(mapScenario: GameMapScenario): GameMapScenario {
  return {
    mapId: mapScenario.mapId,
    mapJsonPath: mapScenario.mapJsonPath,
    parentMapId: mapScenario.parentMapId,
    parentAreaId: mapScenario.parentAreaId,
    areas: Object.fromEntries(Object.entries(mapScenario.areas).map(([key, value]) => [key, cloneAreaGameScenario(value)]))
  };
}

function cloneAreaGameScenario(areaScenario: AreaGameScenario): AreaGameScenario {
  return {
    display: areaScenario.display ? { ...areaScenario.display } : undefined,
    onEnterActions: areaScenario.onEnterActions?.map((action) => ({ ...action })),
    onExitActions: areaScenario.onExitActions?.map((action) => ({ ...action })),
    onEnterMessage: cloneMessage(areaScenario.onEnterMessage),
    onExitMessage: cloneMessage(areaScenario.onExitMessage),
    permissions: areaScenario.permissions ? { ...areaScenario.permissions } : undefined,
    qa: areaScenario.qa ? { ...areaScenario.qa } : undefined,
    transition: areaScenario.transition ? { ...areaScenario.transition } : undefined
  };
}

function cloneMessage(message: ScenarioMessage | undefined): ScenarioMessage | undefined {
  return message ? { ...message } : undefined;
}

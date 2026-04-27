import type { ScenarioAction, ScenarioMessage } from '../scenario/types';

export type TaskConditionOp = '==' | '!=' | '<' | '>' | '<=' | '>=' | 'exists';
export type TaskAction = ScenarioAction;

export interface PlayerPosition {
  x: number;
  y: number;
}

export interface PlayerState {
  mapId: string;
  areaId: string | null;
  position: PlayerPosition;
  vehicle: string;
  store: Record<string, number>;
  justEnteredAreaId?: string | null;
  justExitedAreaId?: string | null;
}

export interface TaskCondition {
  variable: string;
  op: TaskConditionOp;
  value?: string | number;
}

export interface Task {
  id: string;
  name: string;
  inceptionMessage?: ScenarioMessage;
  completionMessage?: ScenarioMessage;
  conditions: TaskCondition[];
  actions?: TaskAction[];
}

export interface AreaDisplayConfig {
  showLabel?: boolean;
  showIcon?: boolean;
  showBackground?: boolean;
}

export interface AreaTransition {
  targetMapId: string;
  targetMapJsonPath: string;
  returnToMapId?: string;
  returnToAreaId?: string;
}

export interface AreaGameScenario {
  display?: AreaDisplayConfig;
  onEnterActions?: ScenarioAction[];
  onExitActions?: ScenarioAction[];
  onEnterMessage?: ScenarioMessage;
  onExitMessage?: ScenarioMessage;
  permissions?: Record<string, string>;
  qa?: Record<string, string>;
  transition?: AreaTransition;
}

export interface GameMapScenario {
  mapId: string;
  mapJsonPath: string;
  parentMapId?: string;
  parentAreaId?: string;
  areas: Record<string, AreaGameScenario>;
}

export interface GameData {
  id: string;
  name: string;
  initialPlayerState: PlayerState;
  tasks: Task[];
  maps: Record<string, GameMapScenario>;
}

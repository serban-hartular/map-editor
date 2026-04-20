export type ScenarioActionOperation = 'assign' | 'give' | 'take' | 'display' | 'transition';

export interface ScenarioAction {
  operation: ScenarioActionOperation;
  what: string;
  qty: number;
}

export interface ScenarioMessage {
  text: string;
  seconds?: number;
}

export interface AreaScenario {
  onEnterActions?: ScenarioAction[];
  onExitActions?: ScenarioAction[];
  onEnterMessage?: ScenarioMessage;
  onExitMessage?: ScenarioMessage;
  permissions?: Record<string, string>;
  qa?: Record<string, string>;
}

export interface ScenarioData {
  mapJsonPath: string;
  mapId: string;
  areas: Record<string, AreaScenario>;
}

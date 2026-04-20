export type VehicleDirection = 'up' | 'down' | 'left' | 'right';
export type TerrainRuleMode = 'allow' | 'block';
export type TerrainSamplePoint = 'center' | 'feet';

export interface VehicleFrameSet {
  idle: number;
  move: number[];
}

export interface VehicleTerrainRule {
  mode: TerrainRuleMode;
  colors: string[];
  tolerance?: number;
}

export interface VehicleTerrainConfig {
  sample?: TerrainSamplePoint;
  rules: VehicleTerrainRule[];
}

export interface VehicleDefinition {
  id: string;
  name: string;
  sprites: string;
  speed?: number;
  terrain?: VehicleTerrainConfig;
  frameWidth?: number;
  frameHeight?: number;
  margin?: number;
  spacing?: number;
  frameDurationMs?: number;
  directionalFrames?: Record<VehicleDirection, VehicleFrameSet>;
}

export function sanitizeVehicleDefinition(raw: unknown): VehicleDefinition {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof value.id === 'string' ? value.id : 'vehicle',
    name: typeof value.name === 'string' ? value.name : 'Vehicle',
    sprites:
      typeof value.sprites === 'string'
        ? value.sprites
        : typeof value.spriteSheetPath === 'string'
          ? value.spriteSheetPath
          : '',
    speed: typeof value.speed === 'number' && Number.isFinite(value.speed) ? value.speed : undefined,
    terrain: sanitizeTerrainConfig(value.terrain),
    frameWidth: typeof value.frameWidth === 'number' && Number.isFinite(value.frameWidth) ? value.frameWidth : undefined,
    frameHeight: typeof value.frameHeight === 'number' && Number.isFinite(value.frameHeight) ? value.frameHeight : undefined,
    margin: typeof value.margin === 'number' && Number.isFinite(value.margin) ? value.margin : 0,
    spacing: typeof value.spacing === 'number' && Number.isFinite(value.spacing) ? value.spacing : 0,
    frameDurationMs:
      typeof value.frameDurationMs === 'number' && Number.isFinite(value.frameDurationMs) ? value.frameDurationMs : 140,
    directionalFrames: sanitizeDirectionalFrames(value.directionalFrames)
  };
}

function sanitizeTerrainConfig(raw: unknown): VehicleTerrainConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const rules = Array.isArray(value.rules)
    ? value.rules
        .map((rule) => sanitizeTerrainRule(rule))
        .filter((rule): rule is VehicleTerrainRule => rule !== null)
    : [];

  if (!rules.length) {
    return undefined;
  }

  return {
    sample: value.sample === 'feet' ? 'feet' : 'center',
    rules
  };
}

function sanitizeTerrainRule(raw: unknown): VehicleTerrainRule | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const mode = value.mode === 'allow' ? 'allow' : value.mode === 'block' ? 'block' : null;
  const colors = Array.isArray(value.colors)
    ? value.colors.filter((color): color is string => typeof color === 'string' && color.trim().length > 0)
    : [];
  if (!mode || !colors.length) {
    return null;
  }

  return {
    mode,
    colors,
    tolerance: typeof value.tolerance === 'number' && Number.isFinite(value.tolerance) ? value.tolerance : undefined
  };
}

function sanitizeDirectionalFrames(raw: unknown): Record<VehicleDirection, VehicleFrameSet> | undefined {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  return {
    down: sanitizeFrameSet(value.down, 0),
    right: sanitizeFrameSet(value.right, 5),
    up: sanitizeFrameSet(value.up, 10),
    left: sanitizeFrameSet(value.left, 15)
  };
}

function sanitizeFrameSet(raw: unknown, fallbackStart: number): VehicleFrameSet {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const move = Array.isArray(value.move)
    ? value.move.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [fallbackStart + 1, fallbackStart + 2, fallbackStart + 3, fallbackStart + 4];

  return {
    idle: typeof value.idle === 'number' && Number.isFinite(value.idle) ? value.idle : fallbackStart,
    move
  };
}

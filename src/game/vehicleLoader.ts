import Phaser from 'phaser';
import { loadPixelLabVehicle } from './pixelLabVehicleLoader';
import {
  sanitizeVehicleDefinition,
  type VehicleDefinition,
  type VehicleDirection,
  type VehicleTerrainConfig
} from './vehicleDefinition';

export type LoadedVehicle =
  | {
      kind: 'static';
      id: string;
      name: string;
      textureKey: string;
      speed?: number;
      terrain?: VehicleTerrainConfig;
    }
  | {
      kind: 'spritesheet';
      id: string;
      name: string;
      textureKey: string;
      definition: VehicleDefinition;
      speed?: number;
      terrain?: VehicleTerrainConfig;
    }
  | {
      kind: 'pixellab';
      id: string;
      name: string;
      frameDurationMs: number;
      idleTextures: Record<VehicleDirection, string>;
      moveTextures: Record<VehicleDirection, string[]>;
      speed?: number;
      terrain?: VehicleTerrainConfig;
    };

export class VehicleLoader {
  constructor(private readonly scene: Phaser.Scene) {}

  async loadVehicle(vehiclePath: string): Promise<LoadedVehicle> {
    const resolvedPath = this.resolveVehiclePath(vehiclePath);
    if (resolvedPath.endsWith('.json')) {
      return this.loadJsonVehicle(resolvedPath);
    }
    return this.loadStaticVehicle(resolvedPath);
  }

  private async loadJsonVehicle(path: string): Promise<LoadedVehicle> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load vehicle definition: ${path}`);
    }

    const raw = await response.json();
    if (looksLikePixelLabMetadata(raw)) {
      return loadPixelLabVehicle(this.scene, path, raw);
    }

    const definition = sanitizeVehicleDefinition(raw);
    if (!definition.sprites) {
      throw new Error(`Vehicle definition ${path} is missing sprites.`);
    }

    const spritePath = resolveRelativeAssetPath(path, definition.sprites);
    if (spritePath.endsWith('.json')) {
      const nestedVehicle = await this.loadJsonVehicle(spritePath);
      return {
        ...nestedVehicle,
        id: definition.id || nestedVehicle.id,
        name: definition.name || nestedVehicle.name,
        speed: definition.speed ?? nestedVehicle.speed,
        terrain: definition.terrain ?? nestedVehicle.terrain
      };
    }

    if (!definition.directionalFrames || !definition.frameWidth || !definition.frameHeight) {
      const staticVehicle = await this.loadStaticVehicle(spritePath);
      return {
        ...staticVehicle,
        id: definition.id || staticVehicle.id,
        name: definition.name || staticVehicle.name,
        speed: definition.speed,
        terrain: definition.terrain
      };
    }

    const frameWidth = definition.frameWidth ?? 64;
    const frameHeight = definition.frameHeight ?? 64;
    const textureKey = `game-player:${definition.id}`;
    if (!this.scene.textures.exists(textureKey)) {
      await new Promise<void>((resolve, reject) => {
        this.scene.load.spritesheet(textureKey, spritePath, {
          frameWidth,
          frameHeight,
          margin: definition.margin ?? 0,
          spacing: definition.spacing ?? 0
        });
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () =>
          reject(new Error(`Failed to load vehicle sprite sheet: ${spritePath}`))
        );
        this.scene.load.start();
      });
    }

    return {
      kind: 'spritesheet',
      id: definition.id,
      name: definition.name,
      textureKey,
      definition: {
        ...definition,
        sprites: spritePath
      },
      speed: definition.speed,
      terrain: definition.terrain
    };
  }

  private async loadStaticVehicle(path: string): Promise<LoadedVehicle> {
    const textureKey = `game-player:${path}`;
    if (!this.scene.textures.exists(textureKey)) {
      await new Promise<void>((resolve, reject) => {
        this.scene.load.image(textureKey, path);
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load player image: ${path}`)));
        this.scene.load.start();
      });
    }

    return {
      kind: 'static',
      id: path,
      name: path,
      textureKey
    };
  }

  private resolveVehiclePath(vehicle: string): string {
    const trimmed = vehicle.trim();
    if (!trimmed) {
      return '/vehicles/image.png';
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/vehicles/${trimmed}`;
  }
}

function looksLikePixelLabMetadata(raw: unknown): boolean {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Boolean(value.export_version && value.frames);
}

function resolveRelativeAssetPath(basePath: string, assetPath: string): string {
  if (assetPath.startsWith('/')) {
    return assetPath;
  }
  const slashIndex = basePath.lastIndexOf('/');
  const baseDir = slashIndex >= 0 ? basePath.slice(0, slashIndex + 1) : '/';
  return `${baseDir}${assetPath}`;
}

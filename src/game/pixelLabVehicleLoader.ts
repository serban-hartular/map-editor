import Phaser from 'phaser';
import type { VehicleDirection } from './vehicleDefinition';
import type { LoadedVehicle } from './vehicleLoader';

interface PixelLabMetadata {
  character?: {
    id?: string;
    name?: string;
  };
  frames?: {
    rotations?: Partial<Record<'north' | 'south' | 'east' | 'west', string>>;
    animations?: Record<
      string,
      Partial<Record<'north' | 'south' | 'east' | 'west', string[]>>
    >;
  };
}

const PIXELLAB_DIRECTION_MAP: Record<'north' | 'south' | 'east' | 'west', VehicleDirection> = {
  north: 'up',
  south: 'down',
  east: 'right',
  west: 'left'
};

export async function loadPixelLabVehicle(
  scene: Phaser.Scene,
  metadataPath: string,
  metadata: PixelLabMetadata
): Promise<LoadedVehicle> {
  const basePath = getBasePath(metadataPath);
  const idleTextures: Record<VehicleDirection, string> = {
    up: '',
    down: '',
    left: '',
    right: ''
  };
  const moveTextures: Record<VehicleDirection, string[]> = {
    up: [],
    down: [],
    left: [],
    right: []
  };

  const rotations = metadata.frames?.rotations ?? {};
  for (const [sourceDirection, relativePath] of Object.entries(rotations) as Array<
    ['north' | 'south' | 'east' | 'west', string | undefined]
  >) {
    if (!relativePath) {
      continue;
    }
    const runtimeDirection = PIXELLAB_DIRECTION_MAP[sourceDirection];
    const absolutePath = joinAssetPath(basePath, relativePath);
    idleTextures[runtimeDirection] = await loadImageTexture(scene, absolutePath);
  }

  const animations = metadata.frames?.animations ?? {};
  const firstAnimation = Object.values(animations)[0] ?? {};
  for (const [sourceDirection, frames] of Object.entries(firstAnimation) as Array<
    ['north' | 'south' | 'east' | 'west', string[] | undefined]
  >) {
    if (!frames?.length) {
      continue;
    }
    const runtimeDirection = PIXELLAB_DIRECTION_MAP[sourceDirection];
    moveTextures[runtimeDirection] = [];
    for (const framePath of frames) {
      moveTextures[runtimeDirection].push(await loadImageTexture(scene, joinAssetPath(basePath, framePath)));
    }
  }

  return {
    kind: 'pixellab',
    id: metadata.character?.id ?? metadataPath,
    name: metadata.character?.name ?? 'PixelLab Vehicle',
    frameDurationMs: 100,
    idleTextures,
    moveTextures,
    speed: undefined,
    terrain: undefined
  };
}

function getBasePath(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : '/';
}

function joinAssetPath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) {
    return relativePath;
  }
  return `${basePath}${relativePath}`;
}

async function loadImageTexture(scene: Phaser.Scene, path: string): Promise<string> {
  const key = `pixellab:${path}`;
  if (!scene.textures.exists(key)) {
    await new Promise<void>((resolve, reject) => {
      scene.load.image(key, path);
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load PixelLab frame: ${path}`)));
      scene.load.start();
    });
  }
  return key;
}

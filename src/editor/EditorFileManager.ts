import Phaser from 'phaser';
import type { MapData } from '../types';
import { formatJson, sanitizeMapData } from '../utils';

export interface FileManagerOptions {
  scene: Phaser.Scene;
  mapTextureKey: string;
  mapSprite: Phaser.GameObjects.Image;
  getImageObjectUrl: () => string | null;
  setImageObjectUrl: (url: string | null) => void;
}

export class EditorFileManager {
  private readonly scene: Phaser.Scene;
  private readonly mapTextureKey: string;
  private readonly mapSprite: Phaser.GameObjects.Image;
  private readonly getImageObjectUrlValue: () => string | null;
  private readonly setImageObjectUrlValue: (url: string | null) => void;

  constructor(options: FileManagerOptions) {
    this.scene = options.scene;
    this.mapTextureKey = options.mapTextureKey;
    this.mapSprite = options.mapSprite;
    this.getImageObjectUrlValue = options.getImageObjectUrl;
    this.setImageObjectUrlValue = options.setImageObjectUrl;
  }

  saveJson(mapData: MapData, filename: string): void {
    const blob = new Blob([formatJson(mapData)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename.trim() || 'map.json';
    a.click();
    URL.revokeObjectURL(href);
  }

  async loadJsonFromFile(file: File): Promise<MapData> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return sanitizeMapData(parsed);
  }

  async loadImageFromFile(file: File): Promise<{ width: number; height: number; imagePath: string }> {
    const oldUrl = this.getImageObjectUrlValue();
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    const url = URL.createObjectURL(file);
    this.setImageObjectUrlValue(url);

    const size = await this.loadTextureFromUrl(this.mapTextureKey, url);
    this.mapSprite.setTexture(this.mapTextureKey);
    this.mapSprite.setDisplaySize(size.width, size.height);
    this.scene.cameras.main.setBounds(0, 0, size.width, size.height);

    return {
      width: size.width,
      height: size.height,
      imagePath: file.name
    };
  }

  private async loadTextureFromUrl(key: string, url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
      this.scene.load.image(key, url);
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        const texture = this.scene.textures.get(key);
        const source = texture.getSourceImage() as HTMLImageElement;
        resolve({ width: source.width, height: source.height });
      });
      this.scene.load.start();
    });
  }
}

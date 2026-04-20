import type { Point } from '../types';
import type { VehicleTerrainConfig } from './vehicleDefinition';

interface SampledColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export class TerrainSampler {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;

  constructor(image: CanvasImageSource, width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Unable to create terrain sampling context.');
    }
    this.context = context;
    this.context.drawImage(image, 0, 0, width, height);
    this.width = width;
    this.height = height;
  }

  allows(position: Point, terrain: VehicleTerrainConfig | undefined, spriteSize: number): boolean {
    if (!terrain?.rules.length) {
      return true;
    }

    const samplePoint = this.getSamplePoint(position, terrain.sample ?? 'center', spriteSize);
    const color = this.readColor(samplePoint.x, samplePoint.y);
    if (!color) {
      return true;
    }

    const allowRules = terrain.rules.filter((rule) => rule.mode === 'allow');
    if (allowRules.length > 0 && !allowRules.some((rule) => this.matchesRule(color, rule.colors, rule.tolerance ?? 0))) {
      return false;
    }

    const blockRules = terrain.rules.filter((rule) => rule.mode === 'block');
    if (blockRules.some((rule) => this.matchesRule(color, rule.colors, rule.tolerance ?? 0))) {
      return false;
    }

    return true;
  }

  private getSamplePoint(position: Point, sample: 'center' | 'feet', spriteSize: number): Point {
    if (sample === 'feet') {
      return {
        x: position.x,
        y: position.y + spriteSize * 0.28
      };
    }
    return position;
  }

  private readColor(x: number, y: number): SampledColor | null {
    const sampleX = Math.max(0, Math.min(this.width - 1, Math.round(x)));
    const sampleY = Math.max(0, Math.min(this.height - 1, Math.round(y)));
    const data = this.context.getImageData(sampleX, sampleY, 1, 1).data;
    if (!data || data.length < 4) {
      return null;
    }
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  }

  private matchesRule(color: SampledColor, hexColors: string[], tolerance: number): boolean {
    return hexColors.some((hexColor) => {
      const target = parseHexColor(hexColor);
      if (!target) {
        return false;
      }
      return (
        Math.abs(color.r - target.r) <= tolerance &&
        Math.abs(color.g - target.g) <= tolerance &&
        Math.abs(color.b - target.b) <= tolerance
      );
    });
  }
}

function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

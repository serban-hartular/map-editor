import Phaser from 'phaser';
import type {
  AreaBackgroundPresentation,
  AreaIconPresentation,
  AreaLabelPresentation,
  AreaShape,
  MapArea,
  PresentationTarget,
  Point
} from '../types';
import { getAreaCenter } from '../utils';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR_OPACITY,
  DEFAULT_BACKGROUND_IMAGE_OPACITY,
  DEFAULT_ICON_SIZE,
  DEFAULT_LABEL_STYLE,
  getDefaultIconOffset,
  getDefaultLabelOffset
} from './presentationDefaults';

interface AreaPresentationRendererOptions {
  scene: Phaser.Scene;
  add: Phaser.GameObjects.GameObjectFactory;
  requestRedraw: () => void;
  resolveAssetUrl?: (kind: 'background' | 'icon', path: string) => string;
}

interface AreaVisualState {
  labelText: Phaser.GameObjects.Text;
  iconImage: Phaser.GameObjects.Image;
  backgroundImage: Phaser.GameObjects.Image;
  backgroundMask: Phaser.GameObjects.Graphics;
}

export interface PresentationHit {
  areaId: string;
  target: PresentationTarget;
}

const BACKGROUND_DEPTH = 100;
const BACKGROUND_IMAGE_DEPTH = 101;
const ICON_DEPTH = 400;
const LABEL_DEPTH = 500;
export class AreaPresentationRenderer {
  private readonly scene: Phaser.Scene;
  private readonly add: Phaser.GameObjects.GameObjectFactory;
  private readonly requestRedraw: () => void;
  private readonly resolveAssetUrl: (kind: 'background' | 'icon', path: string) => string;
  private readonly backgroundOverlay: Phaser.GameObjects.Graphics;
  private readonly visualStates = new Map<string, AreaVisualState>();
  private readonly pendingTextures = new Set<string>();
  private readonly failedTextures = new Set<string>();

  constructor(options: AreaPresentationRendererOptions) {
    this.scene = options.scene;
    this.add = options.add;
    this.requestRedraw = options.requestRedraw;
    this.resolveAssetUrl = options.resolveAssetUrl ?? ((_kind, path) => path);
    this.backgroundOverlay = this.add.graphics().setDepth(BACKGROUND_DEPTH);
  }

  redraw(areas: readonly MapArea[]): void {
    this.backgroundOverlay.clear();
    this.cleanup(areas);

    for (const area of areas) {
      this.drawAreaPresentation(area);
    }
  }

  hitTest(areas: readonly MapArea[], world: Point): PresentationHit | null {
    for (let i = areas.length - 1; i >= 0; i -= 1) {
      const area = areas[i];
      const visuals = this.visualStates.get(area.id);
      if (!visuals) {
        continue;
      }

      if (visuals.iconImage.visible && visuals.iconImage.getBounds().contains(world.x, world.y)) {
        return { areaId: area.id, target: 'icon' };
      }

      if (visuals.labelText.visible && visuals.labelText.getBounds().contains(world.x, world.y)) {
        return { areaId: area.id, target: 'label' };
      }
    }

    return null;
  }

  invalidateTexture(kind: 'background' | 'icon', path: string): void {
    const key = this.getTextureKey(kind, path);
    this.pendingTextures.delete(key);
    this.failedTextures.delete(key);
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
  }

  private drawAreaPresentation(area: MapArea): void {
    const visuals = this.getOrCreateVisualState(area.id);
    const center = getAreaCenter(area);
    const label = this.resolveLabel(area);
    const icon = this.resolveIcon(area);

    this.drawBackgroundColor(area.shape, area.presentation?.background);
    this.drawBackgroundImage(visuals, area, center);
    this.drawLabel(visuals.labelText, label, center, Boolean(icon?.path));
    this.drawIcon(visuals.iconImage, icon, center, Boolean(label?.text));
  }

  private drawBackgroundColor(shape: AreaShape, background: AreaBackgroundPresentation | undefined): void {
    const colorSpec = background?.color;
    const fillColor = colorSpec?.value ?? DEFAULT_BACKGROUND_COLOR;
    const fillOpacity = colorSpec?.opacity ?? DEFAULT_BACKGROUND_COLOR_OPACITY;
    this.backgroundOverlay.fillStyle(
      this.parseHexColor(fillColor, 0xffffff),
      fillOpacity
    );
    this.drawShapeFill(this.backgroundOverlay, shape);
  }

  private drawBackgroundImage(visuals: AreaVisualState, area: MapArea, center: Point): void {
    const imageSpec = area.presentation?.background?.image;
    if (!imageSpec?.path) {
      visuals.backgroundImage.setVisible(false);
      visuals.backgroundMask.clear();
      return;
    }

    const textureKey = this.ensureTexture('background', imageSpec.path);
    if (!textureKey || !this.scene.textures.exists(textureKey)) {
      visuals.backgroundImage.setVisible(false);
      return;
    }

    visuals.backgroundMask.clear();
    visuals.backgroundMask.fillStyle(0xffffff, 1);
    this.drawShapeFill(visuals.backgroundMask, area.shape);

    visuals.backgroundImage
      .setTexture(textureKey)
      .setPosition(center.x, center.y)
      .setOrigin(0.5)
      .setAlpha(imageSpec.opacity ?? DEFAULT_BACKGROUND_IMAGE_OPACITY)
      .setVisible(true);
  }

  private drawLabel(
    labelText: Phaser.GameObjects.Text,
    label: AreaLabelPresentation | undefined,
    center: Point,
    hasIcon: boolean
  ): void {
    const text = label?.text?.trim();
    if (!text) {
      labelText.setVisible(false);
      return;
    }

    const offset = label?.offset ?? getDefaultLabelOffset(hasIcon);
    const style = label?.style;
    labelText
      .setText(text)
      .setPosition(center.x + offset.x, center.y + offset.y)
      .setOrigin(0.5)
      .setVisible(true)
      .setDepth(LABEL_DEPTH)
      .setFontFamily(style?.fontFamily ?? DEFAULT_LABEL_STYLE.fontFamily)
      .setFontSize(style?.fontSize ?? DEFAULT_LABEL_STYLE.fontSize)
      .setColor(style?.color ?? DEFAULT_LABEL_STYLE.color)
      .setFontStyle(style?.fontStyle ?? DEFAULT_LABEL_STYLE.fontStyle)
      .setStroke(style?.stroke ?? DEFAULT_LABEL_STYLE.stroke, style?.strokeThickness ?? DEFAULT_LABEL_STYLE.strokeThickness);
  }

  private drawIcon(
    iconImage: Phaser.GameObjects.Image,
    icon: AreaIconPresentation | undefined,
    center: Point,
    hasLabel: boolean
  ): void {
    if (!icon?.path) {
      iconImage.setVisible(false);
      return;
    }

    const textureKey = this.ensureTexture('icon', icon.path);
    if (!textureKey || !this.scene.textures.exists(textureKey)) {
      iconImage.setVisible(false);
      return;
    }

    const offset = icon.offset ?? getDefaultIconOffset(hasLabel);
    const width = icon.width ?? DEFAULT_ICON_SIZE;
    const height = icon.height ?? DEFAULT_ICON_SIZE;

    iconImage
      .setTexture(textureKey)
      .setPosition(center.x + offset.x, center.y + offset.y)
      .setDisplaySize(width, height)
      .setOrigin(0.5)
      .setDepth(ICON_DEPTH)
      .setVisible(true);
  }

  private getOrCreateVisualState(areaId: string): AreaVisualState {
    const existing = this.visualStates.get(areaId);
    if (existing) {
      return existing;
    }

    const backgroundMask = this.add.graphics().setDepth(BACKGROUND_DEPTH).setVisible(false);
    const backgroundImage = this.add
      .image(0, 0, '__MISSING')
      .setVisible(false)
      .setDepth(BACKGROUND_IMAGE_DEPTH)
      .setMask(backgroundMask.createGeometryMask());
    const labelText = this.add
      .text(0, 0, '', {
        fontFamily: DEFAULT_LABEL_STYLE.fontFamily,
        fontSize: `${DEFAULT_LABEL_STYLE.fontSize}px`,
        color: DEFAULT_LABEL_STYLE.color
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(LABEL_DEPTH);
    const iconImage = this.add
      .image(0, 0, '__MISSING')
      .setVisible(false)
      .setDepth(ICON_DEPTH);

    const created = { backgroundMask, backgroundImage, labelText, iconImage };
    this.visualStates.set(areaId, created);
    return created;
  }

  private cleanup(areas: readonly MapArea[]): void {
    const validIds = new Set(areas.map((area) => area.id));
    for (const [areaId, visuals] of this.visualStates.entries()) {
      if (validIds.has(areaId)) {
        continue;
      }

      visuals.backgroundImage.destroy();
      visuals.backgroundMask.destroy();
      visuals.labelText.destroy();
      visuals.iconImage.destroy();
      this.visualStates.delete(areaId);
    }
  }

  private drawShapeFill(graphics: Phaser.GameObjects.Graphics, shape: AreaShape): void {
    if (shape.type === 'rect') {
      graphics.fillRect(shape.x, shape.y, shape.width, shape.height);
      return;
    }

    if (shape.type === 'ellipse') {
      graphics.fillEllipse(shape.x, shape.y, shape.radiusX * 2, shape.radiusY * 2);
      return;
    }

    graphics.beginPath();
    graphics.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i += 1) {
      graphics.lineTo(shape.points[i].x, shape.points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  private resolveLabel(area: MapArea): AreaLabelPresentation | undefined {
    const text = area.presentation?.label?.text ?? area.label;
    const label = area.presentation?.label;
    if (!text && !label?.offset && !label?.style) {
      return undefined;
    }

    return {
      ...label,
      text
    };
  }

  private resolveIcon(area: MapArea): AreaIconPresentation | undefined {
    const path = area.presentation?.icon?.path ?? area.iconPath;
    const icon = area.presentation?.icon;
    if (!path) {
      return undefined;
    }

    return {
      ...icon,
      path
    };
  }

  private ensureTexture(kind: 'background' | 'icon', path: string): string | null {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return null;
    }

    const key = this.getTextureKey(kind, trimmedPath);
    if (this.scene.textures.exists(key) || this.pendingTextures.has(key) || this.failedTextures.has(key)) {
      return key;
    }

    this.pendingTextures.add(key);
    const image = new Image();
    const resolvedUrl = this.resolveAssetUrl(kind, trimmedPath);
    image.onload = () => {
      this.pendingTextures.delete(key);
      if (!this.scene.textures.exists(key)) {
        this.scene.textures.addImage(key, image);
      }
      this.requestRedraw();
    };
    image.onerror = () => {
      this.pendingTextures.delete(key);
      this.failedTextures.add(key);
      this.requestRedraw();
    };
    image.src = resolvedUrl;

    return key;
  }

  private getTextureKey(kind: 'background' | 'icon', path: string): string {
    return `area-presentation:${kind}:${path}`;
  }

  private parseHexColor(value: string, fallback: number): number {
    const trimmed = value.trim();
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hexMatch) {
      return fallback;
    }

    const expanded = hexMatch[1].length === 3
      ? `#${hexMatch[1].split('').map((ch) => `${ch}${ch}`).join('')}`
      : normalized;
    return Phaser.Display.Color.HexStringToColor(expanded).color;
  }
}

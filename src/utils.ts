import Phaser from 'phaser';
import type {
  AreaBackgroundPresentation,
  AreaIconPresentation,
  AreaLabelPresentation,
  AreaOffset,
  AreaPresentation,
  AreaShape,
  EllipseShape,
  MapArea,
  MapData,
  Point,
  PolygonShape,
  RectShape
} from './types';

export function clonePoint(p: Point): Point {
  return { x: p.x, y: p.y };
}

export function cloneOffset(offset: AreaOffset): AreaOffset {
  return { x: offset.x, y: offset.y };
}

export function cloneShape(shape: AreaShape): AreaShape {
  if (shape.type === 'rect') {
    return { ...shape };
  }
  if (shape.type === 'ellipse') {
    return { ...shape };
  }
  return {
    type: 'polygon',
    points: shape.points.map(clonePoint)
  };
}

export function cloneArea(area: MapArea): MapArea {
  return {
    ...area,
    shape: cloneShape(area.shape),
    presentation: clonePresentation(area.presentation)
  };
}

export function createEmptyMapData(): MapData {
  return {
    id: 'new_map',
    title: 'New Map',
    imagePath: '',
    wrapX: false,
    mapWidth: 1920,
    mapHeight: 1080,
    areas: []
  };
}

export function normalizeRectFromPoints(a: Point, b: Point): RectShape {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);
  return { type: 'rect', x, y, width, height };
}

export function ellipseFromBounds(a: Point, b: Point): EllipseShape {
  const rect = normalizeRectFromPoints(a, b);
  return {
    type: 'ellipse',
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    radiusX: rect.width / 2,
    radiusY: rect.height / 2
  };
}

export function shapeContainsPoint(shape: AreaShape, point: Point): boolean {
  if (shape.type === 'rect') {
    const rect = new Phaser.Geom.Rectangle(shape.x, shape.y, shape.width, shape.height);
    return Phaser.Geom.Rectangle.Contains(rect, point.x, point.y);
  }

  if (shape.type === 'ellipse') {
    const ellipse = new Phaser.Geom.Ellipse(shape.x, shape.y, shape.radiusX * 2, shape.radiusY * 2);
    return Phaser.Geom.Ellipse.Contains(ellipse, point.x, point.y);
  }

  const polygon = new Phaser.Geom.Polygon(shape.points);
  return Phaser.Geom.Polygon.Contains(polygon, point.x, point.y);
}

export function translateShape(shape: AreaShape, dx: number, dy: number): AreaShape {
  if (shape.type === 'rect') {
    return { ...shape, x: shape.x + dx, y: shape.y + dy };
  }
  if (shape.type === 'ellipse') {
    return { ...shape, x: shape.x + dx, y: shape.y + dy };
  }
  return {
    type: 'polygon',
    points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
  };
}

export function getAreaCenter(area: MapArea): Point {
  const s = area.shape;
  if (s.type === 'rect') {
    return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  }
  if (s.type === 'ellipse') {
    return { x: s.x, y: s.y };
  }
  return polygonCentroid(s);
}

export function polygonCentroid(shape: PolygonShape): Point {
  if (shape.points.length === 0) {
    return { x: 0, y: 0 };
  }
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < shape.points.length; i += 1) {
    const p0 = shape.points[i];
    const p1 = shape.points[(i + 1) % shape.points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    signedArea += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 0.0001) {
    const avgX = shape.points.reduce((sum, p) => sum + p.x, 0) / shape.points.length;
    const avgY = shape.points.reduce((sum, p) => sum + p.y, 0) / shape.points.length;
    return { x: avgX, y: avgY };
  }
  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea)
  };
}

export function polygonArea(shape: PolygonShape): number {
  let area = 0;
  for (let i = 0; i < shape.points.length; i += 1) {
    const p0 = shape.points[i];
    const p1 = shape.points[(i + 1) % shape.points.length];
    area += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(area) / 2;
}

export function sanitizeMapData(raw: unknown): MapData {
  const data = raw as Partial<MapData>;
  return {
    id: typeof data.id === 'string' ? data.id : 'new_map',
    title: typeof data.title === 'string' ? data.title : 'New Map',
    imagePath: typeof data.imagePath === 'string' ? data.imagePath : '',
    wrapX: Boolean(data.wrapX),
    mapWidth: typeof data.mapWidth === 'number' ? data.mapWidth : 1920,
    mapHeight: typeof data.mapHeight === 'number' ? data.mapHeight : 1080,
    areas: Array.isArray(data.areas)
      ? data.areas.filter(Boolean).map((area: any) => ({
          id: typeof area.id === 'string' ? area.id : 'area',
          label: typeof area.label === 'string' ? area.label : '',
          iconPath: typeof area.iconPath === 'string' ? area.iconPath : '',
          shape: sanitizeShape(area.shape),
          presentation: sanitizePresentation(area.presentation)
        }))
      : []
  };
}

export function clonePresentation(presentation: AreaPresentation | undefined): AreaPresentation | undefined {
  if (!presentation) {
    return undefined;
  }

  return {
    label: cloneLabelPresentation(presentation.label),
    background: cloneBackgroundPresentation(presentation.background),
    icon: cloneIconPresentation(presentation.icon)
  };
}

function cloneLabelPresentation(label: AreaLabelPresentation | undefined): AreaLabelPresentation | undefined {
  if (!label) {
    return undefined;
  }

  return {
    text: label.text,
    offset: label.offset ? cloneOffset(label.offset) : undefined,
    style: label.style ? { ...label.style } : undefined
  };
}

function cloneBackgroundPresentation(
  background: AreaBackgroundPresentation | undefined
): AreaBackgroundPresentation | undefined {
  if (!background) {
    return undefined;
  }

  return {
    color: background.color ? { ...background.color } : undefined,
    image: background.image ? { ...background.image } : undefined
  };
}

function cloneIconPresentation(icon: AreaIconPresentation | undefined): AreaIconPresentation | undefined {
  if (!icon) {
    return undefined;
  }

  return {
    path: icon.path,
    offset: icon.offset ? cloneOffset(icon.offset) : undefined,
    width: icon.width,
    height: icon.height
  };
}

function sanitizePresentation(raw: unknown): AreaPresentation | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const presentation = raw as Record<string, unknown>;
  const label = sanitizeLabelPresentation(presentation.label);
  const background = sanitizeBackgroundPresentation(presentation.background);
  const icon = sanitizeIconPresentation(presentation.icon);

  if (!label && !background && !icon) {
    return undefined;
  }

  return { label, background, icon };
}

function sanitizeLabelPresentation(raw: unknown): AreaLabelPresentation | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const label = raw as Record<string, unknown>;
  const text = typeof label.text === 'string' ? label.text : undefined;
  const offset = sanitizeOffset(label.offset);
  const style = sanitizeLabelStyle(label.style);

  if (text === undefined && !offset && !style) {
    return undefined;
  }

  return { text, offset, style };
}

function sanitizeLabelStyle(raw: unknown): AreaLabelPresentation['style'] | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const style = raw as Record<string, unknown>;
  const fontStyle = typeof style.fontStyle === 'string' ? style.fontStyle : undefined;
  const sanitized: AreaLabelPresentation['style'] = {
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : undefined,
    fontSize: num(style.fontSize, NaN),
    color: typeof style.color === 'string' ? style.color : undefined,
    fontStyle:
      fontStyle === 'normal' || fontStyle === 'bold' || fontStyle === 'italic' || fontStyle === 'bold italic'
        ? fontStyle
        : undefined,
    stroke: typeof style.stroke === 'string' ? style.stroke : undefined,
    strokeThickness: num(style.strokeThickness, NaN)
  };

  if (Number.isNaN(sanitized.fontSize as number)) {
    delete sanitized.fontSize;
  }
  if (Number.isNaN(sanitized.strokeThickness as number)) {
    delete sanitized.strokeThickness;
  }

  if (
    sanitized.fontFamily === undefined &&
    sanitized.fontSize === undefined &&
    sanitized.color === undefined &&
    sanitized.fontStyle === undefined &&
    sanitized.stroke === undefined &&
    sanitized.strokeThickness === undefined
  ) {
    return undefined;
  }

  return sanitized;
}

function sanitizeBackgroundPresentation(raw: unknown): AreaBackgroundPresentation | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const background = raw as Record<string, unknown>;
  const color = sanitizeBackgroundColor(background.color);
  const image = sanitizeBackgroundImage(background.image);

  if (!color && !image) {
    return undefined;
  }

  return { color, image };
}

function sanitizeBackgroundColor(raw: unknown): AreaBackgroundPresentation['color'] | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const color = raw as Record<string, unknown>;
  const value = typeof color.value === 'string' ? color.value : '';
  if (!value) {
    return undefined;
  }

  return {
    value,
    opacity: clampOpacity(color.opacity)
  };
}

function sanitizeBackgroundImage(raw: unknown): AreaBackgroundPresentation['image'] | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const image = raw as Record<string, unknown>;
  const path = typeof image.path === 'string' ? image.path : '';
  if (!path) {
    return undefined;
  }

  return {
    path,
    opacity: clampOpacity(image.opacity)
  };
}

function sanitizeIconPresentation(raw: unknown): AreaIconPresentation | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const icon = raw as Record<string, unknown>;
  const path = typeof icon.path === 'string' ? icon.path : '';
  if (!path) {
    return undefined;
  }

  return {
    path,
    offset: sanitizeOffset(icon.offset),
    width: positiveNum(icon.width),
    height: positiveNum(icon.height)
  };
}

function sanitizeOffset(raw: unknown): AreaOffset | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const offset = raw as Record<string, unknown>;
  return {
    x: num(offset.x),
    y: num(offset.y)
  };
}

function sanitizeShape(shape: any): AreaShape {
  if (!shape || typeof shape.type !== 'string') {
    return { type: 'rect', x: 0, y: 0, width: 32, height: 32 };
  }
  if (shape.type === 'ellipse') {
    return {
      type: 'ellipse',
      x: num(shape.x),
      y: num(shape.y),
      radiusX: Math.max(1, num(shape.radiusX, 16)),
      radiusY: Math.max(1, num(shape.radiusY, 16))
    };
  }
  if (shape.type === 'polygon') {
    const points = Array.isArray(shape.points)
      ? shape.points.map((p: any) => ({ x: num(p.x), y: num(p.y) }))
      : [];
    return {
      type: 'polygon',
      points: points.length >= 3 ? points : [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 30 }]
    };
  }
  return {
    type: 'rect',
    x: num(shape.x),
    y: num(shape.y),
    width: Math.max(1, num(shape.width, 32)),
    height: Math.max(1, num(shape.height, 32))
  };
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveNum(value: unknown): number | undefined {
  const parsed = num(value, NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function clampOpacity(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Phaser.Math.Clamp(value, 0, 1);
}

export function formatJson(mapData: MapData): string {
  return JSON.stringify(mapData, null, 2);
}

export function uniqueAreaId(baseId: string, existing: readonly MapArea[]): string {
  const cleanBase = baseId.trim() || 'area';
  const ids = new Set(existing.map((a) => a.id));
  if (!ids.has(cleanBase)) {
    return cleanBase;
  }
  if (!ids.has(`${cleanBase}_copy`)) {
    return `${cleanBase}_copy`;
  }
  let i = 2;
  while (ids.has(`${cleanBase}_copy${i}`)) {
    i += 1;
  }
  return `${cleanBase}_copy${i}`;
}

export function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

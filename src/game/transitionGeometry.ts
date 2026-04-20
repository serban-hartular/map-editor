import type { MapArea, Point } from '../types';
import { getAreaCenter } from '../utils';

const DEFAULT_DIRECTION: Point = { x: 0, y: 1 };

export function mapPointFromAreaToMap(
  sourceArea: MapArea,
  sourcePosition: Point,
  targetMapSize: { width: number; height: number },
  padding = 24
): Point {
  const sourceCenter = getAreaCenter(sourceArea);
  const direction = getDirection(sourceCenter, sourcePosition);
  const targetCenter = { x: targetMapSize.width / 2, y: targetMapSize.height / 2 };
  return projectDirectionToRectangle(targetCenter, direction, targetMapSize.width, targetMapSize.height, -padding);
}

export function mapPointFromMapToArea(
  sourceMapSize: { width: number; height: number },
  sourcePosition: Point,
  targetArea: MapArea,
  padding = 16
): Point {
  const sourceCenter = { x: sourceMapSize.width / 2, y: sourceMapSize.height / 2 };
  const direction = getDirection(sourceCenter, sourcePosition);
  return projectDirectionToArea(targetArea, direction, padding);
}

function getDirection(center: Point, point: Point): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.0001) {
    return { ...DEFAULT_DIRECTION };
  }
  return {
    x: dx / length,
    y: dy / length
  };
}

function projectDirectionToRectangle(
  center: Point,
  direction: Point,
  width: number,
  height: number,
  offset = 0
): Point {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const tx = Math.abs(direction.x) < 0.0001 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(direction.x);
  const ty = Math.abs(direction.y) < 0.0001 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(direction.y);
  const distance = Math.min(tx, ty);
  return {
    x: center.x + direction.x * (distance + offset),
    y: center.y + direction.y * (distance + offset)
  };
}

function projectDirectionToArea(area: MapArea, direction: Point, offset = 0): Point {
  const center = getAreaCenter(area);
  const distance = getBoundaryDistance(area, center, direction);
  return {
    x: center.x + direction.x * (distance + offset),
    y: center.y + direction.y * (distance + offset)
  };
}

function getBoundaryDistance(area: MapArea, center: Point, direction: Point): number {
  const shape = area.shape;
  if (shape.type === 'rect') {
    const halfWidth = shape.width / 2;
    const halfHeight = shape.height / 2;
    const tx = Math.abs(direction.x) < 0.0001 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(direction.x);
    const ty = Math.abs(direction.y) < 0.0001 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(direction.y);
    return Math.min(tx, ty);
  }

  if (shape.type === 'ellipse') {
    const denom =
      (direction.x * direction.x) / (shape.radiusX * shape.radiusX) +
      (direction.y * direction.y) / (shape.radiusY * shape.radiusY);
    if (denom <= 0.000001) {
      return 0;
    }
    return 1 / Math.sqrt(denom);
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < shape.points.length; i += 1) {
    const start = shape.points[i];
    const end = shape.points[(i + 1) % shape.points.length];
    const hit = raySegmentDistance(center, direction, start, end);
    if (hit !== null && hit < bestDistance) {
      bestDistance = hit;
    }
  }

  return Number.isFinite(bestDistance) ? bestDistance : 0;
}

function raySegmentDistance(origin: Point, direction: Point, start: Point, end: Point): number | null {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const denom = cross(direction, segment);
  if (Math.abs(denom) < 0.000001) {
    return null;
  }

  const relative = { x: start.x - origin.x, y: start.y - origin.y };
  const t = cross(relative, segment) / denom;
  const u = cross(relative, direction) / denom;
  if (t < 0 || u < 0 || u > 1) {
    return null;
  }
  return t;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

import Phaser from 'phaser';
import type { EllipseHandle, HandleHit, MapArea, Point, RectHandle } from '../types';
import { distanceSquared, shapeContainsPoint } from '../utils';

export function hitTestAreas(areas: readonly MapArea[], world: Point): MapArea | null {
  for (let i = areas.length - 1; i >= 0; i -= 1) {
    const area = areas[i];
    if (shapeContainsPoint(area.shape, world)) {
      return area;
    }
  }
  return null;
}

export function getHandleHit(
  area: MapArea,
  p : {x : number, y : number},
  //pointer: Phaser.Input.Pointer,
  camera: Phaser.Cameras.Scene2D.Camera,
  handleRadiusPx: number
): HandleHit | null {
  //const p = { x: pointer.x, y: pointer.y };
  if (area.shape.type === 'rect') {
    const handles: [RectHandle, Point][] = [
      ['tl', { x: area.shape.x, y: area.shape.y }],
      ['tr', { x: area.shape.x + area.shape.width, y: area.shape.y }],
      ['bl', { x: area.shape.x, y: area.shape.y + area.shape.height }],
      ['br', { x: area.shape.x + area.shape.width, y: area.shape.y + area.shape.height }]
    ];
    for (const [handle, worldPoint] of handles) {
      //if (isNearScreenPoint(worldPoint, p, camera, handleRadiusPx + 2)) {
      if (isNearWorldPointByDistance(worldPoint, p, camera, handleRadiusPx + 2)) {
        return { type: 'rect', handle };
      }
    }
    return null;
  }

  if (area.shape.type === 'ellipse') {
    const handles: [EllipseHandle, Point][] = [
      ['top', { x: area.shape.x, y: area.shape.y - area.shape.radiusY }],
      ['bottom', { x: area.shape.x, y: area.shape.y + area.shape.radiusY }],
      ['left', { x: area.shape.x - area.shape.radiusX, y: area.shape.y }],
      ['right', { x: area.shape.x + area.shape.radiusX, y: area.shape.y }]
    ];
    for (const [handle, worldPoint] of handles) {
      //if (isNearScreenPoint(worldPoint, p, camera, handleRadiusPx + 2)) {
      if (isNearWorldPointByDistance(worldPoint, p, camera, handleRadiusPx + 2)) {
        return { type: 'ellipse', handle };
      }
    }
    return null;
  }

  for (let i = 0; i < area.shape.points.length; i += 1) {
    //if (isNearScreenPoint(area.shape.points[i], p, camera, handleRadiusPx + 2)) {
    if (isNearWorldPointByDistance(area.shape.points[i], p, camera, handleRadiusPx + 2)) {
      return { type: 'polygon', vertexIndex: i };
    }
  }
  return null;
}

export function isNearScreenPoint(
  worldPoint: Point,
  screenPoint: Point,
  camera: Phaser.Cameras.Scene2D.Camera,
  tolerancePx: number
): boolean {
  const screen = {
    x: (worldPoint.x - camera.scrollX) * camera.zoom,
    y: (worldPoint.y - camera.scrollY) * camera.zoom
  };
  return distanceSquared(screen, screenPoint) <= tolerancePx * tolerancePx;
}

export function isNearWorldPoint(
  worldPoint: Point,
  pointer: Phaser.Input.Pointer,
  camera: Phaser.Cameras.Scene2D.Camera,
  tolerancePx: number
): boolean {
  return isNearScreenPoint(worldPoint, { x: pointer.x, y: pointer.y }, camera, tolerancePx);
}

export function getWorldPoint(pointer: Phaser.Input.Pointer, camera: Phaser.Cameras.Scene2D.Camera): Point {
  const worldPoint = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
  return { x: worldPoint.x, y: worldPoint.y };
}

export function isNearWorldPointByDistance(
  a: Point,
  b: Point,
  camera: Phaser.Cameras.Scene2D.Camera,
  tolerancePx: number
): boolean {
  const toleranceWorld = tolerancePx / camera.zoom;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  
  return dx * dx + dy * dy <= toleranceWorld * toleranceWorld;
}

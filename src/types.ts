export interface Point {
  x: number;
  y: number;
}

export interface RectShape {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseShape {
  type: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

export interface PolygonShape {
  type: 'polygon';
  points: Point[];
}

export type AreaShape = RectShape | EllipseShape | PolygonShape;

export interface MapArea {
  id: string;
  label: string;
  iconPath: string;
  shape: AreaShape;
}

export interface MapData {
  id: string;
  title: string;
  imagePath: string;
  wrapX: boolean;
  mapWidth: number;
  mapHeight: number;
  areas: MapArea[];
}

export type ToolMode = 'select' | 'drawRect' | 'drawEllipse' | 'drawPolygon' | 'pan';

export type RectHandle = 'tl' | 'tr' | 'bl' | 'br';
export type EllipseHandle = 'top' | 'bottom' | 'left' | 'right';

export type HandleHit =
  | { type: 'rect'; handle: RectHandle }
  | { type: 'ellipse'; handle: EllipseHandle }
  | { type: 'polygon'; vertexIndex: number };

export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'drawingRect'; start: Point; current: Point }
  | { kind: 'drawingEllipse'; start: Point; current: Point }
  | { kind: 'drawingPolygon'; points: Point[]; hover: Point | null }
  | { kind: 'movingShape'; areaId: string; pointerStart: Point; originalShape: AreaShape }
  | { kind: 'resizingRect'; areaId: string; handle: RectHandle; originalShape: RectShape }
  | { kind: 'resizingEllipse'; areaId: string; handle: EllipseHandle; originalShape: EllipseShape }
  | { kind: 'movingPolygonVertex'; areaId: string; vertexIndex: number; originalShape: PolygonShape }
  | { kind: 'panning'; pointerStart: Point; scrollStartX: number; scrollStartY: number };

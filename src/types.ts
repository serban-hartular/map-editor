export interface Point {
  x: number;
  y: number;
}

export interface AreaOffset {
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

export interface AreaLabelStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  stroke?: string;
  strokeThickness?: number;
}

export interface AreaLabelPresentation {
  text?: string;
  offset?: AreaOffset;
  style?: AreaLabelStyle;
}

export interface AreaBackgroundColorPresentation {
  value: string;
  opacity?: number;
}

export interface AreaBackgroundImagePresentation {
  path: string;
  opacity?: number;
}

export interface AreaBackgroundPresentation {
  color?: AreaBackgroundColorPresentation;
  image?: AreaBackgroundImagePresentation;
}

export interface AreaIconPresentation {
  path: string;
  offset?: AreaOffset;
  width?: number;
  height?: number;
}

export interface AreaPresentation {
  label?: AreaLabelPresentation;
  background?: AreaBackgroundPresentation;
  icon?: AreaIconPresentation;
}

export interface MapArea {
  id: string;
  label: string;
  iconPath: string;
  shape: AreaShape;
  presentation?: AreaPresentation;
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

export type PresentationTarget = 'label' | 'icon';

export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'drawingRect'; start: Point; current: Point }
  | { kind: 'drawingEllipse'; start: Point; current: Point }
  | { kind: 'drawingPolygon'; points: Point[]; hover: Point | null }
  | { kind: 'movingShape'; areaId: string; pointerStart: Point; originalShape: AreaShape }
  | { kind: 'movingPresentation'; areaId: string; target: PresentationTarget; pointerStart: Point; originalOffset: AreaOffset }
  | { kind: 'resizingRect'; areaId: string; handle: RectHandle; originalShape: RectShape }
  | { kind: 'resizingEllipse'; areaId: string; handle: EllipseHandle; originalShape: EllipseShape }
  | { kind: 'movingPolygonVertex'; areaId: string; vertexIndex: number; originalShape: PolygonShape }
  | { kind: 'panning'; pointerStart: Point; scrollStartX: number; scrollStartY: number };

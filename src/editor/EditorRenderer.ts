import Phaser from 'phaser';
import type { EllipseShape, MapArea, Point, RectShape } from '../types';
import { normalizeRectFromPoints, ellipseFromBounds } from '../utils';
import { AreaPresentationRenderer } from '../area/AreaPresentationRenderer';

interface RendererOptions {
  overlay: Phaser.GameObjects.Graphics;
  cameras: { main: Phaser.Cameras.Scene2D.Camera };
  handleRadiusPx: number;
  presentationRenderer: AreaPresentationRenderer;
}

export class EditorRenderer {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly cameras: { main: Phaser.Cameras.Scene2D.Camera };
  private readonly handleRadiusPx: number;
  private readonly presentationRenderer: AreaPresentationRenderer;

  constructor(options: RendererOptions) {
    this.overlay = options.overlay;
    this.cameras = options.cameras;
    this.handleRadiusPx = options.handleRadiusPx;
    this.presentationRenderer = options.presentationRenderer;
  }

  redraw(
    areas: readonly MapArea[],
    selectedArea: MapArea | null,
    interactionState: { kind: string; start?: Point; current?: Point; points?: Point[]; hover?: Point | null }
  ): void {
    this.overlay.clear();
    this.presentationRenderer.redraw(areas);

    for (const area of areas) {
      this.drawArea(area, selectedArea?.id === area.id);
    }

    if (interactionState.kind === 'drawingRect' && interactionState.start && interactionState.current) {
      this.drawPreviewRect(normalizeRectFromPoints(interactionState.start, interactionState.current));
    } else if (interactionState.kind === 'drawingEllipse' && interactionState.start && interactionState.current) {
      this.drawPreviewEllipse(ellipseFromBounds(interactionState.start, interactionState.current));
    } else if (interactionState.kind === 'drawingPolygon' && interactionState.points) {
      this.drawPolygonPreview(interactionState.points, interactionState.hover ?? null);
    }
  }

  private drawArea(area: MapArea, selected: boolean): void {
    const lineColor = selected ? 0x44d0ff : 0x8ec5ff;
    this.overlay.lineStyle(selected ? 3 : 2, lineColor, 1);

    if (area.shape.type === 'rect') {
      this.overlay.strokeRect(area.shape.x, area.shape.y, area.shape.width, area.shape.height);
      if (selected) {
        const points = [
          { x: area.shape.x, y: area.shape.y },
          { x: area.shape.x + area.shape.width, y: area.shape.y },
          { x: area.shape.x, y: area.shape.y + area.shape.height },
          { x: area.shape.x + area.shape.width, y: area.shape.y + area.shape.height }
        ];
        points.forEach((p) => this.drawHandle(p));
      }
    } else if (area.shape.type === 'ellipse') {
      this.overlay.strokeEllipse(area.shape.x, area.shape.y, area.shape.radiusX * 2, area.shape.radiusY * 2);
      if (selected) {
        [
          { x: area.shape.x, y: area.shape.y - area.shape.radiusY },
          { x: area.shape.x, y: area.shape.y + area.shape.radiusY },
          { x: area.shape.x - area.shape.radiusX, y: area.shape.y },
          { x: area.shape.x + area.shape.radiusX, y: area.shape.y }
        ].forEach((p) => this.drawHandle(p));
      }
    } else {
      this.overlay.beginPath();
      this.overlay.moveTo(area.shape.points[0].x, area.shape.points[0].y);
      for (let i = 1; i < area.shape.points.length; i += 1) {
        this.overlay.lineTo(area.shape.points[i].x, area.shape.points[i].y);
      }
      this.overlay.closePath();
      this.overlay.strokePath();
      if (selected) {
        area.shape.points.forEach((p) => this.drawHandle(p));
      }
    }

  }

  private drawHandle(point: Point): void {
    const worldRadius = this.handleRadiusPx / this.cameras.main.zoom;
    this.overlay.fillStyle(0xffffff, 1);
    this.overlay.lineStyle(2 / this.cameras.main.zoom, 0x1d2433, 1);
    this.overlay.fillCircle(point.x, point.y, worldRadius);
    this.overlay.strokeCircle(point.x, point.y, worldRadius);
  }

  private drawPreviewRect(rect: RectShape): void {
    this.overlay.lineStyle(2, 0xffd166, 1);
    this.overlay.fillStyle(0xffd166, 0.18);
    this.overlay.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.overlay.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private drawPreviewEllipse(shape: EllipseShape): void {
    this.overlay.lineStyle(2, 0xffd166, 1);
    this.overlay.fillStyle(0xffd166, 0.18);
    this.overlay.fillEllipse(shape.x, shape.y, shape.radiusX * 2, shape.radiusY * 2);
    this.overlay.strokeEllipse(shape.x, shape.y, shape.radiusX * 2, shape.radiusY * 2);
  }

  private drawPolygonPreview(points: Point[], hover: Point | null): void {
    if (points.length === 0) return;
    this.overlay.lineStyle(2, 0xffd166, 1);
    this.overlay.fillStyle(0xffd166, 0.12);
    this.overlay.beginPath();
    this.overlay.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      this.overlay.lineTo(points[i].x, points[i].y);
    }
    if (hover) {
      this.overlay.lineTo(hover.x, hover.y);
    }
    this.overlay.strokePath();
    points.forEach((p, index) => {
      const color = index === 0 ? 0x00ff99 : 0xffffff;
      const r = this.handleRadiusPx / this.cameras.main.zoom;
      this.overlay.fillStyle(color, 1);
      this.overlay.fillCircle(p.x, p.y, r);
    });
  }

}

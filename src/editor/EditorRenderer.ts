import Phaser from 'phaser';
import type { EllipseShape, MapArea, Point, RectShape } from '../types';
import { getAreaCenter, normalizeRectFromPoints, ellipseFromBounds } from '../utils';

interface RendererOptions {
  overlay: Phaser.GameObjects.Graphics;
  cameras: { main: Phaser.Cameras.Scene2D.Camera };
  add: Phaser.GameObjects.GameObjectFactory;
  iconImages: Map<string, Phaser.GameObjects.Image>;
  labelTexts: Map<string, Phaser.GameObjects.Text>;
  handleRadiusPx: number;
  ensureIcon: (area: MapArea) => void;
}

export class EditorRenderer {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly cameras: { main: Phaser.Cameras.Scene2D.Camera };
  private readonly add: Phaser.GameObjects.GameObjectFactory;
  private readonly iconImages: Map<string, Phaser.GameObjects.Image>;
  private readonly labelTexts: Map<string, Phaser.GameObjects.Text>;
  private readonly handleRadiusPx: number;
  private readonly ensureIcon: (area: MapArea) => void;

  constructor(options: RendererOptions) {
    this.overlay = options.overlay;
    this.cameras = options.cameras;
    this.add = options.add;
    this.iconImages = options.iconImages;
    this.labelTexts = options.labelTexts;
    this.handleRadiusPx = options.handleRadiusPx;
    this.ensureIcon = options.ensureIcon;
  }

  redraw(
    areas: readonly MapArea[],
    selectedArea: MapArea | null,
    interactionState: { kind: string; start?: Point; current?: Point; points?: Point[]; hover?: Point | null }
  ): void {
    this.overlay.clear();
    this.cleanupTransientDisplayObjects(areas);

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
    const fillColor = selected ? 0x44d0ff : 0x5b8cff;
    this.overlay.lineStyle(selected ? 3 : 2, lineColor, 1);
    this.overlay.fillStyle(fillColor, selected ? 0.24 : 0.16);

    if (area.shape.type === 'rect') {
      this.overlay.fillRect(area.shape.x, area.shape.y, area.shape.width, area.shape.height);
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
      this.overlay.fillEllipse(area.shape.x, area.shape.y, area.shape.radiusX * 2, area.shape.radiusY * 2);
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
      this.overlay.fillPath();
      this.overlay.strokePath();
      if (selected) {
        area.shape.points.forEach((p) => this.drawHandle(p));
      }
    }

    const center = getAreaCenter(area);
    let label = this.labelTexts.get(area.id);
    if (!label) {
      label = this.add.text(center.x, center.y - 4, '', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { left: 4, right: 4, top: 2, bottom: 2 }
      }).setOrigin(0.5).setDepth(500);
      this.labelTexts.set(area.id, label);
    }
    label.setPosition(center.x, center.y - 14);
    label.setText(area.label);
    label.setVisible(Boolean(area.label));

    this.ensureIcon(area);
    const icon = this.iconImages.get(area.id);
    if (icon) {
      icon.setPosition(center.x, center.y);
      icon.setVisible(Boolean(area.iconPath));
      icon.setDepth(400);
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

  private cleanupTransientDisplayObjects(areas: readonly MapArea[]): void {
    const validIds = new Set(areas.map((a) => a.id));
    for (const [id, img] of this.iconImages.entries()) {
      if (!validIds.has(id)) {
        img.destroy();
        this.iconImages.delete(id);
      }
    }
    for (const [id, label] of this.labelTexts.entries()) {
      if (!validIds.has(id)) {
        label.destroy();
        this.labelTexts.delete(id);
      }
    }
  }
}

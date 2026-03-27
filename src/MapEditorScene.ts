import Phaser from 'phaser';
import type {
  EllipseShape,
  InteractionState,
  MapArea,
  MapData,
  Point,
  PolygonShape,
  RectHandle,
  RectShape,
  ToolMode
} from './types';
import {
  cloneArea,
  cloneShape,
  createEmptyMapData,
  ellipseFromBounds,
  polygonArea,
  sanitizeMapData,
  translateShape,
  uniqueAreaId,
  normalizeRectFromPoints
} from './utils';
import {
  CLOSE_POLYGON_TOLERANCE_PX,
  HANDLE_RADIUS_PX,
  ICON_PREFIX,
  MAP_TEXTURE_KEY,
  MIN_ELLIPSE_RADIUS,
  MIN_RECT_SIZE
} from './editor/constants';
import {
  bindEditorDomEvents,
  getEditorDomRefs,
  refreshMapMetadataUI,
  refreshSelectionUI,
  setStatus,
  updateToolButtons,
  type EditorDomRefs
} from './editor/EditorDom';
import { EditorRenderer } from './editor/EditorRenderer';
import { EditorFileManager } from './editor/EditorFileManager';
import { getHandleHit, getWorldPoint, hitTestAreas, isNearWorldPoint, isNearWorldPointByDistance } from './editor/EditorHitTest';

export class MapEditorScene extends Phaser.Scene {
  private mapData: MapData = createEmptyMapData();
  private selectedAreaId: string | null = null;
  private toolMode: ToolMode = 'select';
  private interactionState: InteractionState = { kind: 'idle' };
  private mapSprite!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private dom!: EditorDomRefs;
  private editorRenderer!: EditorRenderer;
  private fileManager!: EditorFileManager;
  private iconImages = new Map<string, Phaser.GameObjects.Image>();
  private labelTexts = new Map<string, Phaser.GameObjects.Text>();
  private imageObjectUrl: string | null = null;
  private iconObjectUrls = new Map<string, string>();

  constructor() {
    super('MapEditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1d2433');
    this.mapSprite = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.overlay = this.add.graphics();
    this.hudText = this.add
      .text(12, 12, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { left: 8, right: 8, top: 4, bottom: 4 }
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.editorRenderer = new EditorRenderer({
      overlay: this.overlay,
      cameras: this.cameras,
      add: this.add,
      iconImages: this.iconImages,
      labelTexts: this.labelTexts,
      handleRadiusPx: HANDLE_RADIUS_PX,
      ensureIcon: (area) => this.ensureIcon(area)
    });

    this.fileManager = new EditorFileManager({
      scene: this,
      mapTextureKey: MAP_TEXTURE_KEY,
      mapSprite: this.mapSprite,
      getImageObjectUrl: () => this.imageObjectUrl,
      setImageObjectUrl: (url) => {
        this.imageObjectUrl = url;
      }
    });

    this.initializeDom();
    this.registerInput();
    this.refreshMapMetadataUI();
    this.updateToolButtons();
    this.refreshSelectionUI();
    this.fitMapToView();
    this.redraw();

    this.scale.on('resize', () => {
      this.redraw();
    });
  }

  update(): void {
    const cam = this.cameras.main;
    this.hudText.setText([
      `Tool: ${this.toolMode}`,
      `Zoom: ${cam.zoom.toFixed(2)}`,
      `Map: ${this.mapData.mapWidth} x ${this.mapData.mapHeight}`,
      `Areas: ${this.mapData.areas.length}`
    ]);

    if (this.interactionState.kind === 'drawingPolygon') {
      this.interactionState.hover = this.getWorldPoint(this.input.activePointer);
      this.redraw();
    }
  }

  private initializeDom(): void {
    this.dom = getEditorDomRefs();

    bindEditorDomEvents(this.dom, {
      onMapIdInput: () => {
        this.mapData.id = this.dom.mapIdInput.value;
        this.setStatus('Updated map id.');
      },
      onMapTitleInput: () => {
        this.mapData.title = this.dom.mapTitleInput.value;
      },
      onImagePathInput: () => {
        this.mapData.imagePath = this.dom.imagePathInput.value;
        this.refreshIconImages();
      },
      onWrapXChange: () => {
        this.mapData.wrapX = this.dom.wrapXInput.checked;
      },
      onAreaIdInput: () => {
        const area = this.getSelectedArea();
        if (!area) return;
        area.id = this.dom.areaIdInput.value;
        this.selectedAreaId = area.id;
        this.refreshSelectionUI();
      },
      onAreaLabelInput: () => {
        const area = this.getSelectedArea();
        if (!area) return;
        area.label = this.dom.areaLabelInput.value;
        this.redraw();
      },
      onAreaIconPathInput: () => {
        const area = this.getSelectedArea();
        if (!area) return;
        area.iconPath = this.dom.areaIconPathInput.value;
        this.refreshIconImages();
        this.redraw();
      },
      onAreaCoordsChange: () => {
        const area = this.getSelectedArea();
        if (!area) return;
        try {
          const parsed = JSON.parse(this.dom.areaCoordsText.value);
          area.shape = parsed;
          this.redraw();
          this.refreshSelectionUI();
          this.setStatus('Updated shape coordinates from text.');
        } catch {
          this.refreshSelectionUI();
          this.setStatus('Could not parse coordinates JSON.');
        }
      },
      onToolSelect: () => this.setToolMode('select'),
      onToolRect: () => this.setToolMode('drawRect'),
      onToolEllipse: () => this.setToolMode('drawEllipse'),
      onToolPolygon: () => this.setToolMode('drawPolygon'),
      onToolPan: () => this.setToolMode('pan'),
      onFitView: () => this.fitMapToView(),
      onDuplicate: () => this.duplicateSelectedArea(),
      onDelete: () => this.deleteSelectedArea(),
      onSaveJson: () => this.saveJson(),
      onLoadImage: () => void this.loadImageFromFile(),
      onLoadJson: () => void this.loadJsonFromFile(),
      onDeleteKey: () => this.deleteSelectedArea(),
      onEscapeKey: () => {
        if (this.interactionState.kind === 'drawingPolygon') {
          this.interactionState = { kind: 'idle' };
          this.setStatus('Polygon drawing cancelled.');
          this.redraw();
        }
      },
      onDuplicateKey: () => this.duplicateSelectedArea()
    });
  }

  private registerInput(): void {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const factor = dy > 0 ? 0.9 : 1.1;
      cam.zoom = Phaser.Math.Clamp(cam.zoom * factor, 0.2, 6);
      this.redraw();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown() || this.toolMode === 'pan' || pointer.middleButtonDown()) {
      this.interactionState = {
        kind: 'panning',
        pointerStart: { x: pointer.x, y: pointer.y },
        scrollStartX: this.cameras.main.scrollX,
        scrollStartY: this.cameras.main.scrollY
      };
      return;
    }

    const world = this.getWorldPoint(pointer);

    if (this.toolMode === 'drawRect') {
      this.interactionState = { kind: 'drawingRect', start: world, current: world };
      return;
    }
    if (this.toolMode === 'drawEllipse') {
      this.interactionState = { kind: 'drawingEllipse', start: world, current: world };
      return;
    }
    if (this.toolMode === 'drawPolygon') {
      this.handlePolygonClick(world, pointer);
      return;
    }

    const selected = this.getSelectedArea();
    //const handleHit = selected ? getHandleHit(selected, pointer, this.cameras.main, HANDLE_RADIUS_PX) : null;
    const worldP = getWorldPoint(pointer, this.cameras.main);
    const handleHit = selected ? getHandleHit(selected, worldP, this.cameras.main, HANDLE_RADIUS_PX) : null;
    
    if (selected && handleHit) {
      if (handleHit.type === 'rect' && selected.shape.type === 'rect') {
        this.interactionState = {
          kind: 'resizingRect',
          areaId: selected.id,
          handle: handleHit.handle,
          originalShape: cloneShape(selected.shape) as RectShape
        };
        return;
      }
      if (handleHit.type === 'ellipse' && selected.shape.type === 'ellipse') {
        this.interactionState = {
          kind: 'resizingEllipse',
          areaId: selected.id,
          handle: handleHit.handle,
          originalShape: cloneShape(selected.shape) as EllipseShape
        };
        return;
      }
      if (handleHit.type === 'polygon' && selected.shape.type === 'polygon') {
        this.interactionState = {
          kind: 'movingPolygonVertex',
          areaId: selected.id,
          vertexIndex: handleHit.vertexIndex,
          originalShape: cloneShape(selected.shape) as PolygonShape
        };
        return;
      }
    }

    const hitArea = hitTestAreas(this.mapData.areas, world);
    if (hitArea) {
      this.selectedAreaId = hitArea.id;
      this.interactionState = {
        kind: 'movingShape',
        areaId: hitArea.id,
        pointerStart: world,
        originalShape: cloneShape(hitArea.shape)
      };
      this.refreshSelectionUI();
      this.redraw();
      return;
    }

    this.selectedAreaId = null;
    this.refreshSelectionUI();
    this.redraw();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const world = this.getWorldPoint(pointer);

    switch (this.interactionState.kind) {
      case 'drawingRect':
      case 'drawingEllipse':
        this.interactionState.current = world;
        this.redraw();
        break;
      case 'movingShape': {
        const area = this.findAreaById(this.interactionState.areaId);
        if (!area) return;
        const dx = world.x - this.interactionState.pointerStart.x;
        const dy = world.y - this.interactionState.pointerStart.y;
        area.shape = translateShape(this.interactionState.originalShape, dx, dy);
        this.refreshSelectionUI(false);
        this.redraw();
        break;
      }
      case 'resizingRect': {
        const area = this.findAreaById(this.interactionState.areaId);
        if (!area || area.shape.type !== 'rect') return;
        area.shape = this.resizeRect(this.interactionState.originalShape, this.interactionState.handle, world);
        this.refreshSelectionUI(false);
        this.redraw();
        break;
      }
      case 'resizingEllipse': {
        const area = this.findAreaById(this.interactionState.areaId);
        if (!area || area.shape.type !== 'ellipse') return;
        area.shape = this.resizeEllipse(this.interactionState.originalShape, this.interactionState.handle, world);
        this.refreshSelectionUI(false);
        this.redraw();
        break;
      }
      case 'movingPolygonVertex': {
        const area = this.findAreaById(this.interactionState.areaId);
        if (!area || area.shape.type !== 'polygon') return;
        const points = this.interactionState.originalShape.points.map((p) => ({ ...p }));
        points[this.interactionState.vertexIndex] = world;
        area.shape = { type: 'polygon', points };
        this.refreshSelectionUI(false);
        this.redraw();
        break;
      }
      case 'panning': {
        const cam = this.cameras.main;
        cam.scrollX = this.interactionState.scrollStartX - (pointer.x - this.interactionState.pointerStart.x) / cam.zoom;
        cam.scrollY = this.interactionState.scrollStartY - (pointer.y - this.interactionState.pointerStart.y) / cam.zoom;
        this.redraw();
        break;
      }
      default:
        break;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const world = this.getWorldPoint(pointer);

    switch (this.interactionState.kind) {
      case 'drawingRect': {
        const rect = normalizeRectFromPoints(this.interactionState.start, world);
        if (rect.width >= MIN_RECT_SIZE && rect.height >= MIN_RECT_SIZE) {
          this.addArea({
            id: this.nextAreaId('rect'),
            label: '',
            iconPath: '',
            shape: rect
          });
          this.setToolMode('select');
        } else {
          this.setStatus('Rectangle was too small and was discarded.');
        }
        break;
      }
      case 'drawingEllipse': {
        const shape = ellipseFromBounds(this.interactionState.start, world);
        if (shape.radiusX >= MIN_ELLIPSE_RADIUS && shape.radiusY >= MIN_ELLIPSE_RADIUS) {
          this.addArea({
            id: this.nextAreaId('ellipse'),
            label: '',
            iconPath: '',
            shape
          });
          this.setToolMode('select');
        } else {
          this.setStatus('Ellipse was too small and was discarded.');
        }
        break;
      }
      default:
        break;
    }

    if (this.interactionState.kind !== 'drawingPolygon') {
      this.interactionState = { kind: 'idle' };
    }
    this.redraw();
  }

  private handlePolygonClick(world: Point, pointer: Phaser.Input.Pointer): void {
    if (this.interactionState.kind !== 'drawingPolygon') {
      this.interactionState = { kind: 'drawingPolygon', points: [world], hover: world };
      this.redraw();
      return;
    }

    const points = [...this.interactionState.points];
    const closeTolerancePx = Math.max(CLOSE_POLYGON_TOLERANCE_PX, HANDLE_RADIUS_PX + 4);

    if (
      points.length >= 3 &&
      isNearWorldPointByDistance(points[0], world, this.cameras.main, closeTolerancePx)
    ) {      const poly: PolygonShape = { type: 'polygon', points };
      if (polygonArea(poly) > 1) {
        this.addArea({
          id: this.nextAreaId('polygon'),
          label: '',
          iconPath: '',
          shape: poly
        });
        this.interactionState = { kind: 'idle' };
        this.setToolMode('select');
      } else {
        this.setStatus('Polygon area was too small.');
      }
      return;
    }

    points.push(world);
    this.interactionState = { kind: 'drawingPolygon', points, hover: world };
    this.redraw();
  }

  private resizeRect(shape: RectShape, handle: RectHandle, world: Point): RectShape {
    const left = shape.x;
    const right = shape.x + shape.width;
    const top = shape.y;
    const bottom = shape.y + shape.height;

    let anchor: Point;
    switch (handle) {
      case 'tl': anchor = { x: right, y: bottom }; break;
      case 'tr': anchor = { x: left, y: bottom }; break;
      case 'bl': anchor = { x: right, y: top }; break;
      case 'br': anchor = { x: left, y: top }; break;
    }

    const rect = normalizeRectFromPoints(anchor, world);
    return {
      type: 'rect',
      x: rect.x,
      y: rect.y,
      width: Math.max(MIN_RECT_SIZE, rect.width),
      height: Math.max(MIN_RECT_SIZE, rect.height)
    };
  }

  private resizeEllipse(shape: EllipseShape, handle: 'top' | 'bottom' | 'left' | 'right', world: Point): EllipseShape {
    if (handle === 'left' || handle === 'right') {
      return {
        ...shape,
        radiusX: Math.max(MIN_ELLIPSE_RADIUS, Math.abs(world.x - shape.x))
      };
    }
    return {
      ...shape,
      radiusY: Math.max(MIN_ELLIPSE_RADIUS, Math.abs(world.y - shape.y))
    };
  }

  private getWorldPoint(pointer: Phaser.Input.Pointer): Point {
    return getWorldPoint(pointer, this.cameras.main);
  }

  private addArea(area: MapArea): void {
    this.mapData.areas.push(area);
    this.selectedAreaId = area.id;
    this.refreshSelectionUI();
    this.redraw();
    this.setStatus(`Added area ${area.id}.`);
  }

  private nextAreaId(prefix: string): string {
    return uniqueAreaId(prefix, this.mapData.areas);
  }

  private findAreaById(id: string): MapArea | undefined {
    return this.mapData.areas.find((area) => area.id === id);
  }

  private getSelectedArea(): MapArea | null {
    if (!this.selectedAreaId) return null;
    return this.findAreaById(this.selectedAreaId) ?? null;
  }

  private refreshSelectionUI(updateText = true): void {
    refreshSelectionUI(this.dom, this.getSelectedArea(), updateText);
  }

  private refreshMapMetadataUI(): void {
    refreshMapMetadataUI(this.dom, this.mapData);
  }

  private setToolMode(mode: ToolMode): void {
    this.toolMode = mode;
    this.interactionState = { kind: 'idle' };
    this.updateToolButtons();
    this.redraw();
  }

  private updateToolButtons(): void {
    updateToolButtons(this.dom, this.toolMode);
  }

  private deleteSelectedArea(): void {
    if (!this.selectedAreaId) return;
    const before = this.mapData.areas.length;
    this.mapData.areas = this.mapData.areas.filter((a) => a.id !== this.selectedAreaId);
    if (this.mapData.areas.length !== before) {
      this.setStatus(`Deleted area ${this.selectedAreaId}.`);
    }
    this.selectedAreaId = null;
    this.refreshSelectionUI();
    this.redraw();
  }

  private duplicateSelectedArea(): void {
    const area = this.getSelectedArea();
    if (!area) return;
    const copy = cloneArea(area);
    copy.id = uniqueAreaId(area.id, this.mapData.areas);
    copy.shape = translateShape(copy.shape, 16, 16);
    this.mapData.areas.push(copy);
    this.selectedAreaId = copy.id;
    this.refreshSelectionUI();
    this.redraw();
    this.setStatus(`Duplicated area as ${copy.id}.`);
  }

  private saveJson(): void {
    this.fileManager.saveJson(this.mapData, this.dom.saveFilenameInput.value);
    this.setStatus('Saved JSON.');
  }

  private async loadJsonFromFile(): Promise<void> {
    const file = this.dom.jsonFileInput.files?.[0];
    if (!file) return;
    this.mapData = await this.fileManager.loadJsonFromFile(file);
    this.selectedAreaId = null;
    this.refreshMapMetadataUI();
    this.refreshSelectionUI();
    this.refreshIconImages();
    this.redraw();
    this.setStatus(`Loaded JSON from ${file.name}.`);
  }

  private async loadImageFromFile(): Promise<void> {
    const file = this.dom.imageFileInput.files?.[0];
    if (!file) return;

    const size = await this.fileManager.loadImageFromFile(file);
    this.mapData.imagePath = this.mapData.imagePath || size.imagePath;
    this.mapData.mapWidth = size.width;
    this.mapData.mapHeight = size.height;
    this.refreshMapMetadataUI();
    this.fitMapToView();
    this.redraw();
    this.setStatus(`Loaded image ${file.name}.`);
  }

  private fitMapToView(): void {
    const container = document.getElementById('game-container');
    if (!container) return;
    const width = Math.max(100, container.clientWidth);
    const height = Math.max(100, container.clientHeight);
    const zoomX = width / this.mapData.mapWidth;
    const zoomY = height / this.mapData.mapHeight;
    const zoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), 0.05, 4);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.mapData.mapWidth / 2, this.mapData.mapHeight / 2);
    this.redraw();
  }

  private redraw(): void {
    this.editorRenderer.redraw(this.mapData.areas, this.getSelectedArea(), this.interactionState);
  }

  private refreshIconImages(): void {
    for (const area of this.mapData.areas) {
      this.ensureIcon(area);
    }
    this.redraw();
  }

  private ensureIcon(area: MapArea): void {
    let img = this.iconImages.get(area.id);
    if (!img) {
      img = this.add.image(0, 0, '__MISSING').setVisible(false);
      this.iconImages.set(area.id, img);
    }
    if (!area.iconPath) {
      img.setVisible(false);
      return;
    }

    const key = `${ICON_PREFIX}${area.id}`;
    if (this.textures.exists(key)) {
      img.setTexture(key).setDisplaySize(32, 32).setVisible(true);
      return;
    }

    img.setVisible(false);
  }

  private setStatus(text: string): void {
    setStatus(this.dom, text);
  }

  public importMapData(raw: unknown): void {
    this.mapData = sanitizeMapData(raw);
    this.selectedAreaId = null;
    this.refreshMapMetadataUI();
    this.refreshSelectionUI();
    this.redraw();
  }
}

import Phaser from 'phaser';
import type {
  AreaPresentation,
  AreaOffset,
  EllipseShape,
  InteractionState,
  MapArea,
  MapData,
  Point,
  PresentationTarget,
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
import { AreaPresentationRenderer } from './area/AreaPresentationRenderer';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR_OPACITY,
  DEFAULT_BACKGROUND_IMAGE_OPACITY,
  DEFAULT_ICON_SIZE,
  DEFAULT_LABEL_STYLE,
  getDefaultIconOffset,
  getDefaultLabelOffset
} from './area/presentationDefaults';

export class MapEditorScene extends Phaser.Scene {
  private static readonly DEFAULT_MAP_IMAGE_BASE_PATH = '/maps/';
  private static readonly DEFAULT_ICON_BASE_PATH = '/icons/';
  private static readonly DEFAULT_BACKGROUND_IMAGE_BASE_PATH = '/backgrounds/';

  private mapData: MapData = createEmptyMapData();
  private selectedAreaId: string | null = null;
  private toolMode: ToolMode = 'select';
  private interactionState: InteractionState = { kind: 'idle' };
  private mapSprite!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private dom!: EditorDomRefs;
  private editorRenderer!: EditorRenderer;
  private presentationRenderer!: AreaPresentationRenderer;
  private fileManager!: EditorFileManager;
  private imageObjectUrl: string | null = null;
  private iconObjectUrls = new Map<string, string>();
  private backgroundImageObjectUrls = new Map<string, string>();
  private currentImageFileName = '';

  constructor() {
    super('MapEditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1d2433');
    this.mapSprite = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.overlay = this.add.graphics();
    this.overlay.setDepth(200);
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

    this.presentationRenderer = new AreaPresentationRenderer({
      scene: this,
      add: this.add,
      requestRedraw: () => this.redraw(),
      resolveAssetUrl: (kind, path) => this.resolvePresentationAssetUrl(kind, path)
    });

    this.editorRenderer = new EditorRenderer({
      overlay: this.overlay,
      cameras: this.cameras,
      handleRadiusPx: HANDLE_RADIUS_PX,
      presentationRenderer: this.presentationRenderer
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
      onNew: () => this.newMap(),
      onMapImagePathChange: (value) => {
        this.mapData.imagePath = this.composeAssetPath(value, this.currentImageFileName);
      },
      onMapIdInput: () => {
        this.mapData.id = this.dom.mapIdInput.value;
        this.setStatus('Updated map id.');
      },
      onMapTitleInput: () => {
        this.mapData.title = this.dom.mapTitleInput.value;
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
        this.updateSelectedAreaPresentationFromInputs();
      },
      onAreaIconChooseClick: () => {
        this.dom.areaIconFileInput.click();
      },
      onAreaIconFileChange: () => {
        void this.loadSelectedAreaIconFromFile();
      },
      onAreaIconDeleteClick: () => {
        this.deleteSelectedAreaIcon();
      },
      onAreaIconBasePathInput: () => {
        this.updateSelectedAreaIconBasePath();
      },
      onAreaBackgroundImageChooseClick: () => {
        this.dom.areaBackgroundImageFileInput.click();
      },
      onAreaBackgroundImageFileChange: () => {
        void this.loadSelectedAreaBackgroundImageFromFile();
      },
      onAreaBackgroundImageDeleteClick: () => {
        this.deleteSelectedAreaBackgroundImage();
      },
      onAreaBackgroundImageBasePathInput: () => {
        this.updateSelectedAreaBackgroundImageBasePath();
      },
      onAreaPresentationInput: () => {
        this.updateSelectedAreaPresentationFromInputs();
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
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gos: unknown, _dx: number, dy: number) => {
      if (!pointer.event.ctrlKey) {
        return;
      }

      pointer.event.preventDefault();
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

    const presentationHit = this.presentationRenderer.hitTest(this.mapData.areas, world);
    if (presentationHit) {
      const area = this.findAreaById(presentationHit.areaId);
      if (!area) {
        return;
      }

      this.selectedAreaId = area.id;
      this.interactionState = {
        kind: 'movingPresentation',
        areaId: area.id,
        target: presentationHit.target,
        pointerStart: world,
        originalOffset: this.getEffectivePresentationOffset(area, presentationHit.target)
      };
      this.refreshSelectionUI(false);
      this.redraw();
      return;
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
      case 'movingPresentation': {
        const area = this.findAreaById(this.interactionState.areaId);
        if (!area) return;
        const dx = world.x - this.interactionState.pointerStart.x;
        const dy = world.y - this.interactionState.pointerStart.y;
        this.applyPresentationOffsetToInputs(this.interactionState.target, {
          x: this.interactionState.originalOffset.x + dx,
          y: this.interactionState.originalOffset.y + dy
        });
        this.updateSelectedAreaPresentationFromInputs();
        this.refreshSelectionUI(false);
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

  private updateSelectedAreaPresentationFromInputs(): void {
    const area = this.getSelectedArea();
    if (!area) {
      return;
    }

    area.label = this.dom.areaLabelInput.value.trim();
    area.iconPath = this.getSelectedAreaIconPath();
    area.presentation = this.buildPresentationFromInputs(
      area.label,
      area.iconPath,
      this.getSelectedAreaBackgroundImagePath()
    );
    this.redraw();
  }

  private async loadSelectedAreaIconFromFile(): Promise<void> {
    const area = this.getSelectedArea();
    const file = this.dom.areaIconFileInput.files?.[0];
    if (!area || !file) {
      return;
    }

    const oldPath = area.presentation?.icon?.path ?? area.iconPath;
    const nextPath = this.composeAssetPath(this.dom.areaIconBasePathInput.value, file.name);
    const objectUrl = URL.createObjectURL(file);

    if (oldPath) {
      this.revokeIconObjectUrl(oldPath);
      this.presentationRenderer.invalidateTexture('icon', oldPath);
    }

    this.revokeIconObjectUrl(nextPath);
    this.iconObjectUrls.set(nextPath, objectUrl);
    this.presentationRenderer.invalidateTexture('icon', nextPath);

    area.iconPath = nextPath;
    this.updateSelectedAreaPresentationFromInputs();
    this.refreshSelectionUI(false);
    this.setStatus(`Loaded icon ${file.name}.`);
  }

  private updateSelectedAreaIconBasePath(): void {
    const area = this.getSelectedArea();
    if (!area) {
      return;
    }

    const currentPath = this.getSelectedAreaIconPath();
    const { fileName } = this.splitAssetPath(currentPath, MapEditorScene.DEFAULT_ICON_BASE_PATH);
    if (!fileName) {
      this.refreshSelectionUI(false);
      return;
    }

    const nextPath = this.composeAssetPath(this.dom.areaIconBasePathInput.value, fileName);
    if (nextPath === currentPath) {
      return;
    }

    const objectUrl = this.iconObjectUrls.get(currentPath);
    if (objectUrl) {
      this.iconObjectUrls.delete(currentPath);
      this.iconObjectUrls.set(nextPath, objectUrl);
      this.presentationRenderer.invalidateTexture('icon', currentPath);
      this.presentationRenderer.invalidateTexture('icon', nextPath);
    }

    area.iconPath = nextPath;
    this.updateSelectedAreaPresentationFromInputs();
    this.refreshSelectionUI(false);
  }

  private deleteSelectedAreaIcon(): void {
    const area = this.getSelectedArea();
    if (!area) {
      return;
    }

    const currentPath = area.presentation?.icon?.path ?? area.iconPath;
    if (currentPath) {
      this.revokeIconObjectUrl(currentPath);
      this.presentationRenderer.invalidateTexture('icon', currentPath);
    }

    area.iconPath = '';
    this.dom.areaIconFileInput.value = '';
    this.updateSelectedAreaPresentationFromInputs();
    this.refreshSelectionUI(false);
    this.setStatus('Deleted icon.');
  }

  private async loadSelectedAreaBackgroundImageFromFile(): Promise<void> {
    const area = this.getSelectedArea();
    const file = this.dom.areaBackgroundImageFileInput.files?.[0];
    if (!area || !file) {
      return;
    }

    const oldPath = area.presentation?.background?.image?.path ?? '';
    const nextPath = this.composeAssetPath(this.dom.areaBackgroundImageBasePathInput.value, file.name);
    const objectUrl = URL.createObjectURL(file);

    if (oldPath) {
      this.revokeBackgroundImageObjectUrl(oldPath);
      this.presentationRenderer.invalidateTexture('background', oldPath);
    }

    this.revokeBackgroundImageObjectUrl(nextPath);
    this.backgroundImageObjectUrls.set(nextPath, objectUrl);
    this.presentationRenderer.invalidateTexture('background', nextPath);

    area.presentation = this.buildPresentationFromInputs(area.label, area.iconPath, nextPath);
    this.refreshSelectionUI(false);
    this.redraw();
    this.setStatus(`Loaded background image ${file.name}.`);
  }

  private updateSelectedAreaBackgroundImageBasePath(): void {
    const area = this.getSelectedArea();
    if (!area) {
      return;
    }

    const currentPath = area.presentation?.background?.image?.path ?? '';
    const { fileName } = this.splitAssetPath(currentPath, MapEditorScene.DEFAULT_BACKGROUND_IMAGE_BASE_PATH);
    if (!fileName) {
      this.refreshSelectionUI(false);
      return;
    }

    const nextPath = this.composeAssetPath(this.dom.areaBackgroundImageBasePathInput.value, fileName);
    if (nextPath === currentPath) {
      return;
    }

    const objectUrl = this.backgroundImageObjectUrls.get(currentPath);
    if (objectUrl) {
      this.backgroundImageObjectUrls.delete(currentPath);
      this.backgroundImageObjectUrls.set(nextPath, objectUrl);
      this.presentationRenderer.invalidateTexture('background', currentPath);
      this.presentationRenderer.invalidateTexture('background', nextPath);
    }

    area.presentation = this.buildPresentationFromInputs(area.label, area.iconPath, nextPath);
    this.refreshSelectionUI(false);
    this.redraw();
  }

  private deleteSelectedAreaBackgroundImage(): void {
    const area = this.getSelectedArea();
    if (!area) {
      return;
    }

    const currentPath = area.presentation?.background?.image?.path ?? '';
    if (currentPath) {
      this.revokeBackgroundImageObjectUrl(currentPath);
      this.presentationRenderer.invalidateTexture('background', currentPath);
    }

    this.dom.areaBackgroundImageFileInput.value = '';
    area.presentation = this.buildPresentationFromInputs(area.label, area.iconPath, undefined);
    this.refreshSelectionUI(false);
    this.redraw();
    this.setStatus('Deleted background image.');
  }

  private getSelectedAreaIconPath(): string {
    const selectedArea = this.getSelectedArea();
    if (!selectedArea) {
      return '';
    }

    const currentPath = selectedArea.presentation?.icon?.path ?? selectedArea.iconPath;
    const currentFileName = this.splitAssetPath(currentPath, MapEditorScene.DEFAULT_ICON_BASE_PATH).fileName;
    return this.composeAssetPath(this.dom.areaIconBasePathInput.value, currentFileName);
  }

  private getSelectedAreaBackgroundImagePath(): string | undefined {
    const selectedArea = this.getSelectedArea();
    if (!selectedArea) {
      return undefined;
    }

    const currentPath = selectedArea.presentation?.background?.image?.path ?? '';
    const currentFileName = this.splitAssetPath(
      currentPath,
      MapEditorScene.DEFAULT_BACKGROUND_IMAGE_BASE_PATH
    ).fileName;
    const nextPath = this.composeAssetPath(this.dom.areaBackgroundImageBasePathInput.value, currentFileName);
    return nextPath || undefined;
  }

  private getEffectivePresentationOffset(area: MapArea, target: PresentationTarget): AreaOffset {
    if (target === 'label') {
      const labelPath = area.presentation?.icon?.path ?? area.iconPath;
      return area.presentation?.label?.offset ?? getDefaultLabelOffset(Boolean(labelPath.trim()));
    }

    const labelText = area.presentation?.label?.text ?? area.label;
    return area.presentation?.icon?.offset ?? getDefaultIconOffset(Boolean(labelText.trim()));
  }

  private applyPresentationOffsetToInputs(target: PresentationTarget, offset: AreaOffset): void {
    if (target === 'label') {
      this.dom.areaLabelOffsetXInput.value = String(offset.x);
      this.dom.areaLabelOffsetYInput.value = String(offset.y);
      return;
    }

    this.dom.areaIconOffsetXInput.value = String(offset.x);
    this.dom.areaIconOffsetYInput.value = String(offset.y);
  }

  private buildPresentationFromInputs(
    labelText: string,
    iconPath: string,
    backgroundImagePathOverride?: string
  ): AreaPresentation | undefined {
    const trimmedLabel = labelText.trim();
    const trimmedIconPath = iconPath.trim();
    const defaultLabelOffset = getDefaultLabelOffset(Boolean(trimmedIconPath));
    const defaultIconOffset = getDefaultIconOffset(Boolean(trimmedLabel));

    const labelOffsetX = this.readOptionalNumber(this.dom.areaLabelOffsetXInput.value);
    const labelOffsetY = this.readOptionalNumber(this.dom.areaLabelOffsetYInput.value);
    const labelOffset =
      labelOffsetX !== undefined || labelOffsetY !== undefined
        ? { x: labelOffsetX ?? defaultLabelOffset.x, y: labelOffsetY ?? defaultLabelOffset.y }
        : undefined;
    const normalizedLabelOffset =
      labelOffset && (labelOffset.x !== defaultLabelOffset.x || labelOffset.y !== defaultLabelOffset.y)
        ? labelOffset
        : undefined;

    const fontFamily = this.readOptionalText(this.dom.areaLabelFontFamilyInput.value, DEFAULT_LABEL_STYLE.fontFamily);
    const fontSize = this.readOptionalPositiveNumber(this.dom.areaLabelFontSizeInput.value, DEFAULT_LABEL_STYLE.fontSize);
    const fontColor = this.readOptionalColor(this.dom.areaLabelColorInput.value, DEFAULT_LABEL_STYLE.color);
    const fontStyle = this.readOptionalText(this.dom.areaLabelFontStyleInput.value) as
      | 'normal'
      | 'bold'
      | 'italic'
      | 'bold italic'
      | undefined;
    const normalizedFontStyle = fontStyle === DEFAULT_LABEL_STYLE.fontStyle ? undefined : fontStyle;
    const stroke = this.readOptionalColor(this.dom.areaLabelStrokeInput.value, DEFAULT_LABEL_STYLE.stroke);
    const strokeThickness = this.readOptionalNumber(
      this.dom.areaLabelStrokeThicknessInput.value,
      DEFAULT_LABEL_STYLE.strokeThickness
    );
    const labelStyle =
      fontFamily !== undefined ||
      fontSize !== undefined ||
      fontColor !== undefined ||
      normalizedFontStyle !== undefined ||
      stroke !== undefined ||
      strokeThickness !== undefined
        ? {
            fontFamily,
            fontSize,
            color: fontColor,
            fontStyle: normalizedFontStyle,
            stroke,
            strokeThickness
          }
        : undefined;

    const label =
      trimmedLabel || labelOffset || labelStyle
        ? {
            text: trimmedLabel || undefined,
            offset: normalizedLabelOffset,
            style: labelStyle
          }
        : undefined;

    const backgroundColorValue = this.readOptionalColor(this.dom.areaBackgroundColorInput.value, DEFAULT_BACKGROUND_COLOR);
    const backgroundColorOpacity = this.readOptionalOpacity(
      this.dom.areaBackgroundColorOpacityInput.value,
      DEFAULT_BACKGROUND_COLOR_OPACITY
    );
    const backgroundColor =
      backgroundColorOpacity !== undefined || backgroundColorValue !== undefined
        ? {
            value: backgroundColorValue ?? DEFAULT_BACKGROUND_COLOR,
            opacity: backgroundColorOpacity
          }
        : undefined;

    const backgroundImagePath = backgroundImagePathOverride;
    const backgroundImageOpacity = this.readOptionalOpacity(
      this.dom.areaBackgroundImageOpacityInput.value,
      DEFAULT_BACKGROUND_IMAGE_OPACITY
    );
    const backgroundImage = backgroundImagePath
      ? {
          path: backgroundImagePath,
          opacity: backgroundImageOpacity
        }
      : undefined;

    const background =
      backgroundColor || backgroundImage
        ? {
            color: backgroundColor,
            image: backgroundImage
          }
        : undefined;

    const iconOffsetX = this.readOptionalNumber(this.dom.areaIconOffsetXInput.value);
    const iconOffsetY = this.readOptionalNumber(this.dom.areaIconOffsetYInput.value);
    const iconOffset =
      iconOffsetX !== undefined || iconOffsetY !== undefined
        ? { x: iconOffsetX ?? defaultIconOffset.x, y: iconOffsetY ?? defaultIconOffset.y }
        : undefined;
    const normalizedIconOffset =
      iconOffset && (iconOffset.x !== defaultIconOffset.x || iconOffset.y !== defaultIconOffset.y)
        ? iconOffset
        : undefined;
    const iconWidth = this.readOptionalPositiveNumber(this.dom.areaIconWidthInput.value, DEFAULT_ICON_SIZE);
    const iconHeight = this.readOptionalPositiveNumber(this.dom.areaIconHeightInput.value, DEFAULT_ICON_SIZE);
    const icon =
      trimmedIconPath || normalizedIconOffset || iconWidth !== undefined || iconHeight !== undefined
        ? {
            path: trimmedIconPath,
            offset: normalizedIconOffset,
            width: iconWidth,
            height: iconHeight
          }
        : undefined;

    if (!label && !background && !icon) {
      return undefined;
    }

    return { label, background, icon };
  }

  private readOptionalText(value: string, defaultValue?: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed === defaultValue ? undefined : trimmed;
  }

  private readOptionalNumber(value: string, defaultValue?: number): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    return parsed === defaultValue ? undefined : parsed;
  }

  private readOptionalPositiveNumber(value: string, defaultValue?: number): number | undefined {
    const parsed = this.readOptionalNumber(value, defaultValue);
    return parsed !== undefined && parsed > 0 ? parsed : undefined;
  }

  private readOptionalOpacity(value: string, defaultValue?: number): number | undefined {
    const parsed = this.readOptionalNumber(value, defaultValue);
    if (parsed === undefined) {
      return undefined;
    }

    return Phaser.Math.Clamp(parsed, 0, 1);
  }

  private readOptionalColor(value: string, defaultColor: string): string | undefined {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === defaultColor) {
      return undefined;
    }

    return trimmed;
  }

  private refreshMapMetadataUI(): void {
    refreshMapMetadataUI(this.dom, this.mapData, this.getMapImageBasePath());
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

  private newMap(): void {
    this.mapData = createEmptyMapData();
    this.selectedAreaId = null;
    this.toolMode = 'select';
    this.interactionState = { kind: 'idle' };
    this.currentImageFileName = '';

    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }
    this.revokeAllIconObjectUrls();
    this.revokeAllBackgroundImageObjectUrls();

    this.mapSprite.setTexture('__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.mapSprite.setDisplaySize(this.mapData.mapWidth, this.mapData.mapHeight);

    this.refreshMapMetadataUI();
    this.refreshSelectionUI();
    this.updateToolButtons();
    this.fitMapToView();
    this.redraw();

    this.dom.imageFileInput.value = '';
    this.dom.jsonFileInput.value = '';

    this.setStatus('Started a new map.');
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
    this.currentImageFileName = this.splitAssetPath(this.mapData.imagePath).fileName;
    this.revokeAllIconObjectUrls();
    this.revokeAllBackgroundImageObjectUrls();

    this.refreshMapMetadataUI();
    this.refreshSelectionUI();

    if (this.mapData.imagePath) {
      await this.loadImageFromPath(this.mapData.imagePath);
    } else {
      this.clearLoadedImage();
    }

    this.fitMapToView();
    this.redraw();
    this.setStatus(`Loaded JSON from ${file.name}.`);
  }

  private async loadImageFromPath(path: string): Promise<void> {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }

    await this.loadMapTextureFromUrl(path);
  }

  private async loadMapTextureFromUrl(url: string): Promise<void> {
    const key = `map-path-${Date.now()}`;

    await new Promise<void>((resolve, reject) => {
      this.load.image(key, url);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load image: ${url}`)));
      this.load.start();
    });

    if (this.mapSprite.texture.key !== '__WHITE' && this.textures.exists(this.mapSprite.texture.key)) {
      const oldKey = this.mapSprite.texture.key;
      if (oldKey.startsWith('map-file-') || oldKey.startsWith('map-path-')) {
        this.textures.remove(oldKey);
      }
    }

    this.mapSprite.setTexture(key).setOrigin(0, 0).clearTint();

    const texture = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const width = texture.width;
    const height = texture.height;

    this.mapData.mapWidth = width;
    this.mapData.mapHeight = height;

    this.mapSprite.setDisplaySize(width, height);
    this.cameras.main.setBounds(0, 0, width, height);
  }

  private splitAssetPath(fullPath: string, fallbackBasePath = MapEditorScene.DEFAULT_MAP_IMAGE_BASE_PATH): { basePath: string; fileName: string } {
    const trimmed = fullPath.trim();
    if (!trimmed) {
      return { basePath: fallbackBasePath, fileName: '' };
    }

    const lastSlash = trimmed.lastIndexOf('/');
    if (lastSlash === -1) {
      return {
        basePath: this.normalizeAssetBasePath(fallbackBasePath),
        fileName: trimmed
      };
    }

    const basePath = trimmed.slice(0, lastSlash + 1) || fallbackBasePath;
    const fileName = trimmed.slice(lastSlash + 1);
    return {
      basePath: this.normalizeAssetBasePath(basePath),
      fileName
    };
  }

  private composeAssetPath(basePath: string, fileName: string): string {
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) {
      return '';
    }

    return `${this.normalizeAssetBasePath(basePath)}${trimmedFileName}`;
  }

  private normalizeAssetBasePath(basePath: string): string {
    const trimmed = basePath.trim();
    if (!trimmed) {
      return MapEditorScene.DEFAULT_MAP_IMAGE_BASE_PATH;
    }

    let normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (!normalized.endsWith('/')) {
      normalized = `${normalized}/`;
    }
    return normalized;
  }

  private getMapImageBasePath(): string {
    return this.splitAssetPath(this.mapData.imagePath).basePath;
  }

  private resolvePresentationAssetUrl(kind: 'background' | 'icon', path: string): string {
    if (kind === 'background') {
      return this.backgroundImageObjectUrls.get(path) ?? path;
    }

    if (kind === 'icon') {
      return this.iconObjectUrls.get(path) ?? path;
    }

    return path;
  }

  private revokeIconObjectUrl(path: string): void {
    const url = this.iconObjectUrls.get(path);
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
    this.iconObjectUrls.delete(path);
  }

  private revokeAllIconObjectUrls(): void {
    for (const url of this.iconObjectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.iconObjectUrls.clear();
  }

  private revokeBackgroundImageObjectUrl(path: string): void {
    const url = this.backgroundImageObjectUrls.get(path);
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
    this.backgroundImageObjectUrls.delete(path);
  }

  private revokeAllBackgroundImageObjectUrls(): void {
    for (const url of this.backgroundImageObjectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.backgroundImageObjectUrls.clear();
  }

  private clearLoadedImage(): void {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }

    const oldKey = this.mapSprite.texture.key;
    if (oldKey !== '__WHITE' && this.textures.exists(oldKey)) {
      if (oldKey.startsWith('map-file-') || oldKey.startsWith('map-path-')) {
        this.textures.remove(oldKey);
      }
    }

    this.mapSprite.setTexture('__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.mapSprite.setDisplaySize(this.mapData.mapWidth, this.mapData.mapHeight);
    this.cameras.main.setBounds(0, 0, this.mapData.mapWidth, this.mapData.mapHeight);
  }

  private async loadImageFromFile(): Promise<void> {
    const file = this.dom.imageFileInput.files?.[0];
    if (!file) return;

    this.currentImageFileName = file.name;
    this.mapData.imagePath = this.composeAssetPath(this.dom.mapImagePathInput.value, file.name);
    this.refreshMapMetadataUI();

    const { objectUrl } = await this.fileManager.loadImageFromFile(file);
    await this.loadMapTextureFromUrl(objectUrl);
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
    this.redraw();
  }

  private setStatus(text: string): void {
    setStatus(this.dom, text);
  }

  public importMapData(raw: unknown): void {
    this.mapData = sanitizeMapData(raw);
    this.selectedAreaId = null;
    this.currentImageFileName = this.splitAssetPath(this.mapData.imagePath).fileName;
    this.refreshMapMetadataUI();
    this.refreshSelectionUI();
    this.redraw();
  }
}

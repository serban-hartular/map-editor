import Phaser from 'phaser';
import type { AreaShape, MapArea, MapData, Point } from './types';
import { sanitizeMapData, shapeContainsPoint } from './utils';
import { AreaPresentationRenderer } from './area/AreaPresentationRenderer';
import {
  bindScenarioDomEvents,
  getScenarioDomRefs,
  refreshScenarioMetadataUI,
  refreshScenarioSelectionUI,
  setScenarioStatus,
  type ScenarioDomRefs
} from './scenario/ScenarioDom';
import { ScenarioFileManager } from './scenario/ScenarioFileManager';
import { cloneAreaScenario, createEmptyScenarioData, sanitizeScenarioData } from './scenario/utils';
import type { AreaScenario, ScenarioAction, ScenarioActionOperation, ScenarioData } from './scenario/types';

export class ScenarioEditorScene extends Phaser.Scene {
  private static readonly DEFAULT_MAP_JSON_PATH = '/maps/';

  private mapData: MapData = sanitizeMapData({});
  private scenarioData: ScenarioData = createEmptyScenarioData();
  private selectedAreaId: string | null = null;
  private mapSprite!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private dom!: ScenarioDomRefs;
  private fileManager = new ScenarioFileManager();
  private presentationRenderer!: AreaPresentationRenderer;
  private imageObjectUrl: string | null = null;

  constructor() {
    super('ScenarioEditorScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1d2433');
    this.mapSprite = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.overlay = this.add.graphics().setDepth(200);
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
      requestRedraw: () => this.redraw()
    });

    this.initializeDom();
    this.registerInput();
    this.refreshScenarioMetadataUI();
    this.refreshSelectionUI();
    this.fitMapToView();
    this.redraw();
  }

  update(): void {
    const cam = this.cameras.main;
    this.hudText.setText([
      `Zoom: ${cam.zoom.toFixed(2)}`,
      `Map: ${this.mapData.mapWidth} x ${this.mapData.mapHeight}`,
      `Areas: ${this.mapData.areas.length}`
    ]);
  }

  private initializeDom(): void {
    this.dom = getScenarioDomRefs();
    bindScenarioDomEvents(this.dom, {
      onMapJsonPathInput: () => {
        this.scenarioData.mapJsonPath = this.dom.mapJsonPathInput.value.trim();
      },
      onLoadMapJson: () => void this.loadMapJsonFromFile(),
      onLoadScenarioJson: () => void this.loadScenarioJsonFromFile(),
      onNewScenario: () => this.newScenario(),
      onSaveScenario: () => this.saveScenario(),
      onFitView: () => this.fitMapToView(),
      onAddAction: (kind) => this.addAction(kind),
      onUpdateAction: (kind, index, field, value) => this.updateAction(kind, index, field, value),
      onDeleteAction: (kind, index) => this.deleteAction(kind, index),
      onMessageChange: (kind, field, value) => this.updateMessage(kind, field, value),
      onAddPermission: () => this.addPermission(),
      onUpdatePermission: (index, field, value) => this.updatePermission(index, field, value),
      onDeletePermission: (index) => this.deletePermission(index),
      onAddQa: () => this.addQa(),
      onUpdateQa: (index, field, value) => this.updateQa(index, field, value),
      onDeleteQa: (index) => this.deleteQa(index)
    });
  }

  private registerInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const world = this.getWorldPoint(pointer);
    const hitArea = this.hitTestAreas(world);
    this.selectedAreaId = hitArea?.id ?? null;
    this.refreshSelectionUI();
    this.redraw();
  }

  private hitTestAreas(world: Point): MapArea | null {
    for (let i = this.mapData.areas.length - 1; i >= 0; i -= 1) {
      const area = this.mapData.areas[i];
      if (shapeContainsPoint(area.shape, world)) {
        return area;
      }
    }
    return null;
  }

  private getWorldPoint(pointer: Phaser.Input.Pointer): Point {
    const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { x: worldPoint.x, y: worldPoint.y };
  }

  private redraw(): void {
    this.presentationRenderer.redraw(this.mapData.areas);
    this.overlay.clear();

    for (const area of this.mapData.areas) {
      const selected = area.id === this.selectedAreaId;
      this.drawAreaOutline(area, selected);
    }
  }

  private drawAreaOutline(area: MapArea, selected: boolean): void {
    this.overlay.lineStyle(selected ? 4 : 2, selected ? 0xffd166 : 0x8ec5ff, 1);
    if (area.shape.type === 'rect') {
      this.overlay.strokeRect(area.shape.x, area.shape.y, area.shape.width, area.shape.height);
      return;
    }
    if (area.shape.type === 'ellipse') {
      this.overlay.strokeEllipse(area.shape.x, area.shape.y, area.shape.radiusX * 2, area.shape.radiusY * 2);
      return;
    }
    this.overlay.beginPath();
    this.overlay.moveTo(area.shape.points[0].x, area.shape.points[0].y);
    for (let i = 1; i < area.shape.points.length; i += 1) {
      this.overlay.lineTo(area.shape.points[i].x, area.shape.points[i].y);
    }
    this.overlay.closePath();
    this.overlay.strokePath();
  }

  private async loadMapJsonFromFile(): Promise<void> {
    const file = this.dom.mapJsonFileInput.files?.[0];
    if (!file) return;

    const text = await file.text();
    await this.applyLoadedMapData(sanitizeMapData(JSON.parse(text)));
    if (!this.scenarioData.mapJsonPath.trim()) {
      this.scenarioData.mapJsonPath = this.composeAssetPath(ScenarioEditorScene.DEFAULT_MAP_JSON_PATH, file.name);
    }
    this.setStatus(`Loaded map JSON from ${file.name}.`);
  }

  private async loadScenarioJsonFromFile(): Promise<void> {
    const file = this.dom.scenarioJsonFileInput.files?.[0];
    if (!file) return;

    this.scenarioData = await this.fileManager.loadJsonFromFile(file);
    this.selectedAreaId = null;
    if (this.scenarioData.mapJsonPath) {
      await this.loadMapJsonFromPath(this.scenarioData.mapJsonPath);
    } else {
      this.mapData = sanitizeMapData({});
      this.clearLoadedImage();
      this.refreshScenarioMetadataUI();
      this.refreshSelectionUI();
      this.redraw();
    }
    this.refreshScenarioMetadataUI();
    this.refreshSelectionUI();
    this.setStatus(`Loaded scenario JSON from ${file.name}.`);
  }

  private saveScenario(): void {
    if (this.mapData.id) {
      this.scenarioData.mapId = this.mapData.id;
    }
    this.scenarioData.mapJsonPath = this.dom.mapJsonPathInput.value.trim();
    this.scenarioData = sanitizeScenarioData(this.scenarioData);
    this.fileManager.saveJson(this.scenarioData, this.dom.saveFilenameInput.value);
    this.refreshScenarioMetadataUI();
    this.refreshSelectionUI();
    this.setStatus('Saved scenario JSON.');
  }

  private newScenario(): void {
    this.scenarioData = createEmptyScenarioData();
    this.scenarioData.mapJsonPath = this.dom.mapJsonPathInput.value.trim() || ScenarioEditorScene.DEFAULT_MAP_JSON_PATH;
    this.selectedAreaId = null;
    this.refreshScenarioMetadataUI();
    this.refreshSelectionUI();
    this.setStatus('Started a new scenario.');
  }

  private async loadImageFromPath(path: string): Promise<void> {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }

    const key = `scenario-map-${Date.now()}`;
    await new Promise<void>((resolve, reject) => {
      this.load.image(key, path);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load image: ${path}`)));
      this.load.start();
    });

    const oldKey = this.mapSprite.texture.key;
    if (oldKey !== '__WHITE' && this.textures.exists(oldKey) && oldKey.startsWith('scenario-map-')) {
      this.textures.remove(oldKey);
    }

    this.mapSprite.setTexture(key).setOrigin(0, 0).clearTint();
    const texture = this.textures.get(key).getSourceImage() as HTMLImageElement;
    this.mapData.mapWidth = texture.width;
    this.mapData.mapHeight = texture.height;
    this.mapSprite.setDisplaySize(texture.width, texture.height);
    this.cameras.main.setBounds(0, 0, texture.width, texture.height);
  }

  private async loadMapJsonFromPath(path: string): Promise<void> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load map JSON: ${path}`);
    }

    const parsed = await response.json();
    await this.applyLoadedMapData(sanitizeMapData(parsed));
  }

  private async applyLoadedMapData(mapData: MapData): Promise<void> {
    this.mapData = mapData;
    this.selectedAreaId = null;
    this.scenarioData.mapId = this.mapData.id;

    if (this.mapData.imagePath) {
      await this.loadImageFromPath(this.mapData.imagePath);
    } else {
      this.clearLoadedImage();
    }

    this.refreshScenarioMetadataUI();
    this.refreshSelectionUI();
    this.fitMapToView();
    this.redraw();
  }

  private clearLoadedImage(): void {
    this.mapSprite.setTexture('__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.mapSprite.setDisplaySize(this.mapData.mapWidth, this.mapData.mapHeight);
    this.cameras.main.setBounds(0, 0, this.mapData.mapWidth, this.mapData.mapHeight);
  }

  private fitMapToView(): void {
    const container = document.getElementById('game-container');
    if (!container) return;
    const width = Math.max(100, container.clientWidth);
    const height = Math.max(100, container.clientHeight);
    const zoomX = width / Math.max(1, this.mapData.mapWidth);
    const zoomY = height / Math.max(1, this.mapData.mapHeight);
    const zoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), 0.05, 2.5);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.mapData.mapWidth / 2, this.mapData.mapHeight / 2);
    this.redraw();
  }

  private composeAssetPath(basePath: string, fileName: string): string {
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) {
      return '';
    }

    const trimmedBase = basePath.trim() || '/';
    const normalizedBase = trimmedBase.startsWith('/') ? trimmedBase : `/${trimmedBase}`;
    return normalizedBase.endsWith('/') ? `${normalizedBase}${trimmedFileName}` : `${normalizedBase}/${trimmedFileName}`;
  }

  private refreshScenarioMetadataUI(): void {
    refreshScenarioMetadataUI(
      this.dom,
      this.scenarioData.mapJsonPath,
      this.scenarioData.mapId,
      Object.keys(this.scenarioData.areas).length,
      this.mapData.areas.length
    );
  }

  private refreshSelectionUI(): void {
    refreshScenarioSelectionUI(this.dom, this.getSelectedArea(), this.getSelectedAreaScenario());
  }

  private getSelectedArea(): MapArea | null {
    if (!this.selectedAreaId) return null;
    return this.mapData.areas.find((area) => area.id === this.selectedAreaId) ?? null;
  }

  private getSelectedAreaScenario(): AreaScenario | undefined {
    return this.selectedAreaId ? this.scenarioData.areas[this.selectedAreaId] : undefined;
  }

  private ensureSelectedAreaScenario(): AreaScenario | null {
    if (!this.selectedAreaId) return null;
    if (!this.scenarioData.areas[this.selectedAreaId]) {
      this.scenarioData.areas[this.selectedAreaId] = {};
      this.refreshScenarioMetadataUI();
    }
    return this.scenarioData.areas[this.selectedAreaId];
  }

  private addAction(kind: 'enter' | 'exit'): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const key = kind === 'enter' ? 'onEnterActions' : 'onExitActions';
    const actions: ScenarioAction[] = [...(areaScenario[key] ?? []), { operation: 'assign', what: '', qty: 0 }];
    areaScenario[key] = actions;
    this.refreshSelectionUI();
  }

  private updateAction(
    kind: 'enter' | 'exit',
    index: number,
    field: 'operation' | 'what' | 'qty',
    value: string
  ): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const key = kind === 'enter' ? 'onEnterActions' : 'onExitActions';
    const actions = [...(areaScenario[key] ?? [])];
    const action = actions[index];
    if (!action) return;
    if (field === 'qty') {
      action.qty = Number.isFinite(Number(value)) ? Number(value) : 0;
    } else if (field === 'operation') {
      action.operation = value as ScenarioActionOperation;
    } else {
      action.what = value;
    }
    areaScenario[key] = actions;
  }

  private deleteAction(kind: 'enter' | 'exit', index: number): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const key = kind === 'enter' ? 'onEnterActions' : 'onExitActions';
    const actions = [...(areaScenario[key] ?? [])];
    actions.splice(index, 1);
    areaScenario[key] = actions.length > 0 ? actions : undefined;
    this.refreshSelectionUI();
  }

  private updateMessage(kind: 'enter' | 'exit', field: 'text' | 'seconds', value: string): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const key = kind === 'enter' ? 'onEnterMessage' : 'onExitMessage';
    const current = cloneAreaScenario(areaScenario)[key] ?? { text: '' };
    if (field === 'text') {
      current.text = value;
    } else {
      current.seconds = value.trim() ? Number(value) : undefined;
    }
    areaScenario[key] = current.text || current.seconds !== undefined ? current : undefined;
  }

  private addPermission(): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.permissions ?? {});
    entries.push(['', '']);
    areaScenario.permissions = Object.fromEntries(entries);
    this.refreshSelectionUI();
  }

  private updatePermission(index: number, field: 'key' | 'value', value: string): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.permissions ?? {});
    const current = entries[index] ?? ['', ''];
    entries[index] = field === 'key' ? [value, current[1]] : [current[0], value];
    areaScenario.permissions = Object.fromEntries(entries.filter(([key]) => key.trim() || field === 'value'));
  }

  private deletePermission(index: number): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.permissions ?? {});
    entries.splice(index, 1);
    areaScenario.permissions = entries.length > 0 ? Object.fromEntries(entries) : undefined;
    this.refreshSelectionUI();
  }

  private addQa(): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.qa ?? {});
    entries.push(['', '']);
    areaScenario.qa = Object.fromEntries(entries);
    this.refreshSelectionUI();
  }

  private updateQa(index: number, field: 'question' | 'answer', value: string): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.qa ?? {});
    const current = entries[index] ?? ['', ''];
    entries[index] = field === 'question' ? [value, current[1]] : [current[0], value];
    areaScenario.qa = Object.fromEntries(entries.filter(([key]) => key.trim() || field === 'answer'));
  }

  private deleteQa(index: number): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const entries = Object.entries(areaScenario.qa ?? {});
    entries.splice(index, 1);
    areaScenario.qa = entries.length > 0 ? Object.fromEntries(entries) : undefined;
    this.refreshSelectionUI();
  }

  private setStatus(text: string): void {
    setScenarioStatus(this.dom, text);
  }
}

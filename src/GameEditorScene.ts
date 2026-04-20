import Phaser from 'phaser';
import type { MapArea, MapData, Point } from './types';
import { cloneArea, sanitizeMapData, shapeContainsPoint } from './utils';
import { AreaPresentationRenderer } from './area/AreaPresentationRenderer';
import { GameFileManager } from './game/GameFileManager';
import {
  bindGameEditorDomEvents,
  getGameEditorDomRefs,
  refreshGameEditorMetadataUI,
  refreshGameEditorSelectionUI,
  setGameEditorStatus,
  type GameEditorDomRefs
} from './game/GameEditorDom';
import { createDefaultPlayerState, createEmptyGameData, createEmptyGameMapScenario, sanitizeGameData } from './game/utils';
import type { AreaGameScenario, AreaTransition, GameData, GameMapScenario } from './game/types';
import type { ScenarioAction, ScenarioActionOperation } from './scenario/types';

export class GameEditorScene extends Phaser.Scene {
  private static readonly DEFAULT_MAP_JSON_PATH = '/maps/';

  private mapData: MapData = sanitizeMapData({});
  private gameData: GameData = createEmptyGameData();
  private currentMapId: string | null = null;
  private selectedAreaId: string | null = null;
  private mapSprite!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private dom!: GameEditorDomRefs;
  private fileManager = new GameFileManager();
  private presentationRenderer!: AreaPresentationRenderer;
  private imageObjectUrl: string | null = null;
  private navigationStack: string[] = [];

  constructor() {
    super('GameEditorScene');
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
    this.refreshMetadataUI();
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
    this.dom = getGameEditorDomRefs();
    bindGameEditorDomEvents(this.dom, {
      onGameMetaInput: () => this.updateGameMeta(),
      onMapJsonPathInput: () => this.updateCurrentMapJsonPath(),
      onLoadMapJson: () => void this.loadMapJsonFromFile(),
      onLoadGameJson: () => void this.loadGameJsonFromFile(),
      onNewGame: () => this.newGame(),
      onSaveGame: () => this.saveGame(),
      onFitView: () => this.fitMapToView(),
      onGoBack: () => void this.goBackToParentMap(),
      onFollowTransition: () => void this.followTransition(),
      onLoadTransitionMapJson: () => void this.loadTransitionMapJsonFromFile(),
      onDisplayToggle: (field, checked) => this.updateDisplaySetting(field, checked),
      onTransitionInput: (field, value) => this.updateTransitionField(field, value),
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
    this.refreshMetadataUI();
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
    this.presentationRenderer.redraw(this.getRenderedAreas());
    this.overlay.clear();

    for (const area of this.mapData.areas) {
      const selected = area.id === this.selectedAreaId;
      this.drawAreaOutline(area, selected);
    }
  }

  private getRenderedAreas(): MapArea[] {
    return this.mapData.areas.map((area) => {
      const rendered = cloneArea(area);
      const areaScenario = this.getCurrentMapScenario()?.areas[area.id];
      if (!areaScenario?.display) {
        return rendered;
      }

      if (areaScenario.display.showLabel === false) {
        rendered.label = '';
        rendered.presentation = { ...rendered.presentation, label: undefined };
      }
      if (areaScenario.display.showIcon === false) {
        rendered.iconPath = '';
        rendered.presentation = { ...rendered.presentation, icon: undefined };
      }
      if (areaScenario.display.showBackground === false && rendered.presentation) {
        rendered.presentation = { ...rendered.presentation, background: undefined };
      }
      return rendered;
    });
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
    if (area.shape.points.length === 0) {
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

  private updateGameMeta(): void {
    this.gameData.id = this.dom.gameIdInput.value.trim() || 'new_game';
    this.gameData.name = this.dom.gameNameInput.value.trim();
  }

  private updateCurrentMapJsonPath(): void {
    const mapScenario = this.ensureCurrentMapScenario();
    if (!mapScenario) {
      return;
    }
    mapScenario.mapJsonPath = this.dom.mapJsonPathInput.value.trim();
    this.refreshMetadataUI();
  }

  private async loadMapJsonFromFile(): Promise<void> {
    const file = this.dom.mapJsonFileInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedMap = sanitizeMapData(JSON.parse(text));
      const mapJsonPath = this.composeAssetPath(
        this.dom.mapJsonPathInput.value || GameEditorScene.DEFAULT_MAP_JSON_PATH,
        file.name
      );
      const existing = this.gameData.maps[parsedMap.id];
      const mapScenario = existing ?? createEmptyGameMapScenario(parsedMap.id, mapJsonPath);
      mapScenario.mapId = parsedMap.id;
      mapScenario.mapJsonPath = mapJsonPath;
      this.gameData.maps[parsedMap.id] = mapScenario;
      if (!this.gameData.initialPlayerState.mapId) {
        this.gameData.initialPlayerState.mapId = parsedMap.id;
      }
      this.navigationStack = [];
      await this.applyLoadedMapData(parsedMap, parsedMap.id, mapJsonPath);
      this.setStatus(`Loaded map JSON from ${file.name}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to load map JSON.');
    }
  }

  private async loadGameJsonFromFile(): Promise<void> {
    const file = this.dom.gameJsonFileInput.files?.[0];
    if (!file) return;

    try {
      this.gameData = await this.fileManager.loadJsonFromFile(file);
      this.navigationStack = [];
      this.selectedAreaId = null;
      const initialMapId = this.getInitialMapId();
      if (!initialMapId) {
        this.mapData = sanitizeMapData({});
        this.currentMapId = null;
        this.clearLoadedImage();
        this.refreshMetadataUI();
        this.refreshSelectionUI();
        this.redraw();
        this.setStatus(`Loaded game JSON from ${file.name}.`);
        return;
      }

      await this.openMapScenario(initialMapId, false);
      this.setStatus(`Loaded game JSON from ${file.name}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to load game JSON.');
    }
  }

  private saveGame(): void {
    if (!this.gameData.id) {
      this.gameData.id = 'new_game';
    }
    if (!this.gameData.initialPlayerState) {
      this.gameData.initialPlayerState = createDefaultPlayerState();
    }
    if (!this.gameData.initialPlayerState.mapId && this.currentMapId) {
      this.gameData.initialPlayerState.mapId = this.currentMapId;
    }
    this.gameData = sanitizeGameData(this.gameData);
    this.fileManager.saveJson(this.gameData, this.dom.saveFilenameInput.value);
    this.refreshMetadataUI();
    this.refreshSelectionUI();
    this.setStatus('Saved game JSON.');
  }

  private newGame(): void {
    const previousMapId = this.currentMapId;
    const previousMapPath = this.getCurrentMapScenario()?.mapJsonPath ?? '';
    this.gameData = createEmptyGameData();
    this.navigationStack = [];
    this.selectedAreaId = null;

    if (previousMapId) {
      const mapScenario = createEmptyGameMapScenario(previousMapId, previousMapPath);
      this.gameData.maps[previousMapId] = mapScenario;
      this.gameData.initialPlayerState.mapId = previousMapId;
      this.currentMapId = previousMapId;
    }

    this.refreshMetadataUI();
    this.refreshSelectionUI();
    this.redraw();
    this.setStatus('Started a new game.');
  }

  private async followTransition(): Promise<void> {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) {
      return;
    }
    const targetMapId = areaScenario?.transition?.targetMapId?.trim();
    const targetMapJsonPath = areaScenario?.transition?.targetMapJsonPath?.trim();
    if (!this.currentMapId || !this.selectedAreaId || !targetMapId || !targetMapJsonPath) {
      return;
    }

    areaScenario.transition = {
      targetMapId,
      targetMapJsonPath,
      returnToMapId: this.currentMapId,
      returnToAreaId: this.selectedAreaId
    };

    if (!this.gameData.maps[targetMapId]) {
      this.gameData.maps[targetMapId] = {
        ...createEmptyGameMapScenario(targetMapId, targetMapJsonPath),
        parentMapId: this.currentMapId,
        parentAreaId: this.selectedAreaId
      };
    }

    try {
      await this.openMapScenario(targetMapId, true);
      this.setStatus(`Opened transition target ${targetMapId}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to open transition target.');
    }
  }

  private async loadTransitionMapJsonFromFile(): Promise<void> {
    const areaScenario = this.ensureSelectedAreaScenario();
    const file = this.dom.transitionMapFileInput.files?.[0];
    if (!areaScenario || !file) {
      return;
    }

    try {
      const text = await file.text();
      const parsedMap = sanitizeMapData(JSON.parse(text));
      const targetMapJsonPath = this.composeAssetPath(this.getCurrentMapDirectoryPath(), file.name);
      areaScenario.transition = {
        targetMapId: parsedMap.id,
        targetMapJsonPath,
        returnToMapId: this.currentMapId ?? areaScenario.transition?.returnToMapId,
        returnToAreaId: this.selectedAreaId ?? areaScenario.transition?.returnToAreaId
      };
      this.refreshMetadataUI();
      this.refreshSelectionUI();
      this.setStatus(`Prepared transition to ${parsedMap.id}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to load target map JSON.');
    }
  }

  private async goBackToParentMap(): Promise<void> {
    let targetMapId: string | undefined = this.navigationStack.pop();
    if (!targetMapId) {
      targetMapId = this.getCurrentMapScenario()?.parentMapId;
    }
    if (!targetMapId) {
      return;
    }

    try {
      await this.openMapScenario(targetMapId, false);
      this.setStatus(`Returned to ${targetMapId}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to return to previous map.');
    }
  }

  private async openMapScenario(mapId: string, pushCurrent: boolean): Promise<void> {
    const mapScenario = this.gameData.maps[mapId];
    if (!mapScenario) {
      throw new Error(`Unknown map scenario: ${mapId}`);
    }
    if (!mapScenario.mapJsonPath) {
      throw new Error(`Map ${mapId} does not have a mapJsonPath.`);
    }

    if (pushCurrent && this.currentMapId && this.currentMapId !== mapId) {
      this.navigationStack.push(this.currentMapId);
    }

    this.currentMapId = mapId;
    this.selectedAreaId = null;
    const response = await fetch(mapScenario.mapJsonPath);
    if (!response.ok) {
      throw new Error(`Failed to load map JSON: ${mapScenario.mapJsonPath}`);
    }
    const parsed = await response.json();
    await this.applyLoadedMapData(sanitizeMapData(parsed), mapId, mapScenario.mapJsonPath);
  }

  private async loadImageFromPath(path: string): Promise<void> {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }

    const key = `game-editor-map-${Date.now()}`;
    await new Promise<void>((resolve, reject) => {
      this.load.image(key, path);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load image: ${path}`)));
      this.load.start();
    });

    const oldKey = this.mapSprite.texture.key;
    if (oldKey !== '__WHITE' && this.textures.exists(oldKey) && oldKey.startsWith('game-editor-map-')) {
      this.textures.remove(oldKey);
    }

    this.mapSprite.setTexture(key).setOrigin(0, 0).clearTint();
    const texture = this.textures.get(key).getSourceImage() as HTMLImageElement;
    this.mapData.mapWidth = texture.width;
    this.mapData.mapHeight = texture.height;
    this.mapSprite.setDisplaySize(texture.width, texture.height);
    this.cameras.main.setBounds(0, 0, texture.width, texture.height);
  }

  private async applyLoadedMapData(mapData: MapData, mapId: string, mapJsonPath: string): Promise<void> {
    this.mapData = mapData;
    this.currentMapId = mapId;
    this.selectedAreaId = null;

    const mapScenario = this.ensureCurrentMapScenario();
    if (mapScenario) {
      mapScenario.mapId = mapData.id;
      mapScenario.mapJsonPath = mapJsonPath;
    }

    if (this.gameData.initialPlayerState.mapId === '') {
      this.gameData.initialPlayerState.mapId = mapData.id;
    }

    if (this.mapData.imagePath) {
      await this.loadImageFromPath(this.mapData.imagePath);
    } else {
      this.clearLoadedImage();
    }

    this.refreshMetadataUI();
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

  private getCurrentMapDirectoryPath(): string {
    const currentPath = this.getCurrentMapScenario()?.mapJsonPath?.trim() || this.dom.mapJsonPathInput.value.trim();
    if (!currentPath) {
      return GameEditorScene.DEFAULT_MAP_JSON_PATH;
    }

    const lastSlash = currentPath.lastIndexOf('/');
    if (lastSlash < 0) {
      return '/';
    }

    return currentPath.slice(0, lastSlash + 1) || '/';
  }

  private refreshMetadataUI(): void {
    const mapScenario = this.getCurrentMapScenario();
    this.dom.mapJsonPathInput.value = mapScenario?.mapJsonPath ?? this.dom.mapJsonPathInput.value ?? GameEditorScene.DEFAULT_MAP_JSON_PATH;
    refreshGameEditorMetadataUI(
      this.dom,
      {
        gameName: this.gameData.name,
        currentMapId: this.currentMapId ?? '',
        currentMapPath: mapScenario?.mapJsonPath ?? '',
        configuredAreas: Object.keys(mapScenario?.areas ?? {}).length,
        totalAreas: this.mapData.areas.length,
        canGoBack: Boolean(this.navigationStack.length || mapScenario?.parentMapId),
        canFollowTransition: Boolean(
          this.selectedAreaId &&
            this.getSelectedAreaScenario()?.transition?.targetMapId &&
            this.getSelectedAreaScenario()?.transition?.targetMapJsonPath
        )
      },
      this.gameData.id
    );
  }

  private refreshSelectionUI(): void {
    refreshGameEditorSelectionUI(this.dom, this.getSelectedArea(), this.getSelectedAreaScenario());
  }

  private getInitialMapId(): string | null {
    if (this.gameData.initialPlayerState.mapId && this.gameData.maps[this.gameData.initialPlayerState.mapId]) {
      return this.gameData.initialPlayerState.mapId;
    }
    const first = Object.keys(this.gameData.maps)[0];
    return first ?? null;
  }

  private getCurrentMapScenario(): GameMapScenario | null {
    return this.currentMapId ? this.gameData.maps[this.currentMapId] ?? null : null;
  }

  private ensureCurrentMapScenario(): GameMapScenario | null {
    if (!this.currentMapId) {
      return null;
    }
    if (!this.gameData.maps[this.currentMapId]) {
      this.gameData.maps[this.currentMapId] = createEmptyGameMapScenario(this.currentMapId, '');
    }
    return this.gameData.maps[this.currentMapId];
  }

  private getSelectedArea(): MapArea | null {
    if (!this.selectedAreaId) return null;
    return this.mapData.areas.find((area) => area.id === this.selectedAreaId) ?? null;
  }

  private getSelectedAreaScenario(): AreaGameScenario | undefined {
    const mapScenario = this.getCurrentMapScenario();
    return this.selectedAreaId && mapScenario ? mapScenario.areas[this.selectedAreaId] : undefined;
  }

  private ensureSelectedAreaScenario(): AreaGameScenario | null {
    if (!this.selectedAreaId) return null;
    const mapScenario = this.ensureCurrentMapScenario();
    if (!mapScenario) return null;
    if (!mapScenario.areas[this.selectedAreaId]) {
      mapScenario.areas[this.selectedAreaId] = {};
      this.refreshMetadataUI();
    }
    return mapScenario.areas[this.selectedAreaId];
  }

  private updateDisplaySetting(field: 'showLabel' | 'showIcon' | 'showBackground', checked: boolean): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    areaScenario.display = {
      ...(areaScenario.display ?? {}),
      [field]: checked
    };
    if (
      areaScenario.display.showLabel !== false &&
      areaScenario.display.showIcon !== false &&
      areaScenario.display.showBackground !== false
    ) {
      areaScenario.display = undefined;
    }
    this.refreshSelectionUI();
    this.redraw();
  }

  private updateTransitionField(field: 'targetMapId' | 'targetMapJsonPath', value: string): void {
    const areaScenario = this.ensureSelectedAreaScenario();
    if (!areaScenario) return;
    const currentTransition: AreaTransition = {
      targetMapId: areaScenario.transition?.targetMapId ?? '',
      targetMapJsonPath: areaScenario.transition?.targetMapJsonPath ?? '',
      returnToMapId: areaScenario.transition?.returnToMapId,
      returnToAreaId: areaScenario.transition?.returnToAreaId
    };
    currentTransition[field] = value.trim();
    if (!currentTransition.targetMapId && !currentTransition.targetMapJsonPath) {
      areaScenario.transition = undefined;
    } else {
      currentTransition.returnToMapId = this.currentMapId ?? currentTransition.returnToMapId;
      currentTransition.returnToAreaId = this.selectedAreaId ?? currentTransition.returnToAreaId;
      areaScenario.transition = currentTransition;
    }
    this.refreshMetadataUI();
    this.refreshSelectionUI();
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
    const current = areaScenario[key] ? { ...areaScenario[key]! } : { text: '' };
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
    setGameEditorStatus(this.dom, text);
  }
}

import Phaser from 'phaser';
import type { MapArea, MapData, Point } from './types';
import { cloneArea, sanitizeMapData, shapeContainsPoint } from './utils';
import { AreaPresentationRenderer } from './area/AreaPresentationRenderer';
import { GameFileManager } from './game/GameFileManager';
import { GamePlayer } from './game/GamePlayer';
import { resolveSlideMovement } from './game/movementResolver';
import { TerrainSampler } from './game/terrainSampler';
import { mapPointFromAreaToMap, mapPointFromMapToArea } from './game/transitionGeometry';
import type { AreaGameScenario, GameData, GameMapScenario } from './game/types';
import { createDefaultPlayerState } from './game/utils';
import {
  bindGameDomEvents,
  getGameDomRefs,
  refreshGameMetadataUI,
  refreshPlayerPositionUI,
  refreshStoreUI,
  setGameStatus,
  type GameDomRefs
} from './game/GameDom';
import type { ScenarioAction, ScenarioMessage } from './scenario/types';

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 220;

export class GameScene extends Phaser.Scene {
  private mapData: MapData = sanitizeMapData({});
  private gameData: GameData | null = null;
  private gameName = '';
  private currentMapId: string | null = null;
  private mapSprite!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.Text;
  private dom!: GameDomRefs;
  private fileManager = new GameFileManager();
  private presentationRenderer!: AreaPresentationRenderer;
  private playerController!: GamePlayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private imageObjectUrl: string | null = null;
  private terrainSampler: TerrainSampler | null = null;
  private activeAreaIds = new Set<string>();
  private messageExpireAt = 0;
  private isTransitioning = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101621');
    this.mapSprite = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.overlay = this.add.graphics().setDepth(200);
    this.messageText = this.add
      .text(0, 18, '', {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { left: 12, right: 12, top: 8, bottom: 8 },
        align: 'center',
        wordWrap: { width: 600 }
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);

    const playerSprite = this.add.sprite(0, 0, '__WHITE').setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setDepth(700).setVisible(false);
    this.playerController = new GamePlayer(this, playerSprite, PLAYER_SIZE);

    this.presentationRenderer = new AreaPresentationRenderer({
      scene: this,
      add: this.add,
      requestRedraw: () => this.redraw()
    });

    this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys);
    this.initializeDom();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.layoutHud());
    this.layoutHud();
    this.refreshMetadataUI();
    this.refreshStoreUI();
    this.refreshPlayerPositionUI();
  }

  update(_time: number, delta: number): void {
    this.updatePlayerMovement(delta / 1000);
    this.updateMessageVisibility();
    this.refreshPlayerPositionUI();
  }

  private initializeDom(): void {
    this.dom = getGameDomRefs();
    bindGameDomEvents(this.dom, {
      onLoadGame: () => void this.loadGameJsonFromFile(),
      onFitView: () => this.fitMapToView()
    });
  }

  private async loadGameJsonFromFile(): Promise<void> {
    const file = this.dom.gameFileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      this.gameData = await this.fileManager.loadJsonFromFile(file);
      this.gameName = file.name;
      const initialMapId = this.getInitialMapId();
      if (!initialMapId) {
        throw new Error('Game does not define any maps.');
      }

      await this.openMapScenario(initialMapId, this.gameData.initialPlayerState, true);
      this.setStatus(`Loaded game ${file.name}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to load game.');
    }
  }

  private async openMapScenario(mapId: string, playerState?: ReturnType<GamePlayer['getState']>, resetMessages = false): Promise<void> {
    if (!this.gameData) {
      throw new Error('No game data loaded.');
    }

    const mapScenario = this.getMapScenario(mapId);
    if (!mapScenario?.mapJsonPath) {
      throw new Error(`Map ${mapId} does not have a mapJsonPath.`);
    }

    this.isTransitioning = true;
    this.currentMapId = mapId;

    try {
      const response = await fetch(mapScenario.mapJsonPath);
      if (!response.ok) {
        throw new Error(`Failed to load map JSON: ${mapScenario.mapJsonPath}`);
      }

      const parsed = await response.json();
      this.mapData = sanitizeMapData(parsed);
      if (this.mapData.imagePath) {
        await this.loadImageFromPath(this.mapData.imagePath);
      } else {
        this.clearLoadedImage();
        this.terrainSampler = null;
      }

      const nextPlayerState = playerState ?? this.playerController.getState();
      const startingState = {
        ...nextPlayerState,
        mapId,
        areaId: null,
        justEnteredAreaId: null,
        justExitedAreaId: null
      };
      const shouldCenter = startingState.position.x === 0 && startingState.position.y === 0;
      if (shouldCenter) {
        startingState.position = {
          x: this.mapData.mapWidth / 2,
          y: this.mapData.mapHeight / 2
        };
      }
      try {
        await this.playerController.loadFromState(startingState);
      } catch (_error) {
        this.playerController.setFallbackAppearance();
        this.playerController.setPosition(startingState.position.x, startingState.position.y);
      }
      this.playerController.setMap(mapId);
      this.cameras.main.centerOn(startingState.position.x, startingState.position.y);
      this.activeAreaIds.clear();
      if (resetMessages) {
        this.messageText.setVisible(false);
        this.messageExpireAt = 0;
      }
      this.fitMapToView();
      this.syncPlayerAreas();
      this.refreshMetadataUI();
      this.refreshStoreUI();
      this.refreshPlayerPositionUI();
      this.redraw();
    } finally {
      this.isTransitioning = false;
    }
  }

  private async loadImageFromPath(path: string): Promise<void> {
    if (this.imageObjectUrl) {
      URL.revokeObjectURL(this.imageObjectUrl);
      this.imageObjectUrl = null;
    }

    const key = `game-map-${Date.now()}`;
    await new Promise<void>((resolve, reject) => {
      this.load.image(key, path);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error(`Failed to load image: ${path}`)));
      this.load.start();
    });

    const oldKey = this.mapSprite.texture.key;
    if (oldKey !== '__WHITE' && this.textures.exists(oldKey) && oldKey.startsWith('game-map-')) {
      this.textures.remove(oldKey);
    }

    this.mapSprite.setTexture(key).setOrigin(0, 0).clearTint();
    const texture = this.textures.get(key).getSourceImage() as HTMLImageElement;
    this.mapData.mapWidth = texture.width;
    this.mapData.mapHeight = texture.height;
    this.mapSprite.setDisplaySize(texture.width, texture.height);
    this.cameras.main.setBounds(0, 0, texture.width, texture.height);
    this.terrainSampler = new TerrainSampler(texture, texture.width, texture.height);
  }

  private clearLoadedImage(): void {
    this.mapSprite.setTexture('__WHITE').setOrigin(0, 0).setTint(0x2b3245);
    this.mapSprite.setDisplaySize(this.mapData.mapWidth, this.mapData.mapHeight);
    this.cameras.main.setBounds(0, 0, this.mapData.mapWidth, this.mapData.mapHeight);
    this.terrainSampler = null;
  }

  private redraw(): void {
    this.presentationRenderer.redraw(this.getRenderedAreas());
    this.overlay.clear();

    for (const area of this.mapData.areas) {
      const active = this.activeAreaIds.has(area.id);
      this.drawAreaOutline(area, active);
    }
  }

  private getRenderedAreas(): MapArea[] {
    const mapScenario = this.currentMapId ? this.gameData?.maps[this.currentMapId] : undefined;
    return this.mapData.areas.map((area) => {
      const rendered = cloneArea(area);
      const areaScenario = mapScenario?.areas[area.id];
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

  private drawAreaOutline(area: MapArea, active: boolean): void {
    this.overlay.lineStyle(active ? 4 : 2, active ? 0xffd166 : 0x8ec5ff, active ? 1 : 0.75);
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

  private updatePlayerMovement(deltaSeconds: number): void {
    if (!this.gameData || this.isTransitioning) {
      return;
    }

    const previousPosition = this.playerController.getPosition();
    const moveResult = this.playerController.moveByInput(
      this.cursors,
      deltaSeconds,
      { width: this.mapData.mapWidth, height: this.mapData.mapHeight },
      this.playerController.getSpeed(PLAYER_SPEED)
    );
    if (!moveResult.moved) {
      return;
    }

    const nextPosition = this.playerController.getPosition();
    if (!this.terrainAllows(nextPosition)) {
      const slidePosition = resolveSlideMovement(
        previousPosition,
        nextPosition,
        { width: this.mapData.mapWidth, height: this.mapData.mapHeight },
        (candidate) => this.terrainAllows(candidate)
      );
      if (!slidePosition) {
        this.playerController.setPosition(previousPosition.x, previousPosition.y);
        return;
      }
      this.playerController.setPosition(slidePosition.x, slidePosition.y);
    }

    const position = this.playerController.getPosition();
    this.cameras.main.centerOn(position.x, position.y);
    if (moveResult.attemptedExit) {
      if (this.canReturnToParent()) {
        void this.transitionToParentMap();
        return;
      }
    }
    this.syncPlayerAreas();
  }

  private syncPlayerAreas(): void {
    if (!this.gameData || this.isTransitioning) {
      return;
    }

    this.playerController.clearAreaEventFlags();
    const world: Point = this.playerController.getPosition();
    const nextAreas = this.mapData.areas.filter((area) => shapeContainsPoint(area.shape, world));
    const nextAreaIds = new Set(nextAreas.map((area) => area.id));

    for (const areaId of this.activeAreaIds) {
      if (!nextAreaIds.has(areaId)) {
        this.handleAreaEvent(areaId, 'exit');
      }
    }

    for (const area of nextAreas) {
      if (!this.activeAreaIds.has(area.id)) {
        const transitionTarget = this.handleAreaEvent(area.id, 'enter');
        if (transitionTarget) {
          this.activeAreaIds = nextAreaIds;
          this.redraw();
          void this.transitionToChildMap(area, transitionTarget);
          return;
        }
      }
    }

    this.activeAreaIds = nextAreaIds;
    const primaryArea = nextAreas.length > 0 ? nextAreas[nextAreas.length - 1].id : null;
    this.playerController.setArea(primaryArea);
    this.redraw();
  }

  private handleAreaEvent(areaId: string, kind: 'enter' | 'exit'): GameMapScenario | null {
    const areaScenario = this.getAreaScenario(areaId);
    if (!areaScenario) {
      if (kind === 'enter') {
        this.playerController.markEnteredArea(areaId);
      } else {
        this.playerController.markExitedArea(areaId);
      }
      return null;
    }

    if (kind === 'enter') {
      this.playerController.markEnteredArea(areaId);
    } else {
      this.playerController.markExitedArea(areaId);
    }

    const message = kind === 'enter' ? areaScenario.onEnterMessage : areaScenario.onExitMessage;
    this.maybeShowMessage(message);

    const actions = kind === 'enter' ? areaScenario.onEnterActions : areaScenario.onExitActions;
    this.applyActions(actions);

    if (kind === 'enter' && areaScenario.transition) {
      return this.getMapScenario(areaScenario.transition.targetMapId) ?? {
        mapId: areaScenario.transition.targetMapId,
        mapJsonPath: areaScenario.transition.targetMapJsonPath,
        parentMapId: this.currentMapId ?? undefined,
        parentAreaId: areaId,
        areas: {}
      };
    }

    return null;
  }

  private async transitionToChildMap(sourceArea: MapArea, targetMapScenario: GameMapScenario): Promise<void> {
    if (!this.gameData) {
      return;
    }

    if (!this.gameData.maps[targetMapScenario.mapId]) {
      this.gameData.maps[targetMapScenario.mapId] = targetMapScenario;
    }

    try {
      const response = await fetch(targetMapScenario.mapJsonPath);
      if (!response.ok) {
        throw new Error(`Failed to load target map JSON: ${targetMapScenario.mapJsonPath}`);
      }
      const parsed = await response.json();
      const targetMapData = sanitizeMapData(parsed);
      const currentState = this.playerController.getState();
      currentState.mapId = targetMapScenario.mapId;
      currentState.areaId = null;
      currentState.justEnteredAreaId = null;
      currentState.justExitedAreaId = null;
      currentState.position = mapPointFromAreaToMap(
        sourceArea,
        this.playerController.getPosition(),
        {
          width: targetMapData.mapWidth,
          height: targetMapData.mapHeight
        }
      );

      await this.openMapScenario(targetMapScenario.mapId, currentState);
      this.setStatus(`Transitioned to ${targetMapScenario.mapId}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to transition to target map.');
      this.isTransitioning = false;
    }
  }

  private async transitionToParentMap(): Promise<void> {
    if (!this.gameData || !this.currentMapId || this.isTransitioning) {
      return;
    }

    const currentMapScenario = this.getMapScenario(this.currentMapId);
    const parentMapId = currentMapScenario?.parentMapId;
    const parentAreaId = currentMapScenario?.parentAreaId;
    if (!parentMapId || !parentAreaId) {
      return;
    }

    const parentMapScenario = this.getMapScenario(parentMapId);
    if (!parentMapScenario) {
      return;
    }

    try {
      const response = await fetch(parentMapScenario.mapJsonPath);
      if (!response.ok) {
        throw new Error(`Failed to load parent map JSON: ${parentMapScenario.mapJsonPath}`);
      }
      const parsed = await response.json();
      const parentMapData = sanitizeMapData(parsed);
      const parentArea = parentMapData.areas.find((area) => area.id === parentAreaId);
      if (!parentArea) {
        throw new Error(`Parent area ${parentAreaId} not found on map ${parentMapId}.`);
      }

      const currentPosition = this.playerController.getPosition();
      const nextPlayerState = this.playerController.getState();
      nextPlayerState.mapId = parentMapId;
      nextPlayerState.areaId = null;
      nextPlayerState.justEnteredAreaId = null;
      nextPlayerState.justExitedAreaId = null;
      nextPlayerState.position = mapPointFromMapToArea(
        { width: this.mapData.mapWidth, height: this.mapData.mapHeight },
        currentPosition,
        parentArea
      );

      await this.openMapScenario(parentMapId, nextPlayerState);
      this.setStatus(`Returned to ${parentMapId}.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Failed to return to parent map.');
    }
  }

  private canReturnToParent(): boolean {
    if (!this.currentMapId) {
      return false;
    }
    const currentMapScenario = this.getMapScenario(this.currentMapId);
    return Boolean(currentMapScenario?.parentMapId && currentMapScenario?.parentAreaId);
  }

  private applyActions(actions: ScenarioAction[] | undefined): void {
    if (!actions || actions.length === 0) {
      return;
    }

    for (const action of actions) {
      this.playerController.applyAction(action);
    }
    this.refreshStoreUI();
  }

  private maybeShowMessage(message: ScenarioMessage | undefined): void {
    if (!message?.text) {
      return;
    }

    this.messageText.setText(message.text).setVisible(true);
    this.messageExpireAt = message.seconds !== undefined ? this.time.now + message.seconds * 1000 : 0;
    this.layoutHud();
  }

  private updateMessageVisibility(): void {
    if (this.messageExpireAt > 0 && this.time.now >= this.messageExpireAt) {
      this.messageExpireAt = 0;
      this.messageText.setVisible(false);
    }
  }

  private fitMapToView(): void {
    const container = document.getElementById('game-container');
    if (!container) {
      return;
    }

    const width = Math.max(100, container.clientWidth);
    const height = Math.max(100, container.clientHeight);
    const zoomX = width / Math.max(1, this.mapData.mapWidth);
    const zoomY = height / Math.max(1, this.mapData.mapHeight);
    const zoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), 0.05, 2.5);
    this.cameras.main.setZoom(zoom);
    const position = this.playerController.getPosition();
    if (this.playerController.getSprite().visible) {
      this.cameras.main.centerOn(position.x, position.y);
    } else {
      this.cameras.main.centerOn(this.mapData.mapWidth / 2, this.mapData.mapHeight / 2);
    }
    this.layoutHud();
  }

  private layoutHud(): void {
    const width = this.scale.width;
    this.messageText.setPosition(width / 2, 18);
    this.messageText.setWordWrapWidth(Math.max(280, width - 120));
  }

  private getInitialMapId(): string | null {
    if (this.gameData?.initialPlayerState.mapId && this.gameData.maps[this.gameData.initialPlayerState.mapId]) {
      return this.gameData.initialPlayerState.mapId;
    }
    const first = this.gameData ? Object.keys(this.gameData.maps)[0] : null;
    return first ?? null;
  }

  private getMapScenario(mapId: string): GameMapScenario | null {
    return this.gameData?.maps[mapId] ?? null;
  }

  private getAreaScenario(areaId: string): AreaGameScenario | undefined {
    if (!this.currentMapId || !this.gameData) {
      return undefined;
    }
    return this.gameData.maps[this.currentMapId]?.areas[areaId];
  }

  private refreshMetadataUI(): void {
    refreshGameMetadataUI(this.dom, this.gameName, this.currentMapId ?? '');
  }

  private refreshPlayerPositionUI(): void {
    const position = this.playerController ? this.playerController.getPosition() : { x: 0, y: 0 };
    refreshPlayerPositionUI(this.dom, position.x, position.y);
  }

  private refreshStoreUI(): void {
    const store = this.playerController ? this.playerController.getStore() : createDefaultPlayerState().store;
    refreshStoreUI(this.dom, store);
  }

  private setStatus(text: string): void {
    setGameStatus(this.dom, text);
  }

  private terrainAllows(position: Point): boolean {
    if (!this.terrainSampler) {
      return true;
    }
    return this.terrainSampler.allows(position, this.playerController.getTerrain(), PLAYER_SIZE);
  }
}

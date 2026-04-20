import Phaser from 'phaser';
import type { ScenarioAction } from '../scenario/types';
import type { PlayerState } from './types';
import { createDefaultPlayerState } from './utils';
import type { VehicleTerrainConfig } from './vehicleDefinition';
import type { VehicleDirection } from './vehicleDefinition';
import { VehicleLoader, type LoadedVehicle } from './vehicleLoader';

const DEFAULT_PLAYER_ASSET_PATH = '/vehicles/image.png';

export interface PlayerMoveResult {
  moved: boolean;
  attemptedExit: boolean;
}

export class GamePlayer {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly size: number;
  private readonly vehicleLoader: VehicleLoader;
  private state: PlayerState = createDefaultPlayerState();
  private loadedVehiclePath = '';
  private loadedVehicle: LoadedVehicle | null = null;
  private facingDirection: VehicleDirection = 'down';
  private animationElapsedMs = 0;
  private animationFrameIndex = 0;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, size: number) {
    this.scene = scene;
    this.sprite = sprite;
    this.size = size;
    this.vehicleLoader = new VehicleLoader(scene);
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  getState(): PlayerState {
    return {
      mapId: this.state.mapId,
      areaId: this.state.areaId,
      position: { ...this.state.position },
      vehicle: this.state.vehicle,
      store: { ...this.state.store },
      justEnteredAreaId: this.state.justEnteredAreaId,
      justExitedAreaId: this.state.justExitedAreaId
    };
  }

  getStore(): Record<string, number> {
    return { ...this.state.store };
  }

  getPosition(): { x: number; y: number } {
    return { ...this.state.position };
  }

  getSpeed(defaultSpeed: number): number {
    return this.loadedVehicle?.speed ?? defaultSpeed;
  }

  getTerrain(): VehicleTerrainConfig | undefined {
    return this.loadedVehicle?.terrain;
  }

  async loadFromState(state: PlayerState): Promise<void> {
    this.state = {
      mapId: state.mapId,
      areaId: state.areaId,
      position: { ...state.position },
      vehicle: state.vehicle,
      store: { ...state.store },
      justEnteredAreaId: state.justEnteredAreaId,
      justExitedAreaId: state.justExitedAreaId
    };
    await this.setVehicle(state.vehicle || DEFAULT_PLAYER_ASSET_PATH);
    this.setPosition(state.position.x, state.position.y);
    this.sprite.setVisible(true);
  }

  async setVehicle(vehicle: string): Promise<void> {
    const assetPath = this.resolveVehiclePath(vehicle);
    this.state.vehicle = vehicle;
    this.animationElapsedMs = 0;
    this.animationFrameIndex = 0;
    this.loadedVehiclePath = assetPath;
    this.loadedVehicle = await this.vehicleLoader.loadVehicle(assetPath);
    this.sprite.clearTint().setDisplaySize(this.size, this.size).setVisible(true);
    this.applyIdleFrame();
  }

  setFallbackAppearance(): void {
    this.loadedVehiclePath = '';
    this.loadedVehicle = null;
    this.sprite.setTexture('__WHITE').setTint(0xf6bd60).setDisplaySize(this.size, this.size).setVisible(true);
  }

  setMap(mapId: string): void {
    this.state.mapId = mapId;
  }

  setPosition(x: number, y: number): void {
    this.state.position = { x, y };
    this.sprite.setPosition(x, y);
  }

  setArea(areaId: string | null): void {
    this.state.areaId = areaId;
  }

  clearAreaEventFlags(): void {
    this.state.justEnteredAreaId = null;
    this.state.justExitedAreaId = null;
  }

  markEnteredArea(areaId: string): void {
    this.state.areaId = areaId;
    this.state.justEnteredAreaId = areaId;
    this.state.justExitedAreaId = null;
  }

  markExitedArea(areaId: string): void {
    if (this.state.areaId === areaId) {
      this.state.areaId = null;
    }
    this.state.justExitedAreaId = areaId;
    this.state.justEnteredAreaId = null;
  }

  moveByInput(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    deltaSeconds: number,
    bounds: { width: number; height: number },
    speed: number
  ): PlayerMoveResult {
    let dx = 0;
    let dy = 0;
    if (cursors.left?.isDown) dx -= 1;
    if (cursors.right?.isDown) dx += 1;
    if (cursors.up?.isDown) dy -= 1;
    if (cursors.down?.isDown) dy += 1;

    if (dx === 0 && dy === 0) {
      this.applyIdleFrame();
      return { moved: false, attemptedExit: false };
    }

    this.updateFacingDirection(dx, dy);
    this.advanceAnimation(deltaSeconds * 1000);

    const length = Math.hypot(dx, dy) || 1;
    const velocity = (speed * deltaSeconds) / length;
    const desiredX = this.state.position.x + dx * velocity;
    const desiredY = this.state.position.y + dy * velocity;
    const nextX = Phaser.Math.Clamp(desiredX, 0, bounds.width);
    const nextY = Phaser.Math.Clamp(desiredY, 0, bounds.height);
    this.setPosition(nextX, nextY);
    return {
      moved: true,
      attemptedExit: desiredX !== nextX || desiredY !== nextY
    };
  }

  applyAction(action: ScenarioAction): void {
    if (action.operation === 'assign') {
      this.state.store[action.what] = action.qty;
      return;
    }

    if (action.operation === 'give' || action.operation === 'take') {
      const current = this.state.store[action.what] ?? 0;
      const delta = action.operation === 'give' ? action.qty : -action.qty;
      this.state.store[action.what] = current + delta;
    }
  }

  private resolveVehiclePath(vehicle: string): string {
    const trimmed = vehicle.trim();
    if (!trimmed) {
      return DEFAULT_PLAYER_ASSET_PATH;
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/vehicles/${trimmed}`;
  }

  private updateFacingDirection(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facingDirection = dx > 0 ? 'right' : 'left';
      return;
    }
    this.facingDirection = dy > 0 ? 'down' : 'up';
  }

  private advanceAnimation(deltaMs: number): void {
    if (!this.loadedVehicle || this.loadedVehicle.kind === 'static') {
      return;
    }

    if (this.loadedVehicle.kind === 'spritesheet') {
      const frames = this.loadedVehicle.definition.directionalFrames?.[this.facingDirection];
      if (!frames) {
        return;
      }
      if (!frames.move.length) {
        this.sprite.setTexture(this.loadedVehicle.textureKey).setFrame(frames.idle).setDisplaySize(this.size, this.size);
        return;
      }

      this.animationElapsedMs += deltaMs;
      const frameDuration = this.loadedVehicle.definition.frameDurationMs ?? 140;
      while (this.animationElapsedMs >= frameDuration) {
        this.animationElapsedMs -= frameDuration;
        this.animationFrameIndex = (this.animationFrameIndex + 1) % frames.move.length;
      }
      this.sprite
        .setTexture(this.loadedVehicle.textureKey)
        .setFrame(frames.move[this.animationFrameIndex])
        .setDisplaySize(this.size, this.size);
      return;
    }

    this.animationElapsedMs += deltaMs;
    const frameDuration = this.loadedVehicle.frameDurationMs;
    const frames = this.loadedVehicle.moveTextures[this.facingDirection];
    if (!frames.length) {
      const idleTexture = this.loadedVehicle.idleTextures[this.facingDirection];
      if (idleTexture) {
        this.sprite.setTexture(idleTexture).setDisplaySize(this.size, this.size);
      }
      return;
    }
    while (this.animationElapsedMs >= frameDuration) {
      this.animationElapsedMs -= frameDuration;
      this.animationFrameIndex = (this.animationFrameIndex + 1) % frames.length;
    }
    this.sprite.setTexture(frames[this.animationFrameIndex]).setDisplaySize(this.size, this.size);
  }

  private applyIdleFrame(): void {
    if (!this.loadedVehicle) {
      return;
    }

    this.animationElapsedMs = 0;
    this.animationFrameIndex = 0;
    if (this.loadedVehicle.kind === 'static') {
      this.sprite.setTexture(this.loadedVehicle.textureKey).setDisplaySize(this.size, this.size);
      return;
    }
    if (this.loadedVehicle.kind === 'spritesheet') {
      const frameSet = this.loadedVehicle.definition.directionalFrames?.[this.facingDirection];
      if (!frameSet) {
        return;
      }
      this.sprite
        .setTexture(this.loadedVehicle.textureKey)
        .setFrame(frameSet.idle);
      this.sprite.setDisplaySize(this.size, this.size);
      return;
    }
    const idleTexture = this.loadedVehicle.idleTextures[this.facingDirection];
    if (idleTexture) {
      this.sprite.setTexture(idleTexture).setDisplaySize(this.size, this.size);
    }
  }
}

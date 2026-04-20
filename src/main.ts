import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { GameEditorScene } from './GameEditorScene';
import { MapEditorScene } from './MapEditorScene';
import './styles.css';

type EditorMode = 'map' | 'scenario' | 'game';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app root');
}

let currentMode: EditorMode = 'map';
let game: Phaser.Game | null = null;

renderApp(currentMode);

function renderApp(mode: EditorMode): void {
  currentMode = mode;
  if (game) {
    game.destroy(true);
    game = null;
  }

  app!.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="mode-tabs">
          <button id="mode-map" type="button" class="${mode === 'map' ? 'active' : ''}">Map Editor</button>
          <button id="mode-scenario" type="button" class="${mode === 'scenario' ? 'active' : ''}">Game Editor</button>
          <button id="mode-game" type="button" class="${mode === 'game' ? 'active' : ''}">Game</button>
        </div>
      </header>
      <div id="content-shell" class="content-shell">
        ${renderShellForMode(mode)}
      </div>
    </div>
  `;

  document.getElementById('mode-map')?.addEventListener('click', () => renderApp('map'));
  document.getElementById('mode-scenario')?.addEventListener('click', () => renderApp('scenario'));
  document.getElementById('mode-game')?.addEventListener('click', () => renderApp('game'));

  const scene = mode === 'map' ? new MapEditorScene() : mode === 'scenario' ? new GameEditorScene() : new GameScene();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#ffffff',
    scene: [scene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });

  resizeGame();
}

function renderShellForMode(mode: EditorMode): string {
  if (mode === 'map') {
    return renderMapEditorShell();
  }
  if (mode === 'scenario') {
    return renderGameEditorShell();
  }
  return renderGameShell();
}

function resizeGame(): void {
  const container = document.getElementById('game-container');
  if (!container || !game) return;
  const width = Math.max(320, container.clientWidth);
  const height = Math.max(240, container.clientHeight);
  game.scale.resize(width, height);
}

window.addEventListener('resize', resizeGame);
window.addEventListener('load', resizeGame);
setTimeout(resizeGame, 0);

function renderMapEditorShell(): string {
  return `
    <div class="editor-shell">
      <aside class="sidebar">
        <section>
          <h2>Map</h2>
          <label>ID <input id="map-id" type="text" /></label>
          <label>Title <input id="map-title" type="text" /></label>
          <label class="checkbox-row"><input id="map-wrap-x" type="checkbox" /> Wrap around horizontally</label>
          <div id="map-size-label" class="small-note"></div>
        </section>

        <section>
          <h2>Files</h2>
          <button id="new-map-btn" type="button">New</button>
          <label>Image path <input id="map-image-path" type="text" value="/maps/" /></label>
          <label>Load image <input id="image-file-input" type="file" accept="image/*" /></label>
          <label>Load JSON <input id="json-file-input" type="file" accept=".json,application/json" /></label>
          <label>Save as <input id="save-filename" type="text" value="map.json" /></label>
          <button id="save-json-btn" type="button">Save JSON</button>
        </section>

        <section>
          <h2>Tools</h2>
          <div class="tool-grid">
            <button id="tool-select" type="button">Select</button>
            <button id="tool-rect" type="button">Rectangle</button>
            <button id="tool-ellipse" type="button">Ellipse</button>
            <button id="tool-polygon" type="button">Polygon</button>
            <button id="tool-pan" type="button">Pan</button>
            <button id="fit-view" type="button">Fit view</button>
          </div>
        </section>

        <section>
          <h2>Selected area</h2>
          <div id="selected-area-label" class="small-note">No area selected.</div>
          <label>Area ID <input id="area-id" type="text" /></label>
          <label>Label text <input id="area-label" type="text" /></label>
          <input id="area-icon-file" type="file" accept="image/*" class="visually-hidden-file-input" />
          <div class="asset-picker-row">
            <button id="area-icon-file-btn" type="button">Choose icon</button>
            <button id="area-icon-delete-btn" type="button">Delete icon</button>
          </div>
          <div id="area-icon-file-status" class="small-note">No file chosen.</div>
          <label>Icon base path <input id="area-icon-base-path" type="text" value="/icons/" /></label>
          <div id="area-icon-current-path" class="small-note">No icon selected.</div>
          <div class="subsection-title">Label presentation</div>
          <div class="compact-grid two-col">
            <label>Offset X <input id="area-label-offset-x" type="number" step="1" /></label>
            <label>Offset Y <input id="area-label-offset-y" type="number" step="1" /></label>
          </div>
          <label>Font family <input id="area-label-font-family" type="text" /></label>
          <div class="compact-grid two-col">
            <label>Font size <input id="area-label-font-size" type="number" min="1" step="1" /></label>
            <label>Font color <input id="area-label-color" type="color" value="#ffffff" /></label>
          </div>
          <div class="compact-grid two-col">
            <label>Font style
              <select id="area-label-font-style">
                <option value="">Default</option>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="bold italic">Bold italic</option>
              </select>
            </label>
            <label>Stroke color <input id="area-label-stroke" type="color" value="#000000" /></label>
          </div>
          <label>Stroke thickness <input id="area-label-stroke-thickness" type="number" min="0" step="1" /></label>
          <div class="subsection-title">Background</div>
          <div class="compact-grid two-col">
            <label>Color <input id="area-bg-color" type="color" value="#000000" /></label>
            <label>Color opacity <input id="area-bg-color-opacity" type="number" min="0" max="1" step="0.05" /></label>
          </div>
          <input id="area-bg-image-file" type="file" accept="image/*" class="visually-hidden-file-input" />
          <div class="asset-picker-row">
            <button id="area-bg-image-file-btn" type="button">Choose background image</button>
            <button id="area-bg-image-delete-btn" type="button">Delete background image</button>
          </div>
          <div id="area-bg-image-file-status" class="small-note">No file chosen.</div>
          <label>Background image base path <input id="area-bg-image-base-path" type="text" value="/backgrounds/" /></label>
          <div id="area-bg-image-current-path" class="small-note">No background image selected.</div>
          <label>Image opacity <input id="area-bg-image-opacity" type="number" min="0" max="1" step="0.05" /></label>
          <div class="subsection-title">Icon presentation</div>
          <div class="compact-grid two-col">
            <label>Offset X <input id="area-icon-offset-x" type="number" step="1" /></label>
            <label>Offset Y <input id="area-icon-offset-y" type="number" step="1" /></label>
          </div>
          <div class="compact-grid two-col">
            <label>Width <input id="area-icon-width" type="number" min="1" step="1" /></label>
            <label>Height <input id="area-icon-height" type="number" min="1" step="1" /></label>
          </div>
          <div>Shape type: <strong id="area-shape-type">-</strong></div>
          <label>Coordinates <textarea id="area-coords" rows="8"></textarea></label>
          <div class="button-row">
            <button id="duplicate-btn" type="button">Duplicate</button>
            <button id="delete-btn" type="button">Delete</button>
          </div>
        </section>

        <section>
          <h2>Status</h2>
          <div id="status-line" class="small-note"></div>
        </section>
      </aside>

      <main class="canvas-column">
        <div id="game-container"></div>
      </main>
    </div>
  `;
}

function renderGameEditorShell(): string {
  return `
    <div class="editor-shell scenario-shell">
      <aside class="sidebar scenario-sidebar">
        <section>
          <h2>Game</h2>
          <label>Game ID <input id="game-editor-id" type="text" value="new_game" /></label>
          <label>Name <input id="game-editor-name" type="text" value="New Game" /></label>
          <label>Map JSON path <input id="game-editor-map-json-path" type="text" value="/maps/" /></label>
          <label>Load map JSON <input id="game-editor-map-json-file" type="file" accept=".json,application/json" /></label>
          <label>Load game JSON <input id="game-editor-json-file" type="file" accept=".json,application/json" /></label>
          <button id="new-game-editor-btn" type="button">New</button>
          <label>Save as <input id="game-editor-save-filename" type="text" value="game.json" /></label>
          <div class="button-row">
            <button id="save-game-editor-btn" type="button">Save Game</button>
            <button id="game-editor-fit-view" type="button">Fit view</button>
          </div>
          <div class="button-row">
            <button id="game-editor-back-btn" type="button">Back</button>
            <button id="game-editor-follow-transition-btn" type="button">Follow transition</button>
          </div>
          <div id="game-editor-current-map" class="small-note">No map loaded.</div>
          <div id="game-editor-current-path" class="small-note">No map JSON path set.</div>
          <div id="game-editor-configured-areas" class="small-note">Configured areas: 0 / 0</div>
        </section>

        <section>
          <h2>Selected Area</h2>
          <div id="game-editor-selected-area" class="small-note">No area selected.</div>
          <div id="game-editor-selected-area-meta" class="small-note"></div>
        </section>

        <section>
          <h2>Player / Tasks</h2>
          <div class="small-note">Player state and task editing will live here next. This first pass focuses on multi-map area behavior and transitions.</div>
        </section>

        <section>
          <h2>Status</h2>
          <div id="game-editor-status-line" class="small-note"></div>
        </section>
      </aside>

      <main class="scenario-main">
        <div class="scenario-canvas">
          <div id="game-container"></div>
        </div>
        <section class="scenario-inspector">
          <div class="scenario-inspector-header">
            <h2>Map Behavior</h2>
            <div class="small-note">Click an area to edit its game-specific behavior, visibility, and transitions.</div>
          </div>
          <div class="scenario-inspector-grid">
            <section class="scenario-panel">
              <h3>Display</h3>
              <label class="checkbox-row"><input id="game-editor-display-label" type="checkbox" /> Show label</label>
              <label class="checkbox-row"><input id="game-editor-display-icon" type="checkbox" /> Show icon</label>
              <label class="checkbox-row"><input id="game-editor-display-background" type="checkbox" /> Show background</label>
            </section>

            <section class="scenario-panel">
              <h3>Transition</h3>
              <input id="game-editor-transition-map-file" type="file" accept=".json,application/json" class="visually-hidden-file-input" />
              <div class="asset-picker-row">
                <button id="game-editor-transition-map-file-btn" type="button">Choose target map JSON</button>
              </div>
              <div id="game-editor-transition-map-file-status" class="small-note">No file chosen.</div>
              <label>Target map id <input id="game-editor-transition-map-id" type="text" /></label>
              <label>Target map JSON path <input id="game-editor-transition-map-path" type="text" /></label>
              <div id="game-editor-transition-return" class="small-note"></div>
            </section>

            <section class="scenario-panel">
              <h3>On Enter</h3>
              <div id="game-editor-enter-actions-list"></div>
              <button id="game-editor-add-enter-action" type="button">Add Enter Action</button>
              <label>Message <textarea id="game-editor-enter-message" rows="3"></textarea></label>
              <label>Seconds <input id="game-editor-enter-message-seconds" type="number" min="0" step="0.1" /></label>
            </section>

            <section class="scenario-panel">
              <h3>On Exit</h3>
              <div id="game-editor-exit-actions-list"></div>
              <button id="game-editor-add-exit-action" type="button">Add Exit Action</button>
              <label>Message <textarea id="game-editor-exit-message" rows="3"></textarea></label>
              <label>Seconds <input id="game-editor-exit-message-seconds" type="number" min="0" step="0.1" /></label>
            </section>

            <section class="scenario-panel">
              <h3>Permissions</h3>
              <div id="game-editor-permissions-list"></div>
              <button id="game-editor-add-permission" type="button">Add Permission</button>
            </section>

            <section class="scenario-panel">
              <h3>Questions / Answers</h3>
              <div id="game-editor-qa-list"></div>
              <button id="game-editor-add-qa" type="button">Add Q&amp;A</button>
            </section>
          </div>
        </section>
      </main>
    </div>
  `;
}

function renderGameShell(): string {
  return `
    <div class="editor-shell game-shell">
      <aside class="sidebar game-sidebar">
        <section>
          <h2>Game</h2>
          <label>Load game JSON <input id="game-scenario-json-file" type="file" accept=".json,application/json" /></label>
          <button id="game-fit-view" type="button">Fit view</button>
          <div id="game-scenario-info" class="small-note">No game loaded.</div>
          <div id="game-map-info" class="small-note">No map loaded.</div>
        </section>

        <section>
          <h2>Player</h2>
          <div class="small-note">Use the arrow keys to move across the map.</div>
          <div id="game-player-position" class="small-note">Player position: 0, 0</div>
        </section>

        <section>
          <h2>Store</h2>
          <div id="game-store-list" class="store-list">
            <div class="small-note">Store is empty.</div>
          </div>
        </section>

        <section>
          <h2>Status</h2>
          <div id="game-status-line" class="small-note"></div>
        </section>
      </aside>

      <main class="canvas-column">
        <div id="game-container"></div>
      </main>
    </div>
  `;
}

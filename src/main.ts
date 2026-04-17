import Phaser from 'phaser';
import { MapEditorScene } from './MapEditorScene';
import './styles.css';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app root');
}

app.innerHTML = `
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

const scene = new MapEditorScene();

const game = new Phaser.Game({
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

function resizeGame(): void {
  const container = document.getElementById('game-container');
  if (!container) return;
  const width = Math.max(320, container.clientWidth);
  const height = Math.max(240, container.clientHeight);
  game.scale.resize(width, height);
}

window.addEventListener('resize', resizeGame);
window.addEventListener('load', resizeGame);
setTimeout(resizeGame, 0);

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
        <label>Image path <input id="map-image-path" type="text" /></label>
        <label class="checkbox-row"><input id="map-wrap-x" type="checkbox" /> Wrap around horizontally</label>
        <div id="map-size-label" class="small-note"></div>
      </section>

      <section>
        <h2>Files</h2>
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
        <label>Icon path <input id="area-icon-path" type="text" /></label>
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

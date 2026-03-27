# Phaser Map Editor

A Phaser 3 + TypeScript starter editor for map-based games.

## Features included

- Load a map image from a local file.
- Create rectangle, ellipse, and polygon areas.
- Select areas by clicking them.
- Move areas by dragging.
- Resize rectangles from the corners.
- Resize ellipses from top, bottom, left, and right handles.
- Resize polygons by dragging vertices.
- Delete selected area with the Delete key or button.
- Duplicate selected area.
- Edit map metadata and area metadata in the side panel.
- Edit shape JSON directly in the side panel.
- Save the map JSON to a chosen filename.
- Zoom with the mouse wheel.
- Pan with the Pan tool, middle mouse button, or right mouse button.
- Fit the whole map into the current view.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Coordinates are stored in map-image world coordinates, not screen coordinates.
- Browser resizing changes only the view/camera, not saved coordinates.
- Polygon closing uses a screen-pixel tolerance, so it behaves consistently across zoom levels.
- The `iconPath` field is saved in JSON and editable in the UI, but this starter does not yet implement a full local icon asset browser/loader. That is the next obvious improvement.
- The editor uses ellipses rather than only circles, because ellipse creation is defined by the dragged bounding rectangle.

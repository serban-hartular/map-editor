import type { AreaShape, MapArea, MapData, ToolMode } from '../types';

export interface EditorDomRefs {
  mapIdInput: HTMLInputElement;
  mapTitleInput: HTMLInputElement;
  imagePathInput: HTMLInputElement;
  wrapXInput: HTMLInputElement;
  mapSizeLabel: HTMLElement;
  selectedAreaLabel: HTMLElement;
  areaIdInput: HTMLInputElement;
  areaLabelInput: HTMLInputElement;
  areaIconPathInput: HTMLInputElement;
  areaShapeType: HTMLElement;
  areaCoordsText: HTMLTextAreaElement;
  toolButtons: Record<ToolMode, HTMLButtonElement>;
  duplicateButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  saveJsonButton: HTMLButtonElement;
  saveFilenameInput: HTMLInputElement;
  jsonFileInput: HTMLInputElement;
  imageFileInput: HTMLInputElement;
  fitButton: HTMLButtonElement;
  statusLine: HTMLElement;
}

export interface DomEventHandlers {
  onMapIdInput: () => void;
  onMapTitleInput: () => void;
  onImagePathInput: () => void;
  onWrapXChange: () => void;
  onAreaIdInput: () => void;
  onAreaLabelInput: () => void;
  onAreaIconPathInput: () => void;
  onAreaCoordsChange: () => void;
  onToolSelect: () => void;
  onToolRect: () => void;
  onToolEllipse: () => void;
  onToolPolygon: () => void;
  onToolPan: () => void;
  onFitView: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveJson: () => void;
  onLoadImage: () => void;
  onLoadJson: () => void;
  onDeleteKey: () => void;
  onEscapeKey: () => void;
  onDuplicateKey: () => void;
}

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element #${id}`);
  }
  return el as T;
}

export function getEditorDomRefs(): EditorDomRefs {
  return {
    mapIdInput: must<HTMLInputElement>('map-id'),
    mapTitleInput: must<HTMLInputElement>('map-title'),
    imagePathInput: must<HTMLInputElement>('map-image-path'),
    wrapXInput: must<HTMLInputElement>('map-wrap-x'),
    mapSizeLabel: must<HTMLElement>('map-size-label'),
    selectedAreaLabel: must<HTMLElement>('selected-area-label'),
    areaIdInput: must<HTMLInputElement>('area-id'),
    areaLabelInput: must<HTMLInputElement>('area-label'),
    areaIconPathInput: must<HTMLInputElement>('area-icon-path'),
    areaShapeType: must<HTMLElement>('area-shape-type'),
    areaCoordsText: must<HTMLTextAreaElement>('area-coords'),
    toolButtons: {
      select: must<HTMLButtonElement>('tool-select'),
      drawRect: must<HTMLButtonElement>('tool-rect'),
      drawEllipse: must<HTMLButtonElement>('tool-ellipse'),
      drawPolygon: must<HTMLButtonElement>('tool-polygon'),
      pan: must<HTMLButtonElement>('tool-pan')
    },
    duplicateButton: must<HTMLButtonElement>('duplicate-btn'),
    deleteButton: must<HTMLButtonElement>('delete-btn'),
    saveJsonButton: must<HTMLButtonElement>('save-json-btn'),
    saveFilenameInput: must<HTMLInputElement>('save-filename'),
    jsonFileInput: must<HTMLInputElement>('json-file-input'),
    imageFileInput: must<HTMLInputElement>('image-file-input'),
    fitButton: must<HTMLButtonElement>('fit-view'),
    statusLine: must<HTMLElement>('status-line')
  };
}

export function bindEditorDomEvents(dom: EditorDomRefs, handlers: DomEventHandlers): void {
  dom.mapIdInput.addEventListener('input', handlers.onMapIdInput);
  dom.mapTitleInput.addEventListener('input', handlers.onMapTitleInput);
  dom.imagePathInput.addEventListener('input', handlers.onImagePathInput);
  dom.wrapXInput.addEventListener('change', handlers.onWrapXChange);

  dom.areaIdInput.addEventListener('input', handlers.onAreaIdInput);
  dom.areaLabelInput.addEventListener('input', handlers.onAreaLabelInput);
  dom.areaIconPathInput.addEventListener('input', handlers.onAreaIconPathInput);
  dom.areaCoordsText.addEventListener('change', handlers.onAreaCoordsChange);

  dom.toolButtons.select.addEventListener('click', handlers.onToolSelect);
  dom.toolButtons.drawRect.addEventListener('click', handlers.onToolRect);
  dom.toolButtons.drawEllipse.addEventListener('click', handlers.onToolEllipse);
  dom.toolButtons.drawPolygon.addEventListener('click', handlers.onToolPolygon);
  dom.toolButtons.pan.addEventListener('click', handlers.onToolPan);
  dom.fitButton.addEventListener('click', handlers.onFitView);

  dom.duplicateButton.addEventListener('click', handlers.onDuplicate);
  dom.deleteButton.addEventListener('click', handlers.onDelete);
  dom.saveJsonButton.addEventListener('click', handlers.onSaveJson);
  dom.imageFileInput.addEventListener('change', handlers.onLoadImage);
  dom.jsonFileInput.addEventListener('change', handlers.onLoadJson);

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    const editingText = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

    if (event.key === 'Delete' && !editingText) {
      event.preventDefault();
      handlers.onDeleteKey();
      return;
    }

    if (event.key === 'Escape') {
      handlers.onEscapeKey();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && !editingText) {
      event.preventDefault();
      handlers.onDuplicateKey();
    }
  });
}

export function refreshMapMetadataUI(dom: EditorDomRefs, mapData: MapData): void {
  dom.mapIdInput.value = mapData.id;
  dom.mapTitleInput.value = mapData.title;
  dom.imagePathInput.value = mapData.imagePath;
  dom.wrapXInput.checked = mapData.wrapX;
  dom.mapSizeLabel.textContent = `Map size: ${mapData.mapWidth} x ${mapData.mapHeight}`;
}

export function refreshSelectionUI(
  dom: EditorDomRefs,
  selectedArea: MapArea | null,
  updateText = true
): void {
  const disabled = !selectedArea;
  dom.areaIdInput.disabled = disabled;
  dom.areaLabelInput.disabled = disabled;
  dom.areaIconPathInput.disabled = disabled;
  dom.areaCoordsText.disabled = disabled;
  dom.duplicateButton.disabled = disabled;
  dom.deleteButton.disabled = disabled;

  if (!selectedArea) {
    dom.selectedAreaLabel.textContent = 'No area selected.';
    dom.areaIdInput.value = '';
    dom.areaLabelInput.value = '';
    dom.areaIconPathInput.value = '';
    dom.areaShapeType.textContent = '-';
    dom.areaCoordsText.value = '';
    return;
  }

  dom.selectedAreaLabel.textContent = `Selected: ${selectedArea.id}`;
  dom.areaIdInput.value = selectedArea.id;
  dom.areaLabelInput.value = selectedArea.label;
  dom.areaIconPathInput.value = selectedArea.iconPath;
  dom.areaShapeType.textContent = selectedArea.shape.type;
  if (updateText) {
    dom.areaCoordsText.value = JSON.stringify(selectedArea.shape, null, 2);
  }
}

export function updateToolButtons(dom: EditorDomRefs, toolMode: ToolMode): void {
  Object.entries(dom.toolButtons).forEach(([mode, button]) => {
    button.classList.toggle('active', mode === toolMode);
  });
}

export function setStatus(dom: EditorDomRefs, text: string): void {
  dom.statusLine.textContent = text;
}

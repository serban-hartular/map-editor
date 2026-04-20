import type { AreaShape, MapArea, MapData, ToolMode } from '../types';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR_OPACITY,
  DEFAULT_BACKGROUND_IMAGE_OPACITY,
  DEFAULT_ICON_SIZE,
  DEFAULT_LABEL_STYLE,
  getDefaultIconOffset,
  getDefaultLabelOffset
} from '../area/presentationDefaults';

export interface EditorDomRefs {
  mapIdInput: HTMLInputElement;
  mapTitleInput: HTMLInputElement;
  wrapXInput: HTMLInputElement;
  mapSizeLabel: HTMLElement;
  selectedAreaLabel: HTMLElement;
  areaIdInput: HTMLInputElement;
  areaLabelInput: HTMLInputElement;
  areaIconFileInput: HTMLInputElement;
  areaIconFileButton: HTMLButtonElement;
  areaIconDeleteButton: HTMLButtonElement;
  areaIconFileStatus: HTMLElement;
  areaIconBasePathInput: HTMLInputElement;
  areaIconCurrentPath: HTMLElement;
  areaLabelOffsetXInput: HTMLInputElement;
  areaLabelOffsetYInput: HTMLInputElement;
  areaLabelFontFamilyInput: HTMLInputElement;
  areaLabelFontSizeInput: HTMLInputElement;
  areaLabelColorInput: HTMLInputElement;
  areaLabelFontStyleInput: HTMLSelectElement;
  areaLabelStrokeInput: HTMLInputElement;
  areaLabelStrokeThicknessInput: HTMLInputElement;
  areaBackgroundColorInput: HTMLInputElement;
  areaBackgroundColorOpacityInput: HTMLInputElement;
  areaBackgroundImageFileInput: HTMLInputElement;
  areaBackgroundImageFileButton: HTMLButtonElement;
  areaBackgroundImageDeleteButton: HTMLButtonElement;
  areaBackgroundImageFileStatus: HTMLElement;
  areaBackgroundImageBasePathInput: HTMLInputElement;
  areaBackgroundImageCurrentPath: HTMLElement;
  areaBackgroundImageOpacityInput: HTMLInputElement;
  areaIconOffsetXInput: HTMLInputElement;
  areaIconOffsetYInput: HTMLInputElement;
  areaIconWidthInput: HTMLInputElement;
  areaIconHeightInput: HTMLInputElement;
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
  newMapBtn: HTMLButtonElement;
  mapImagePathInput: HTMLInputElement;
}

export interface DomEventHandlers {
  onNew: () => void;
  onMapImagePathChange: (value: string) => void;
  onMapIdInput: () => void;
  onMapTitleInput: () => void;
  onWrapXChange: () => void;
  onAreaIdInput: () => void;
  onAreaLabelInput: () => void;
  onAreaIconFileChange: () => void;
  onAreaIconChooseClick: () => void;
  onAreaIconDeleteClick: () => void;
  onAreaIconBasePathInput: () => void;
  onAreaBackgroundImageFileChange: () => void;
  onAreaBackgroundImageChooseClick: () => void;
  onAreaBackgroundImageDeleteClick: () => void;
  onAreaBackgroundImageBasePathInput: () => void;
  onAreaPresentationInput: () => void;
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
    wrapXInput: must<HTMLInputElement>('map-wrap-x'),
    mapSizeLabel: must<HTMLElement>('map-size-label'),
    selectedAreaLabel: must<HTMLElement>('selected-area-label'),
    areaIdInput: must<HTMLInputElement>('area-id'),
    areaLabelInput: must<HTMLInputElement>('area-label'),
    areaIconFileInput: must<HTMLInputElement>('area-icon-file'),
    areaIconFileButton: must<HTMLButtonElement>('area-icon-file-btn'),
    areaIconDeleteButton: must<HTMLButtonElement>('area-icon-delete-btn'),
    areaIconFileStatus: must<HTMLElement>('area-icon-file-status'),
    areaIconBasePathInput: must<HTMLInputElement>('area-icon-base-path'),
    areaIconCurrentPath: must<HTMLElement>('area-icon-current-path'),
    areaLabelOffsetXInput: must<HTMLInputElement>('area-label-offset-x'),
    areaLabelOffsetYInput: must<HTMLInputElement>('area-label-offset-y'),
    areaLabelFontFamilyInput: must<HTMLInputElement>('area-label-font-family'),
    areaLabelFontSizeInput: must<HTMLInputElement>('area-label-font-size'),
    areaLabelColorInput: must<HTMLInputElement>('area-label-color'),
    areaLabelFontStyleInput: must<HTMLSelectElement>('area-label-font-style'),
    areaLabelStrokeInput: must<HTMLInputElement>('area-label-stroke'),
    areaLabelStrokeThicknessInput: must<HTMLInputElement>('area-label-stroke-thickness'),
    areaBackgroundColorInput: must<HTMLInputElement>('area-bg-color'),
    areaBackgroundColorOpacityInput: must<HTMLInputElement>('area-bg-color-opacity'),
    areaBackgroundImageFileInput: must<HTMLInputElement>('area-bg-image-file'),
    areaBackgroundImageFileButton: must<HTMLButtonElement>('area-bg-image-file-btn'),
    areaBackgroundImageDeleteButton: must<HTMLButtonElement>('area-bg-image-delete-btn'),
    areaBackgroundImageFileStatus: must<HTMLElement>('area-bg-image-file-status'),
    areaBackgroundImageBasePathInput: must<HTMLInputElement>('area-bg-image-base-path'),
    areaBackgroundImageCurrentPath: must<HTMLElement>('area-bg-image-current-path'),
    areaBackgroundImageOpacityInput: must<HTMLInputElement>('area-bg-image-opacity'),
    areaIconOffsetXInput: must<HTMLInputElement>('area-icon-offset-x'),
    areaIconOffsetYInput: must<HTMLInputElement>('area-icon-offset-y'),
    areaIconWidthInput: must<HTMLInputElement>('area-icon-width'),
    areaIconHeightInput: must<HTMLInputElement>('area-icon-height'),
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
    statusLine: must<HTMLElement>('status-line'),
    newMapBtn: must<HTMLButtonElement>('new-map-btn'),
    mapImagePathInput: must<HTMLInputElement>('map-image-path')
  };
}

export function bindEditorDomEvents(dom: EditorDomRefs, handlers: DomEventHandlers): void {
  dom.newMapBtn.addEventListener('click', handlers.onNew);
  dom.mapImagePathInput.addEventListener('input', () => {
    handlers.onMapImagePathChange(dom.mapImagePathInput.value);
  });

  dom.mapIdInput.addEventListener('input', handlers.onMapIdInput);
  dom.mapTitleInput.addEventListener('input', handlers.onMapTitleInput);
  dom.wrapXInput.addEventListener('change', handlers.onWrapXChange);

  dom.areaIdInput.addEventListener('input', handlers.onAreaIdInput);
  dom.areaLabelInput.addEventListener('input', handlers.onAreaLabelInput);
  dom.areaIconFileButton.addEventListener('click', handlers.onAreaIconChooseClick);
  dom.areaIconFileInput.addEventListener('change', handlers.onAreaIconFileChange);
  dom.areaIconDeleteButton.addEventListener('click', handlers.onAreaIconDeleteClick);
  dom.areaIconBasePathInput.addEventListener('input', handlers.onAreaIconBasePathInput);
  dom.areaBackgroundImageFileButton.addEventListener('click', handlers.onAreaBackgroundImageChooseClick);
  dom.areaBackgroundImageFileInput.addEventListener('change', handlers.onAreaBackgroundImageFileChange);
  dom.areaBackgroundImageDeleteButton.addEventListener('click', handlers.onAreaBackgroundImageDeleteClick);
  dom.areaBackgroundImageBasePathInput.addEventListener('input', handlers.onAreaBackgroundImageBasePathInput);
  [
    dom.areaLabelOffsetXInput,
    dom.areaLabelOffsetYInput,
    dom.areaLabelFontFamilyInput,
    dom.areaLabelFontSizeInput,
    dom.areaLabelColorInput,
    dom.areaLabelFontStyleInput,
    dom.areaLabelStrokeInput,
    dom.areaLabelStrokeThicknessInput,
    dom.areaBackgroundColorInput,
    dom.areaBackgroundColorOpacityInput,
    dom.areaBackgroundImageOpacityInput,
    dom.areaIconOffsetXInput,
    dom.areaIconOffsetYInput,
    dom.areaIconWidthInput,
    dom.areaIconHeightInput
  ].forEach((input) => {
    input.addEventListener('input', handlers.onAreaPresentationInput);
    input.addEventListener('change', handlers.onAreaPresentationInput);
  });
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

  if (activeKeydownHandler) {
    window.removeEventListener('keydown', activeKeydownHandler);
  }
  activeKeydownHandler = (event: KeyboardEvent) => {
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
  };
  window.addEventListener('keydown', activeKeydownHandler);
}

let activeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

export function refreshMapMetadataUI(dom: EditorDomRefs, mapData: MapData, imageBasePath: string): void {
  dom.mapIdInput.value = mapData.id;
  dom.mapTitleInput.value = mapData.title;
  dom.mapImagePathInput.value = imageBasePath;
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
  dom.areaIconFileInput.disabled = disabled;
  dom.areaIconFileButton.disabled = disabled;
  dom.areaIconDeleteButton.disabled = disabled;
  dom.areaIconBasePathInput.disabled = disabled;
  dom.areaLabelOffsetXInput.disabled = disabled;
  dom.areaLabelOffsetYInput.disabled = disabled;
  dom.areaLabelFontFamilyInput.disabled = disabled;
  dom.areaLabelFontSizeInput.disabled = disabled;
  dom.areaLabelColorInput.disabled = disabled;
  dom.areaLabelFontStyleInput.disabled = disabled;
  dom.areaLabelStrokeInput.disabled = disabled;
  dom.areaLabelStrokeThicknessInput.disabled = disabled;
  dom.areaBackgroundColorInput.disabled = disabled;
  dom.areaBackgroundColorOpacityInput.disabled = disabled;
  dom.areaBackgroundImageFileInput.disabled = disabled;
  dom.areaBackgroundImageFileButton.disabled = disabled;
  dom.areaBackgroundImageDeleteButton.disabled = disabled;
  dom.areaBackgroundImageBasePathInput.disabled = disabled;
  dom.areaBackgroundImageOpacityInput.disabled = disabled;
  dom.areaIconOffsetXInput.disabled = disabled;
  dom.areaIconOffsetYInput.disabled = disabled;
  dom.areaIconWidthInput.disabled = disabled;
  dom.areaIconHeightInput.disabled = disabled;
  dom.areaCoordsText.disabled = disabled;
  dom.duplicateButton.disabled = disabled;
  dom.deleteButton.disabled = disabled;

  if (!selectedArea) {
    dom.selectedAreaLabel.textContent = 'No area selected.';
    dom.areaIdInput.value = '';
    dom.areaLabelInput.value = '';
    dom.areaIconFileInput.value = '';
    dom.areaIconFileStatus.textContent = 'No file chosen.';
    dom.areaIconBasePathInput.value = '/icons/';
    dom.areaIconCurrentPath.textContent = 'No icon selected.';
    dom.areaLabelOffsetXInput.value = String(getDefaultLabelOffset(false).x);
    dom.areaLabelOffsetYInput.value = String(getDefaultLabelOffset(false).y);
    dom.areaLabelFontFamilyInput.value = DEFAULT_LABEL_STYLE.fontFamily;
    dom.areaLabelFontSizeInput.value = String(DEFAULT_LABEL_STYLE.fontSize);
    dom.areaLabelColorInput.value = DEFAULT_LABEL_STYLE.color;
    dom.areaLabelFontStyleInput.value = DEFAULT_LABEL_STYLE.fontStyle;
    dom.areaLabelStrokeInput.value = DEFAULT_LABEL_STYLE.stroke;
    dom.areaLabelStrokeThicknessInput.value = String(DEFAULT_LABEL_STYLE.strokeThickness);
    dom.areaBackgroundColorInput.value = DEFAULT_BACKGROUND_COLOR;
    dom.areaBackgroundColorOpacityInput.value = String(DEFAULT_BACKGROUND_COLOR_OPACITY);
    dom.areaBackgroundImageFileInput.value = '';
    dom.areaBackgroundImageFileStatus.textContent = 'No file chosen.';
    dom.areaBackgroundImageBasePathInput.value = '/backgrounds/';
    dom.areaBackgroundImageCurrentPath.textContent = 'No background image selected.';
    dom.areaBackgroundImageOpacityInput.value = String(DEFAULT_BACKGROUND_IMAGE_OPACITY);
    dom.areaIconOffsetXInput.value = '0';
    dom.areaIconOffsetYInput.value = '0';
    dom.areaIconWidthInput.value = String(DEFAULT_ICON_SIZE);
    dom.areaIconHeightInput.value = String(DEFAULT_ICON_SIZE);
    dom.areaShapeType.textContent = '-';
    dom.areaCoordsText.value = '';
    return;
  }

  dom.selectedAreaLabel.textContent = `Selected: ${selectedArea.id}`;
  dom.areaIdInput.value = selectedArea.id;
  const labelText = selectedArea.presentation?.label?.text ?? selectedArea.label;
  const iconPath = selectedArea.presentation?.icon?.path ?? selectedArea.iconPath;
  const hasLabel = Boolean(labelText.trim());
  const hasIcon = Boolean(iconPath.trim());
  const defaultLabelOffset = getDefaultLabelOffset(hasIcon);
  const defaultIconOffset = getDefaultIconOffset(hasLabel);

  dom.areaLabelInput.value = labelText;
  dom.areaIconFileInput.value = '';
  dom.areaIconFileStatus.textContent = iconPath ? `Chosen: ${splitAssetPath(iconPath, '/icons/').fileName}` : 'No file chosen.';
  const { basePath: iconBasePath } = splitAssetPath(iconPath, '/icons/');
  dom.areaIconBasePathInput.value = iconBasePath;
  dom.areaIconCurrentPath.textContent = iconPath || 'No icon selected.';
  dom.areaLabelOffsetXInput.value = String(selectedArea.presentation?.label?.offset?.x ?? defaultLabelOffset.x);
  dom.areaLabelOffsetYInput.value = String(selectedArea.presentation?.label?.offset?.y ?? defaultLabelOffset.y);
  dom.areaLabelFontFamilyInput.value = selectedArea.presentation?.label?.style?.fontFamily ?? DEFAULT_LABEL_STYLE.fontFamily;
  dom.areaLabelFontSizeInput.value = String(selectedArea.presentation?.label?.style?.fontSize ?? DEFAULT_LABEL_STYLE.fontSize);
  dom.areaLabelColorInput.value = normalizeColorInput(selectedArea.presentation?.label?.style?.color, DEFAULT_LABEL_STYLE.color);
  dom.areaLabelFontStyleInput.value = selectedArea.presentation?.label?.style?.fontStyle ?? DEFAULT_LABEL_STYLE.fontStyle;
  dom.areaLabelStrokeInput.value = normalizeColorInput(selectedArea.presentation?.label?.style?.stroke, DEFAULT_LABEL_STYLE.stroke);
  dom.areaLabelStrokeThicknessInput.value = String(
    selectedArea.presentation?.label?.style?.strokeThickness ?? DEFAULT_LABEL_STYLE.strokeThickness
  );
  dom.areaBackgroundColorInput.value = normalizeColorInput(
    selectedArea.presentation?.background?.color?.value,
    DEFAULT_BACKGROUND_COLOR
  );
  dom.areaBackgroundColorOpacityInput.value = String(
    selectedArea.presentation?.background?.color?.opacity ?? DEFAULT_BACKGROUND_COLOR_OPACITY
  );
  const backgroundImagePath = selectedArea.presentation?.background?.image?.path ?? '';
  const { basePath: backgroundImageBasePath } = splitAssetPath(backgroundImagePath, '/backgrounds/');
  dom.areaBackgroundImageFileInput.value = '';
  dom.areaBackgroundImageFileStatus.textContent = backgroundImagePath
    ? `Chosen: ${splitAssetPath(backgroundImagePath, '/backgrounds/').fileName}`
    : 'No file chosen.';
  dom.areaBackgroundImageBasePathInput.value = backgroundImageBasePath;
  dom.areaBackgroundImageCurrentPath.textContent = backgroundImagePath || 'No background image selected.';
  dom.areaBackgroundImageOpacityInput.value = String(
    selectedArea.presentation?.background?.image?.opacity ?? DEFAULT_BACKGROUND_IMAGE_OPACITY
  );
  dom.areaIconOffsetXInput.value = String(selectedArea.presentation?.icon?.offset?.x ?? defaultIconOffset.x);
  dom.areaIconOffsetYInput.value = String(selectedArea.presentation?.icon?.offset?.y ?? defaultIconOffset.y);
  dom.areaIconWidthInput.value = String(selectedArea.presentation?.icon?.width ?? DEFAULT_ICON_SIZE);
  dom.areaIconHeightInput.value = String(selectedArea.presentation?.icon?.height ?? DEFAULT_ICON_SIZE);
  dom.areaShapeType.textContent = selectedArea.shape.type;
  if (updateText) {
    dom.areaCoordsText.value = JSON.stringify(selectedArea.shape, null, 2);
  }
}

function normalizeColorInput(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : fallback;
}

function splitAssetPath(fullPath: string, fallbackBasePath: string): { basePath: string; fileName: string } {
  const trimmed = fullPath.trim();
  if (!trimmed) {
    return { basePath: fallbackBasePath, fileName: '' };
  }

  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash === -1) {
    return { basePath: fallbackBasePath, fileName: trimmed };
  }

  const basePath = trimmed.slice(0, lastSlash + 1) || fallbackBasePath;
  return {
    basePath,
    fileName: trimmed.slice(lastSlash + 1)
  };
}

export function updateToolButtons(dom: EditorDomRefs, toolMode: ToolMode): void {
  Object.entries(dom.toolButtons).forEach(([mode, button]) => {
    button.classList.toggle('active', mode === toolMode);
  });
}

export function setStatus(dom: EditorDomRefs, text: string): void {
  dom.statusLine.textContent = text;
}

import type { AreaLabelStyle, AreaOffset } from '../types';

export const DEFAULT_LABEL_STYLE: Required<AreaLabelStyle> = {
  fontFamily: 'Arial',
  fontSize: 20,
  color: '#ffffff',
  fontStyle: 'normal',
  stroke: '#000000',
  strokeThickness: 3
};

export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_BACKGROUND_COLOR_OPACITY = 0.15;
export const DEFAULT_BACKGROUND_IMAGE_OPACITY = 0.5;
export const DEFAULT_ICON_SIZE = 32;

export function getDefaultLabelOffset(hasIcon: boolean): AreaOffset {
  return hasIcon ? { x: 20, y: 0 } : { x: 0, y: -14 };
}

export function getDefaultIconOffset(hasLabel: boolean): AreaOffset {
  return hasLabel ? { x: -18, y: 0 } : { x: 0, y: 0 };
}

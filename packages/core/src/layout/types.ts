import type { WidgetConfig } from '../types/widget';
import type { Color } from '../types/color';

export interface MeasureResult {
  readonly minWidth: number;
  readonly preferredWidth: number;
  readonly maxWidth: number;
  readonly content: string;
  readonly truncatable: boolean;
}

export interface LayoutBox {
  readonly id: string;
  readonly widget: WidgetConfig;
  readonly content: string;
  readonly width: number;
  readonly start: number;
  readonly end: number;
  readonly isFlex: boolean;
  readonly truncated: boolean;
}

export interface StyledBox extends LayoutBox {
  readonly fg: Color;
  readonly bg: Color;
  readonly bold: boolean;
}

export interface Layout {
  readonly boxes: readonly LayoutBox[];
  readonly totalWidth: number;
  readonly overflow: boolean;
  readonly availableWidth: number;
  // Something was shortened or left out to make the line fit
  readonly clipped?: boolean;
}

export interface LayoutConstraints {
  readonly maxWidth: number;
  readonly minContentWidth: number;
  readonly defaultSeparator: string;
  readonly defaultPadding: string;
  // Columns the renderer adds around every widget, and once per line
  readonly boxOverhead?: number;
  readonly lineOverhead?: number;
}

export type { FlexMode } from '../types/settings';

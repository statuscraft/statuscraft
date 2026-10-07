import type { WidgetConfig } from '../types/widget';
import type { Settings } from '../types/settings';

import type { LayoutBox, StyledBox } from '../layout/types';

export interface RenderContext {
  readonly lineIndex: number;
  // How full the context is, for the full-until-compact width
  readonly contextPercent?: number;
}

export interface RendererPlugin {
  readonly name: string;

  readonly priority: number;

  canHandle(settings: Settings): boolean;

  preLayout?(
    widgets: readonly WidgetConfig[],
    settings: Settings
  ): readonly WidgetConfig[];

  // Columns drawn around each widget and once per line, so the layout can leave room for them
  overhead?(
    widgets: readonly WidgetConfig[],
    settings: Settings
  ): { box: number; line: number };

  insertSeparators(
    boxes: readonly LayoutBox[],
    settings: Settings
  ): readonly LayoutBox[];

  applyStyles(
    boxes: readonly LayoutBox[],
    settings: Settings,
    context: RenderContext
  ): readonly StyledBox[];

  render(
    boxes: readonly StyledBox[],
    settings: Settings,
    context: RenderContext
  ): string;

  postRender?(output: string, settings: Settings): string;
}

export interface RenderResult {
  readonly output: string;
  readonly pluginName: string;
  readonly visibleLength: number;
  readonly truncated: boolean;
}

export interface PowerlineThemeColors {
  readonly fg: readonly string[];
  readonly bg: readonly string[];
}

export interface PowerlineTheme {
  readonly name: string;
  readonly description: string;
  readonly 1?: PowerlineThemeColors;  // ANSI 16
  readonly 2?: PowerlineThemeColors;  // ANSI 256
  readonly 3?: PowerlineThemeColors;  // TrueColor
}

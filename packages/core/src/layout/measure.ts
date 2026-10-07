import type { WidgetConfig } from '../types/widget';
import type { MeasureResult } from './types';
import { LAYOUT } from '../ansi/constants';
import { visibleLength } from '../ansi/builder';

export function measureWidget(
  content: string | null,
  widget: WidgetConfig
): MeasureResult {
  if (widget.type === 'flex-separator') {
    return {
      minWidth: 0,
      preferredWidth: 0,
      maxWidth: Infinity,
      content: '',
      truncatable: false,
    };
  }

  if (widget.type === 'separator') {
    const char = widget.character ?? (content || '|');
    return {
      minWidth: char.length,
      preferredWidth: char.length,
      maxWidth: char.length,
      content: char,
      truncatable: false,
    };
  }

  if (!content || content.length === 0) {
    return {
      minWidth: 0,
      preferredWidth: 0,
      maxWidth: 0,
      content: '',
      truncatable: false,
    };
  }

  const length = visibleLength(content);

  if (widget.type === 'custom-command' && widget.maxWidth) {
    return {
      minWidth: LAYOUT.MIN_CONTENT_WIDTH,
      preferredWidth: Math.min(length, widget.maxWidth),
      maxWidth: widget.maxWidth,
      content,
      truncatable: true,
    };
  }

  return {
    minWidth: LAYOUT.MIN_CONTENT_WIDTH,
    preferredWidth: length,
    maxWidth: length,
    content,
    truncatable: true,
  };
}

export function measureLine(
  widgets: readonly WidgetConfig[],
  contents: readonly (string | null)[]
): readonly MeasureResult[] {
  return widgets.map((widget, i) => measureWidget(contents[i] ?? null, widget));
}

export function totalPreferredWidth(measurements: readonly MeasureResult[]): number {
  return measurements.reduce((sum, m) => sum + m.preferredWidth, 0);
}

export function countFlexSeparators(widgets: readonly WidgetConfig[]): number {
  return widgets.filter(w => w.type === 'flex-separator').length;
}

import type { WidgetConfig } from '../types/widget';
import type {
  LayoutBox,
  Layout,
  LayoutConstraints,
  MeasureResult,
} from './types';
import { measureWidget } from './measure';
import { LAYOUT } from '../ansi/constants';
import { stripAnsi } from '../ansi/builder';

export class LayoutEngine {
  layout(
    widgets: readonly WidgetConfig[],
    contents: readonly (string | null)[],
    constraints: LayoutConstraints
  ): Layout {
    const activeWidgets: Array<{
      widget: WidgetConfig;
      content: string;
      measure: MeasureResult;
      index: number;
    }> = [];

    widgets.forEach((widget, index) => {
      const content = contents[index];

      if (widget.type === 'flex-separator') {
        activeWidgets.push({
          widget,
          content: '',
          measure: measureWidget(null, widget),
          index,
        });
        return;
      }

      if (widget.type === 'separator') {
        const char = widget.character ?? constraints.defaultSeparator;
        activeWidgets.push({
          widget,
          content: char,
          measure: measureWidget(char, widget),
          index,
        });
        return;
      }

      if (!content) {
        return;
      }

      activeWidgets.push({
        widget,
        content,
        measure: measureWidget(content, widget),
        index,
      });
    });

    if (activeWidgets.length === 0) {
      return {
        boxes: [],
        totalWidth: 0,
        overflow: false,
        availableWidth: constraints.maxWidth,
      };
    }

    // What the renderer draws around each widget (padding, arrows) and the line (caps) counts too
    const boxOverhead = constraints.boxOverhead ?? 0;
    const lineOverhead = constraints.lineOverhead ?? 0;
    const budget = constraints.maxWidth - lineOverhead;
    const isContent = (widget: WidgetConfig) => widget.type !== 'flex-separator' && widget.type !== 'separator';

    const entries = activeWidgets.map((item) => ({
      widget: item.widget,
      content: item.content,
      width: item.measure.preferredWidth,
      truncatable: item.measure.truncatable,
      truncated: false,
    }));
    const usedWidth = () =>
      entries.reduce((sum, entry) => sum + entry.width + (isContent(entry.widget) ? boxOverhead : 0), 0);

    // Too wide: cut from the end. The widget that crosses the edge is shortened when an
    // ellipsis still fits, otherwise it goes, together with the separator that led to it.
    let clipped = false;
    for (let excess = usedWidth() - budget; excess > 0; excess = usedWidth() - budget) {
      const last = entries.findLastIndex((entry) => isContent(entry.widget));
      if (last === -1) break;
      const entry = entries[last]!;
      clipped = true;
      const width = entry.width - excess;
      if (entry.truncatable && width > LAYOUT.ELLIPSIS_LENGTH) {
        entry.content = stripAnsi(entry.content).slice(0, width - LAYOUT.ELLIPSIS_LENGTH) + LAYOUT.ELLIPSIS;
        entry.width = width;
        entry.truncated = true;
        break;
      }
      const from = entries[last - 1]?.widget.type === 'separator' ? last - 1 : last;
      entries.splice(from, last - from + 1);
    }

    const flexCount = entries.filter((entry) => entry.widget.type === 'flex-separator').length;
    const flexWidth = flexCount > 0 ? Math.floor(Math.max(0, budget - usedWidth()) / flexCount) : 0;

    const boxes: LayoutBox[] = [];
    let position = 0;
    for (const entry of entries) {
      const isFlex = entry.widget.type === 'flex-separator';
      const width = isFlex ? flexWidth : entry.width;
      boxes.push({
        id: entry.widget.id,
        widget: entry.widget,
        content: isFlex ? ' '.repeat(width) : entry.content,
        width,
        start: position,
        end: position + width,
        isFlex,
        truncated: entry.truncated,
      });
      position += width + (isContent(entry.widget) ? boxOverhead : 0);
    }

    const totalWidth = position + (entries.some((entry) => isContent(entry.widget)) ? lineOverhead : 0);
    return {
      boxes,
      totalWidth,
      overflow: totalWidth > constraints.maxWidth,
      availableWidth: constraints.maxWidth,
      clipped,
    };
  }

  truncateLayout(layout: Layout): Layout {
    if (!layout.overflow || layout.boxes.length === 0) {
      return layout;
    }

    const boxes = [...layout.boxes];
    const lastTruncatable = boxes.findLastIndex(
      box => !box.isFlex && box.widget.type !== 'separator'
    );

    if (lastTruncatable === -1) {
      return layout;
    }

    const excess = layout.totalWidth - layout.availableWidth;
    const box = boxes[lastTruncatable];

    if (!box) {
      return layout;
    }

    const newWidth = Math.max(LAYOUT.MIN_CONTENT_WIDTH, box.width - excess);
    const newContent = stripAnsi(box.content).slice(0, newWidth - LAYOUT.ELLIPSIS_LENGTH) + LAYOUT.ELLIPSIS;

    boxes[lastTruncatable] = {
      ...box,
      content: newContent,
      width: newWidth,
      truncated: true,
    };

    let position = 0;
    for (let i = 0; i < boxes.length; i++) {
      const currentBox = boxes[i];
      if (currentBox) {
        boxes[i] = {
          ...currentBox,
          start: position,
          end: position + currentBox.width,
        };
        position += currentBox.width;
      }
    }

    return {
      boxes,
      totalWidth: position,
      overflow: position > layout.availableWidth,
      availableWidth: layout.availableWidth,
    };
  }
}

export function createLayoutEngine(): LayoutEngine {
  return new LayoutEngine();
}

export function calculateMergePadding(
  current: WidgetConfig,
  next: WidgetConfig | undefined,
  defaultPadding: string
): string {
  if (!next) {
    return '';
  }

  if (next.merge === true) {
    return defaultPadding;
  }

  if (next.merge === 'no-padding') {
    return '';
  }

  return '';
}

export function shouldInsertSeparator(
  current: WidgetConfig,
  next: WidgetConfig | undefined
): boolean {
  if (!next) {
    return false;
  }

  if (current.type === 'flex-separator' || next.type === 'flex-separator') {
    return false;
  }

  if (current.type === 'separator' || next.type === 'separator') {
    return false;
  }

  if (next.merge === true || next.merge === 'no-padding') {
    return false;
  }

  return true;
}

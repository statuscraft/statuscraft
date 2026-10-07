import type { RendererPlugin } from './types';
import type { WidgetConfig } from '../types/widget';
import type { Settings } from '../types/settings';
import type { RenderContext } from './types';
import type { LayoutBox, StyledBox } from '../layout/types';
import { parseColor } from '../types/color';
import { AnsiBuilder } from '../ansi/builder';
import { shouldInsertSeparator } from '../layout/engine';
import { CLEAR_TO_EOL } from '../ansi/constants';

export const standardRenderer: RendererPlugin = {
  name: 'standard',
  priority: 0,

  canHandle(settings: Settings): boolean {
    return !settings.powerline.enabled;
  },

  preLayout(
    widgets: readonly WidgetConfig[],
    settings: Settings
  ): readonly WidgetConfig[] {
    const result: WidgetConfig[] = [];

    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];
      if (!widget) continue;

      result.push(widget);

      const next = widgets[i + 1];
      if (shouldInsertSeparator(widget, next)) {
        result.push({
          id: `sep-auto-${i}`,
          type: 'separator',
          character: settings.defaultSeparator ?? ' | ',
        });
      }
    }

    return result;
  },

  insertSeparators(
    boxes: readonly LayoutBox[],
    _settings: Settings
  ): readonly LayoutBox[] {
    return boxes;
  },

  applyStyles(
    boxes: readonly LayoutBox[],
    settings: Settings,
    _context: RenderContext
  ): readonly StyledBox[] {
    return boxes.map((box, index) => {
      const widget = box.widget;

      let fg = parseColor(widget.color);
      let bg = parseColor(widget.backgroundColor);

      if (settings.overrideForegroundColor) {
        fg = parseColor(settings.overrideForegroundColor);
      }
      if (settings.overrideBackgroundColor) {
        bg = parseColor(settings.overrideBackgroundColor);
      }

      if (widget.type === 'separator' && settings.inheritSeparatorColors) {
        const prevBox = boxes[index - 1];
        if (prevBox) {
          fg = parseColor(prevBox.widget.color);
        }
      }

      const bold = widget.bold ?? settings.globalBold;

      return {
        ...box,
        fg,
        bg,
        bold,
      };
    });
  },

  render(
    boxes: readonly StyledBox[],
    settings: Settings,
    _context: RenderContext
  ): string {
    if (boxes.length === 0) return '';
    const colorLevel = settings.colorLevel;
    let builder = AnsiBuilder.create();

    for (const box of boxes) {
      if (box.fg.type !== 'none') {
        builder = builder.fg(box.fg);
      }
      if (box.bg.type !== 'none') {
        builder = builder.bg(box.bg);
      }
      if (box.bold) {
        builder = builder.bold();
      }

      builder = builder.text(box.content);

      builder = builder.reset();
    }

    const output = builder.build(colorLevel);
    // Clearing to the end of the line stops a background color bleeding past the text
    return colorLevel === 0 ? output : output + CLEAR_TO_EOL;
  },
};

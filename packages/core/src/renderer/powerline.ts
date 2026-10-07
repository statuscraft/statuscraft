import type { RendererPlugin, PowerlineTheme, PowerlineThemeColors } from './types';
import type { WidgetConfig } from '../types/widget';
import type { Settings } from '../types/settings';
import type { RenderContext } from './types';
import type { LayoutBox, StyledBox } from '../layout/types';
import { parseColor, colorNone, type Color, type ColorLevel } from '../types/color';
import { colorToAnsiFg, colorToAnsiBg } from '../ansi/color-codes';
import { RESET, CLEAR_TO_EOL } from '../ansi/constants';
import { visibleLength } from '../ansi/builder';

export interface AlignmentInfo {
  segmentWidths: number[];
  enabled: boolean;
}

// Nord, Dracula, Catppuccin and Gruvbox come from ccstatusline (MIT, Copyright (c) 2025 Matthew Breedlove): see LICENSE
export const POWERLINE_THEMES: Record<string, PowerlineTheme> = {
  'custom': {
    name: 'Custom',
    description: 'Uses individual widget background colors',
  },
  'nord': {
    name: 'Nord',
    description: 'Arctic, north-bluish color palette',
    1: {
      fg: ['black', 'brightWhite', 'brightWhite', 'black', 'black'],
      bg: ['bgBrightCyan', 'bgBrightBlack', 'bgBlue', 'bgBrightYellow', 'bgBrightGreen'],
    },
    2: {
      fg: ['ansi256:16', 'ansi256:254', 'ansi256:231', 'ansi256:231', 'ansi256:16'],
      bg: ['ansi256:73', 'ansi256:239', 'ansi256:25', 'ansi256:96', 'ansi256:152'],
    },
    3: {
      fg: ['hex:2E3440', 'hex:D8DEE9', 'hex:FDF6E3', 'hex:2E3440', 'hex:2E3440'],
      bg: ['hex:88C0D0', 'hex:4C566A', 'hex:5E81AC', 'hex:B48EAD', 'hex:A3BE8C'],
    },
  },
  'dracula': {
    name: 'Dracula',
    description: 'Dark theme with purple accents',
    1: {
      fg: ['brightWhite', 'black', 'brightWhite', 'black', 'white'],
      bg: ['bgMagenta', 'bgBrightWhite', 'bgRed', 'bgBrightCyan', 'bgBrightBlack'],
    },
    2: {
      fg: ['ansi256:235', 'ansi256:235', 'ansi256:235', 'ansi256:235', 'ansi256:231'],
      bg: ['ansi256:141', 'ansi256:253', 'ansi256:204', 'ansi256:117', 'ansi256:236'],
    },
    3: {
      fg: ['hex:282A36', 'hex:282A36', 'hex:282A36', 'hex:282A36', 'hex:F8F8F2'],
      bg: ['hex:BD93F9', 'hex:F8F8F2', 'hex:FF5555', 'hex:8BE9FD', 'hex:44475A'],
    },
  },
  'catppuccin': {
    name: 'Catppuccin',
    description: 'Soothing pastel theme',
    1: {
      fg: ['black', 'brightWhite', 'black', 'brightWhite', 'black'],
      bg: ['bgBrightMagenta', 'bgBrightBlack', 'bgBrightGreen', 'bgBlue', 'bgBrightYellow'],
    },
    2: {
      fg: ['ansi256:235', 'ansi256:255', 'ansi256:235', 'ansi256:235', 'ansi256:235'],
      bg: ['ansi256:176', 'ansi256:238', 'ansi256:150', 'ansi256:210', 'ansi256:111'],
    },
    3: {
      fg: ['hex:1E1E2E', 'hex:CDD6F4', 'hex:1E1E2E', 'hex:1E1E2E', 'hex:CDD6F4'],
      bg: ['hex:CBA6F7', 'hex:45475A', 'hex:A6E3A1', 'hex:F38BA8', 'hex:585B70'],
    },
  },
  'gruvbox': {
    name: 'Gruvbox',
    description: 'Retro groove color scheme',
    1: {
      fg: ['brightWhite', 'black', 'black', 'brightWhite', 'black'],
      bg: ['bgRed', 'bgBrightYellow', 'bgBrightWhite', 'bgBlue', 'bgBrightGreen'],
    },
    2: {
      fg: ['ansi256:16', 'ansi256:235', 'ansi256:235', 'ansi256:16', 'ansi256:235'],
      bg: ['ansi256:167', 'ansi256:214', 'ansi256:246', 'ansi256:109', 'ansi256:142'],
    },
    3: {
      fg: ['hex:EBDBB2', 'hex:282828', 'hex:282828', 'hex:FDF6E3', 'hex:282828'],
      bg: ['hex:CC241D', 'hex:FABD2F', 'hex:A89984', 'hex:458588', 'hex:98971A'],
    },
  },  'bricks': {
    name: 'Bricks',
    description: 'Bright toy-brick primaries, the StatusCraft look',
    1: {
      fg: ['brightWhite', 'black', 'brightWhite', 'brightWhite', 'black'],
      bg: ['bgRed', 'bgYellow', 'bgBlue', 'bgGreen', 'bgBrightRed'],
    },
    2: {
      fg: ['ansi256:231', 'ansi256:16', 'ansi256:231', 'ansi256:231', 'ansi256:16'],
      bg: ['ansi256:160', 'ansi256:220', 'ansi256:33', 'ansi256:34', 'ansi256:208'],
    },
    3: {
      fg: ['hex:FFFFFF', 'hex:212121', 'hex:FFFFFF', 'hex:FFFFFF', 'hex:212121'],
      bg: ['hex:E53935', 'hex:FDD835', 'hex:1E88E5', 'hex:43A047', 'hex:FB8C00'],
    },
  },
  'solarized': {
    name: 'Solarized',
    description: 'Precision colors for machines and people',
    1: {
      fg: ['brightWhite', 'white', 'brightWhite', 'brightWhite', 'black'],
      bg: ['bgBlue', 'bgBlack', 'bgBrightBlack', 'bgGreen', 'bgYellow'],
    },
    2: {
      fg: ['ansi256:230', 'ansi256:247', 'ansi256:230', 'ansi256:230', 'ansi256:234'],
      bg: ['ansi256:33', 'ansi256:235', 'ansi256:242', 'ansi256:100', 'ansi256:136'],
    },
    3: {
      fg: ['hex:FDF6E3', 'hex:93A1A1', 'hex:FDF6E3', 'hex:FDF6E3', 'hex:002B36'],
      bg: ['hex:268BD2', 'hex:073642', 'hex:586E75', 'hex:859900', 'hex:B58900'],
    },
  },
  'monokai': {
    name: 'Monokai',
    description: 'Vivid colors on a warm dark base',
    1: {
      fg: ['black', 'brightWhite', 'black', 'brightWhite', 'black'],
      bg: ['bgBrightGreen', 'bgBrightBlack', 'bgBrightCyan', 'bgMagenta', 'bgYellow'],
    },
    2: {
      fg: ['ansi256:235', 'ansi256:255', 'ansi256:235', 'ansi256:255', 'ansi256:235'],
      bg: ['ansi256:148', 'ansi256:238', 'ansi256:81', 'ansi256:197', 'ansi256:208'],
    },
    3: {
      fg: ['hex:272822', 'hex:F8F8F2', 'hex:272822', 'hex:F8F8F2', 'hex:272822'],
      bg: ['hex:A6E22E', 'hex:49483E', 'hex:66D9EF', 'hex:F92672', 'hex:FD971F'],
    },
  },
};

function getThemeColors(
  theme: PowerlineTheme,
  level: ColorLevel
): PowerlineThemeColors | undefined {
  return theme[level as 1 | 2 | 3] ?? theme[2] ?? theme[1];
}

const DEFAULT_SEPARATOR = '\uE0B0';

export const powerlineRenderer: RendererPlugin = {
  name: 'powerline',
  priority: 10,

  canHandle(settings: Settings): boolean {
    return settings.powerline.enabled;
  },

  preLayout(
    widgets: readonly WidgetConfig[],
    _settings: Settings
  ): readonly WidgetConfig[] {
    return widgets.filter(w => w.type !== 'separator');
  },

  // A space each side and an arrow per segment; caps per run of segments, and the last
  // segment of the line has no arrow after it
  overhead(widgets: readonly WidgetConfig[], settings: Settings) {
    const capWidth = (cap: string | undefined) => (cap ? visibleLength(cap) : 0);
    const runs = 1 + widgets.filter(w => w.type === 'flex-separator').length;
    return {
      box: 3,
      line: capWidth(settings.powerline.startCaps[0]) * runs + capWidth(settings.powerline.endCaps[0]) - 1,
    };
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
    const powerline = settings.powerline;
    const themeName = powerline.theme ?? 'custom';
    const theme = POWERLINE_THEMES[themeName];
    const themeColors = theme ? getThemeColors(theme, settings.colorLevel) : undefined;

    let widgetIndex = 0;

    return boxes.map((box) => {
      const widget = box.widget;

      if (widget.type === 'flex-separator') {
        return {
          ...box,
          fg: colorNone(),
          bg: colorNone(),
          bold: false,
        };
      }

      let fg: Color;
      let bg: Color;

      if (themeName === 'custom' || !themeColors) {
        fg = parseColor(widget.color ?? 'white');
        bg = parseColor(widget.backgroundColor ?? 'bgBlue');
      } else {
        const fgColors = themeColors.fg;
        const bgColors = themeColors.bg;
        const colorIndex = widgetIndex % Math.max(fgColors.length, bgColors.length);

        fg = widget.color !== undefined
          ? parseColor(widget.color)
          : parseColor(fgColors[colorIndex] ?? 'white');

        bg = widget.backgroundColor !== undefined
          ? parseColor(widget.backgroundColor)
          : parseColor(bgColors[colorIndex] ?? 'bgBlue');
      }

      widgetIndex++;

      return {
        ...box,
        fg,
        bg,
        bold: widget.bold ?? settings.globalBold,
      };
    });
  },

  render(
    boxes: readonly StyledBox[],
    settings: Settings,
    _context: RenderContext
  ): string {
    return drawPowerline(boxes, settings);
  },
};

// Draws the segments. A Spacer splits the line into runs: each run closes with an arrow,
// the space stays the terminal's own, and the next run opens with the start cap again.
function drawPowerline(boxes: readonly StyledBox[], settings: Settings, alignment?: AlignmentInfo): string {
  if (boxes.every(b => b.isFlex)) return '';
  const level = settings.colorLevel;
  const { separators, separatorInvertBackground: invertBg, startCaps, endCaps } = settings.powerline;
  const fg = (color: Color) => colorToAnsiFg(color, level);
  const bg = (color: Color) => colorToAnsiBg(color, level);
  // Caps and run endings take the segment's color, on the terminal's background
  const edge = (box: StyledBox, glyph: string | undefined) => (glyph ? fg(bgToFgColor(box.bg)) + glyph + RESET : '');

  let result = '';
  let drawn = 0;
  let previous: StyledBox | undefined;

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]!;

    if (box.isFlex) {
      // A Spacer at the very end has nothing to push
      if (!boxes.slice(i + 1).some(b => !b.isFlex)) break;
      if (previous) result += edge(previous, separators[(drawn - 1) % separators.length] ?? DEFAULT_SEPARATOR);
      previous = undefined;
      result += box.content;
      continue;
    }

    if (!previous) {
      result += edge(box, startCaps[0]);
    } else {
      const index = (drawn - 1) % separators.length;
      const glyph = separators[index] ?? DEFAULT_SEPARATOR;
      // Inverted for left-pointing glyphs: drawn in the next segment's color on the previous one
      result += invertBg[index]
        ? fg(bgToFgColor(box.bg)) + bg(previous.bg) + glyph + RESET
        : fg(bgToFgColor(previous.bg)) + bg(box.bg) + glyph + RESET;
    }

    const aligned = alignment?.enabled ? alignment.segmentWidths[drawn] : undefined;
    const extra = aligned ? Math.max(0, aligned - (visibleLength(box.content) + 2)) : 0;
    const left = Math.floor(extra / 2);
    result += RESET + bg(box.bg) + fg(box.fg) + (box.bold ? '\x1b[1m' : '');
    result += ' ' + ' '.repeat(left) + box.content + ' '.repeat(extra - left) + ' ';
    result += RESET;

    previous = box;
    drawn++;
  }

  if (previous) result += edge(previous, endCaps[0]);
  return result + RESET + CLEAR_TO_EOL;
}

function bgToFgColor(color: Color): Color {
  if (color.type !== 'named') {
    return color;
  }

  const name = color.value as string;

  if (name.startsWith('bgBright')) {
    const base = name.slice(8);
    return parseColor('bright' + base.charAt(0).toUpperCase() + base.slice(1).toLowerCase());
  }

  if (name.startsWith('bg')) {
    const base = name.slice(2);
    return parseColor(base.charAt(0).toLowerCase() + base.slice(1));
  }

  return color;
}

export function getPowerlineThemes(): string[] {
  return Object.keys(POWERLINE_THEMES);
}

export function getPowerlineTheme(name: string): PowerlineTheme | undefined {
  return POWERLINE_THEMES[name];
}

export function calculateAlignment(
  allLineBoxes: readonly (readonly StyledBox[])[]
): AlignmentInfo {
  const segmentWidths: number[] = [];

  for (const lineBoxes of allLineBoxes) {
    const visibleBoxes = lineBoxes.filter(b => !b.isFlex);

    visibleBoxes.forEach((box, index) => {
      const contentWidth = visibleLength(box.content) + 2;

      if (index >= segmentWidths.length) {
        segmentWidths.push(contentWidth);
      } else {
        segmentWidths[index] = Math.max(segmentWidths[index]!, contentWidth);
      }
    });
  }

  return {
    segmentWidths,
    enabled: true,
  };
}

export function renderWithAlignment(
  boxes: readonly StyledBox[],
  settings: Settings,
  _context: RenderContext,
  alignment: AlignmentInfo
): string {
  return drawPowerline(boxes, settings, alignment);
}

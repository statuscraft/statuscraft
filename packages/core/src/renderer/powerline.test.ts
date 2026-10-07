import { describe, it, expect } from 'vitest';
import { powerlineRenderer, getPowerlineThemes, getPowerlineTheme, POWERLINE_THEMES } from './powerline';
import type { WidgetConfig } from '../types/widget';
import type { Settings } from '../types/settings';
import type { LayoutBox, StyledBox } from '../layout/types';
import { parseColor } from '../types/color';
import { createDefaultSettings } from '../types/settings';
import type { RenderContext } from './types';

const createPreviewContext = (..._args: unknown[]): RenderContext => ({ lineIndex: 0 });
import { stripAnsi } from '../ansi/builder';

describe('powerlineRenderer', () => {
  const enabledSettings: Settings = {
    ...createDefaultSettings(),
    powerline: {
      enabled: true,
      separators: ['\uE0B0'],
      separatorInvertBackground: [false],
      startCaps: [],
      endCaps: [],
      autoAlign: false,
    },
  };
  const context = createPreviewContext();

  describe('canHandle', () => {
    it('returns true when powerline is enabled', () => {
      expect(powerlineRenderer.canHandle(enabledSettings)).toBe(true);
    });

    it('returns false when powerline is disabled', () => {
      const settings = createDefaultSettings();
      expect(powerlineRenderer.canHandle(settings)).toBe(false);
    });
  });

  describe('preLayout', () => {
    it('removes separator widgets', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'separator' },
        { id: '3', type: 'git-branch' },
      ];

      const result = powerlineRenderer.preLayout!(widgets, enabledSettings);

      expect(result.length).toBe(2);
      expect(result.some(w => w.type === 'separator')).toBe(false);
    });

    it('preserves flex separators', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
        { id: '3', type: 'git-branch' },
      ];

      const result = powerlineRenderer.preLayout!(widgets, enabledSettings);

      expect(result.length).toBe(3);
      expect(result.some(w => w.type === 'flex-separator')).toBe(true);
    });

    it('keeps regular widgets intact', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model', color: 'cyan' },
        { id: '2', type: 'git-branch', color: 'magenta' },
      ];

      const result = powerlineRenderer.preLayout!(widgets, enabledSettings);

      expect(result.length).toBe(2);
      expect(result[0]?.type).toBe('model');
      expect(result[1]?.type).toBe('git-branch');
    });
  });

  describe('applyStyles', () => {
    it('uses custom colors when theme is custom', () => {
      const settings = {
        ...enabledSettings,
        powerline: { ...enabledSettings.powerline, theme: 'custom' },
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model', color: 'white', backgroundColor: 'bgBlue' },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = powerlineRenderer.applyStyles(boxes, settings, context);

      expect(styled[0]?.fg.type).toBe('named');
      expect((styled[0]?.fg as { value: string }).value).toBe('white');
      expect((styled[0]?.bg as { value: string }).value).toBe('bgBlue');
    });

    it('uses theme colors when a theme is selected', () => {
      const settings = {
        ...enabledSettings,
        powerline: { ...enabledSettings.powerline, theme: 'nord' },
        colorLevel: 2 as const,
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model' },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = powerlineRenderer.applyStyles(boxes, settings, context);

      expect(styled[0]?.fg.type).toBe('ansi256');
    });

    it('assigns colorNone to flex separators', () => {
      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'flex-separator' },
          content: '     ',
          width: 5,
          start: 0,
          end: 5,
          isFlex: true,
          truncated: false,
        },
      ];

      const styled = powerlineRenderer.applyStyles(boxes, enabledSettings, context);

      expect(styled[0]?.fg.type).toBe('none');
      expect(styled[0]?.bg.type).toBe('none');
    });

    it('cycles through theme colors for multiple widgets', () => {
      const settings = {
        ...enabledSettings,
        powerline: { ...enabledSettings.powerline, theme: 'nord' },
        colorLevel: 2 as const,
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model' },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
        },
        {
          id: '2',
          widget: { id: '2', type: 'git-branch' },
          content: 'main',
          width: 4,
          start: 5,
          end: 9,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = powerlineRenderer.applyStyles(boxes, settings, context);

      expect(styled[0]?.bg).not.toEqual(styled[1]?.bg);
    });
  });

  describe('render', () => {
    it('includes powerline separator character', () => {
      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const, backgroundColor: 'bgBlue' },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'white' as const },
          bg: { type: 'named' as const, value: 'bgBlue' as const },
          bold: false,
        },
        {
          id: '2',
          widget: { id: '2', type: 'git-branch' as const, backgroundColor: 'bgGreen' },
          content: 'main',
          width: 4,
          start: 5,
          end: 9,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'black' as const },
          bg: { type: 'named' as const, value: 'bgGreen' as const },
          bold: false,
        },
      ];

      const result = powerlineRenderer.render(boxes, enabledSettings, context);

      expect(result).toContain('\uE0B0');  // Powerline separator
    });

    it('adds padding around content', () => {
      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'white' as const },
          bg: { type: 'named' as const, value: 'bgBlue' as const },
          bold: false,
        },
      ];

      const result = powerlineRenderer.render(boxes, enabledSettings, context);
      const plainText = stripAnsi(result);

      expect(plainText).toContain(' Test ');
    });

    it('renders start caps when configured', () => {
      const settings = {
        ...enabledSettings,
        powerline: { ...enabledSettings.powerline, startCaps: ['\uE0B2'] },
      };

      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'white' as const },
          bg: { type: 'named' as const, value: 'bgBlue' as const },
          bold: false,
        },
      ];

      const result = powerlineRenderer.render(boxes, settings, context);

      expect(result).toContain('\uE0B2');
    });

    it('renders end caps when configured', () => {
      const settings = {
        ...enabledSettings,
        powerline: { ...enabledSettings.powerline, endCaps: ['\uE0B0'] },
      };

      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'white' as const },
          bg: { type: 'named' as const, value: 'bgBlue' as const },
          bold: false,
        },
      ];

      const result = powerlineRenderer.render(boxes, settings, context);
      const plainText = stripAnsi(result);

      expect(plainText.endsWith('\uE0B0')).toBe(true);
    });

    it('filters out flex separators from visible output', () => {
      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'white' as const },
          bg: { type: 'named' as const, value: 'bgBlue' as const },
          bold: false,
        },
        {
          id: '2',
          widget: { id: '2', type: 'flex-separator' as const },
          content: '     ',
          width: 5,
          start: 5,
          end: 10,
          isFlex: true,
          truncated: false,
          fg: { type: 'none' as const },
          bg: { type: 'none' as const },
          bold: false,
        },
        {
          id: '3',
          widget: { id: '3', type: 'git-branch' as const },
          content: 'main',
          width: 4,
          start: 10,
          end: 14,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'black' as const },
          bg: { type: 'named' as const, value: 'bgGreen' as const },
          bold: false,
        },
      ];

      const result = powerlineRenderer.render(boxes, enabledSettings, context);
      const plainText = stripAnsi(result);

      expect(plainText).toContain('Model');
      expect(plainText).toContain('main');
    });
  });
});

describe('getPowerlineThemes', () => {
  it('returns available themes', () => {
    const themes = getPowerlineThemes();

    expect(themes).toContain('custom');
    expect(themes).toContain('nord');
    expect(themes).toContain('dracula');
    expect(themes).toContain('catppuccin');
    expect(themes).toContain('gruvbox');
  });

  it('returns all themes from POWERLINE_THEMES', () => {
    const themes = getPowerlineThemes();
    const themeCount = Object.keys(POWERLINE_THEMES).length;

    expect(themes.length).toBe(themeCount);
  });
});

describe('getPowerlineTheme', () => {
  it('returns theme by name', () => {
    const nord = getPowerlineTheme('nord');

    expect(nord).toBeDefined();
    expect(nord?.name).toBe('Nord');
    expect(nord?.[2]?.bg).toBeDefined();  // ANSI 256 colors
  });

  it('returns undefined for unknown theme', () => {
    const unknown = getPowerlineTheme('nonexistent');
    expect(unknown).toBeUndefined();
  });

  it('custom theme has no color definitions', () => {
    const custom = getPowerlineTheme('custom');

    expect(custom).toBeDefined();
    expect(custom?.name).toBe('Custom');
    expect(custom?.[1]).toBeUndefined();
    expect(custom?.[2]).toBeUndefined();
    expect(custom?.[3]).toBeUndefined();
  });

  it('themes have color definitions for multiple levels', () => {
    const nord = getPowerlineTheme('nord');

    expect(nord?.[1]).toBeDefined();  // ANSI 16
    expect(nord?.[2]).toBeDefined();  // ANSI 256
    expect(nord?.[3]).toBeDefined();  // TrueColor
  });
});

describe('powerline edges', () => {
  const box = (id: string, content: string, bg: string): StyledBox => ({
    id,
    widget: { id, type: 'custom-text' },
    content,
    width: content.length,
    start: 0,
    end: content.length,
    isFlex: false,
    truncated: false,
    fg: parseColor('hex:FFFFFF'),
    bg: parseColor(bg),
    bold: false,
  });
  const settings = (powerline: Partial<Settings['powerline']>): Settings => {
    const base = createDefaultSettings();
    return { ...base, colorLevel: 3, powerline: { ...base.powerline, enabled: true, separators: ['\uE0B0'], ...powerline } };
  };
  const boxes = [box('a', 'one', 'hex:CBA6F7'), box('b', 'two', 'hex:45475A')];

  it('draws the start cap in the first segment\'s color, on the terminal background', () => {
    const output = powerlineRenderer.render(boxes, settings({ startCaps: ['\uE0B6'], endCaps: ['\uE0B4'] }), { lineIndex: 0 });
    expect(output.startsWith('\x1b[38;2;203;166;247m\uE0B6')).toBe(true);
    expect(output).toContain('\x1b[38;2;69;71;90m\uE0B4');
  });

  it('inverts a separator when asked', () => {
    const plain = powerlineRenderer.render(boxes, settings({ separatorInvertBackground: [false] }), { lineIndex: 0 });
    const inverted = powerlineRenderer.render(boxes, settings({ separatorInvertBackground: [true] }), { lineIndex: 0 });
    expect(plain).toContain('\x1b[38;2;203;166;247m\x1b[48;2;69;71;90m\uE0B0');
    expect(inverted).toContain('\x1b[38;2;69;71;90m\x1b[48;2;203;166;247m\uE0B0');
  });
});

import { describe, it, expect } from 'vitest';
import { standardRenderer } from './standard';
import type { WidgetConfig } from '../types/widget';
import type { LayoutBox } from '../layout/types';
import { createDefaultSettings } from '../types/settings';
import type { RenderContext } from './types';

const createPreviewContext = (..._args: unknown[]): RenderContext => ({ lineIndex: 0 });
import { colorNone } from '../types/color';
import { stripAnsi } from '../ansi/builder';

describe('standardRenderer', () => {
  const defaultSettings = createDefaultSettings();
  const context = createPreviewContext();

  describe('canHandle', () => {
    it('returns true when powerline is disabled', () => {
      expect(standardRenderer.canHandle(defaultSettings)).toBe(true);
    });

    it('returns false when powerline is enabled', () => {
      const settings = {
        ...defaultSettings,
        powerline: { ...defaultSettings.powerline, enabled: true },
      };
      expect(standardRenderer.canHandle(settings)).toBe(false);
    });
  });

  describe('preLayout', () => {
    it('inserts separators between widgets', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch' },
      ];

      const result = standardRenderer.preLayout!(widgets, defaultSettings);

      expect(result.length).toBe(3);
      expect(result[1]?.type).toBe('separator');
    });

    it('does not insert separator before existing separator', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'separator' },
        { id: '3', type: 'git-branch' },
      ];

      const result = standardRenderer.preLayout!(widgets, defaultSettings);

      const separatorCount = result.filter(w => w.type === 'separator').length;
      expect(separatorCount).toBe(1);
    });

    it('does not insert separator before merged widgets', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch', merge: true },
      ];

      const result = standardRenderer.preLayout!(widgets, defaultSettings);

      expect(result.length).toBe(2);
      expect(result.every(w => w.type !== 'separator')).toBe(true);
    });

    it('does not insert separator around flex-separator', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
        { id: '3', type: 'git-branch' },
      ];

      const result = standardRenderer.preLayout!(widgets, defaultSettings);

      const separatorCount = result.filter(w => w.type === 'separator').length;
      expect(separatorCount).toBe(0);
    });
  });

  describe('applyStyles', () => {
    it('applies widget colors', () => {
      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model', color: 'cyan' },
          content: 'Model: Claude',
          width: 13,
          start: 0,
          end: 13,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = standardRenderer.applyStyles(boxes, defaultSettings, context);

      expect(styled[0]?.fg.type).toBe('named');
      expect((styled[0]?.fg as { value: string }).value).toBe('cyan');
    });

    it('applies global overrides', () => {
      const settings = {
        ...defaultSettings,
        overrideForegroundColor: 'red',
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model', color: 'cyan' },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = standardRenderer.applyStyles(boxes, settings, context);

      expect((styled[0]?.fg as { value: string }).value).toBe('red');
    });

    it('inherits separator colors when enabled', () => {
      const settings = {
        ...defaultSettings,
        inheritSeparatorColors: true,
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model', color: 'cyan' },
          content: 'Model',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
        },
        {
          id: '2',
          widget: { id: '2', type: 'separator' },
          content: ' | ',
          width: 3,
          start: 5,
          end: 8,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = standardRenderer.applyStyles(boxes, settings, context);

      expect((styled[1]?.fg as { value: string }).value).toBe('cyan');
    });

    it('applies bold from widget config', () => {
      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model', bold: true },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = standardRenderer.applyStyles(boxes, defaultSettings, context);

      expect(styled[0]?.bold).toBe(true);
    });

    it('applies global bold when widget does not specify', () => {
      const settings = {
        ...defaultSettings,
        globalBold: true,
      };

      const boxes: LayoutBox[] = [
        {
          id: '1',
          widget: { id: '1', type: 'model' },
          content: 'Test',
          width: 4,
          start: 0,
          end: 4,
          isFlex: false,
          truncated: false,
        },
      ];

      const styled = standardRenderer.applyStyles(boxes, settings, context);

      expect(styled[0]?.bold).toBe(true);
    });
  });

  describe('render', () => {
    it('renders plain text for color level 0', () => {
      const settings = { ...defaultSettings, colorLevel: 0 as const };
      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const },
          content: 'Hello',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
          fg: colorNone(),
          bg: colorNone(),
          bold: false,
        },
      ];

      const result = standardRenderer.render(boxes, settings, context);

      expect(result).toBe('Hello');
    });

    it('renders with ANSI codes for color level 2', () => {
      const settings = { ...defaultSettings, colorLevel: 2 as const };
      const boxes = [
        {
          id: '1',
          widget: { id: '1', type: 'model' as const, color: 'cyan' },
          content: 'Hello',
          width: 5,
          start: 0,
          end: 5,
          isFlex: false,
          truncated: false,
          fg: { type: 'named' as const, value: 'cyan' as const },
          bg: colorNone(),
          bold: false,
        },
      ];

      const result = standardRenderer.render(boxes, settings, context);

      expect(stripAnsi(result)).toBe('Hello');
      expect(result).toContain('\x1b[');
    });

    it('renders multiple boxes in sequence', () => {
      const settings = { ...defaultSettings, colorLevel: 0 as const };
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
          fg: colorNone(),
          bg: colorNone(),
          bold: false,
        },
        {
          id: '2',
          widget: { id: '2', type: 'separator' as const },
          content: ' | ',
          width: 3,
          start: 5,
          end: 8,
          isFlex: false,
          truncated: false,
          fg: colorNone(),
          bg: colorNone(),
          bold: false,
        },
        {
          id: '3',
          widget: { id: '3', type: 'git-branch' as const },
          content: 'main',
          width: 4,
          start: 8,
          end: 12,
          isFlex: false,
          truncated: false,
          fg: colorNone(),
          bg: colorNone(),
          bold: false,
        },
      ];

      const result = standardRenderer.render(boxes, settings, context);

      expect(result).toBe('Model | main');
    });
  });
});

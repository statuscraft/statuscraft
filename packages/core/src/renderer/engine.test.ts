import { describe, it, expect } from 'vitest';
import { RenderEngine, createRenderEngine } from './engine';
import { createDefaultSettings } from '../types/settings';
import type { RenderContext } from './types';

const createPreviewContext = (..._args: unknown[]): RenderContext => ({ lineIndex: 0 });
import { stripAnsi } from '../ansi/builder';
import type { RendererPlugin } from './types';
import { colorNone } from '../types/color';

describe('RenderEngine', () => {
  describe('selectPlugin', () => {
    it('selects standard renderer by default', () => {
      const engine = createRenderEngine();
      const settings = createDefaultSettings();

      const plugin = engine.selectPlugin(settings);

      expect(plugin.name).toBe('standard');
    });

    it('selects powerline renderer when enabled', () => {
      const engine = createRenderEngine();
      const settings = {
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

      const plugin = engine.selectPlugin(settings);

      expect(plugin.name).toBe('powerline');
    });

    it('respects plugin priority', () => {
      const engine = createRenderEngine();
      const settings = createDefaultSettings();

      const highPriorityPlugin: RendererPlugin = {
        name: 'high-priority',
        priority: 100,
        canHandle: () => true,
        insertSeparators: (boxes) => boxes,
        applyStyles: (boxes) => boxes.map(b => ({ ...b, fg: colorNone(), bg: colorNone(), bold: false })),
        render: () => 'high-priority-output',
      };

      engine.use(highPriorityPlugin);
      const plugin = engine.selectPlugin(settings);

      expect(plugin.name).toBe('high-priority');
    });
  });

  describe('renderLine', () => {
    it('renders a basic line', () => {
      const engine = createRenderEngine();
      const settings = createDefaultSettings();
      const context = createPreviewContext();

      const widgets = [
        { id: '1', type: 'model' as const, color: 'cyan' },
      ];
      const contents = ['Model: Claude'];
      const constraints = {
        maxWidth: 80,
        minContentWidth: 20,
        defaultSeparator: ' | ',
        defaultPadding: ' ',
      };

      const result = engine.renderLine(widgets, contents, settings, context, constraints);

      expect(stripAnsi(result.output)).toContain('Model: Claude');
      expect(result.pluginName).toBe('standard');
    });

    it('handles null content gracefully', () => {
      const engine = createRenderEngine();
      const settings = createDefaultSettings();
      const context = createPreviewContext();

      const widgets = [
        { id: '1', type: 'model' as const },
        { id: '2', type: 'git-branch' as const },
      ];
      const contents = ['Model', null];
      const constraints = {
        maxWidth: 80,
        minContentWidth: 20,
        defaultSeparator: ' | ',
        defaultPadding: ' ',
      };

      const result = engine.renderLine(widgets, contents, settings, context, constraints);

      expect(stripAnsi(result.output)).toBe('Model');
    });

    it('inserts auto-separators and maps content correctly', () => {
      const engine = createRenderEngine();
      const settings = createDefaultSettings();
      const context = createPreviewContext();

      const widgets = [
        { id: '1', type: 'model' as const },
        { id: '2', type: 'git-branch' as const },
      ];
      const contents = ['Model', 'main'];
      const constraints = {
        maxWidth: 80,
        minContentWidth: 20,
        defaultSeparator: ' | ',
        defaultPadding: ' ',
      };

      const result = engine.renderLine(widgets, contents, settings, context, constraints);
      const plain = stripAnsi(result.output);

      expect(plain).toBe('Model │ main');
    });

    it('uses powerline renderer when enabled', () => {
      const engine = createRenderEngine();
      const settings = {
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

      const widgets = [
        { id: '1', type: 'model' as const, backgroundColor: 'bgBlue' },
      ];
      const contents = ['Claude'];
      const constraints = {
        maxWidth: 80,
        minContentWidth: 20,
        defaultSeparator: '',
        defaultPadding: ' ',
      };

      const result = engine.renderLine(widgets, contents, settings, context, constraints);

      expect(result.pluginName).toBe('powerline');
    });

    it('returns correct visible length', () => {
      const engine = createRenderEngine();
      const settings = { ...createDefaultSettings(), colorLevel: 2 as const };
      const context = createPreviewContext();

      const widgets = [
        { id: '1', type: 'model' as const, color: 'cyan' },
      ];
      const contents = ['Test'];
      const constraints = {
        maxWidth: 80,
        minContentWidth: 20,
        defaultSeparator: ' | ',
        defaultPadding: ' ',
      };

      const result = engine.renderLine(widgets, contents, settings, context, constraints);

      expect(result.visibleLength).toBe(stripAnsi(result.output).length);
    });
  });

  describe('renderAllLines', () => {
    it('renders multiple lines', () => {
      const engine = createRenderEngine();
      const settings = {
        ...createDefaultSettings(),
        lines: [
          [{ id: '1', type: 'model' as const }],
          [{ id: '2', type: 'git-branch' as const }],
        ],
      };
      const context = createPreviewContext();
      const contents = [
        ['Claude'],
        ['main'],
      ];

      const results = engine.renderAllLines(settings, contents, context, 80);

      expect(results.length).toBe(2);
      expect(stripAnsi(results[0]?.output ?? '')).toBe('Claude');
      expect(stripAnsi(results[1]?.output ?? '')).toBe('main');
    });

    it('handles empty lines', () => {
      const engine = createRenderEngine();
      const settings = {
        ...createDefaultSettings(),
        lines: [
          [{ id: '1', type: 'model' as const }],
          [],
          [{ id: '2', type: 'git-branch' as const }],
        ],
      };
      const context = createPreviewContext();
      const contents = [
        ['Claude'],
        [],
        ['main'],
      ];

      const results = engine.renderAllLines(settings, contents, context, 80);

      expect(results.length).toBe(3);
      expect(results[1]?.output).toBe('');
    });

    it('passes correct line index to context', () => {
      let capturedContexts: number[] = [];

      const customPlugin: RendererPlugin = {
        name: 'context-capturing',
        priority: 100,
        canHandle: () => true,
        insertSeparators: (boxes) => boxes,
        applyStyles: (boxes, _settings, context) => {
          capturedContexts.push(context.lineIndex);
          return boxes.map(b => ({ ...b, fg: colorNone(), bg: colorNone(), bold: false }));
        },
        render: () => '',
      };

      const engine = createRenderEngine();
      engine.use(customPlugin);

      const settings = {
        ...createDefaultSettings(),
        lines: [
          [{ id: '1', type: 'model' as const }],
          [{ id: '2', type: 'model' as const }],
          [{ id: '3', type: 'model' as const }],
        ],
      };
      const context = createPreviewContext();
      const contents = [['A'], ['B'], ['C']];

      engine.renderAllLines(settings, contents, context, 80);

      expect(capturedContexts).toEqual([0, 1, 2]);
    });
  });

  describe('use', () => {
    it('adds plugin to registry', () => {
      const engine = createRenderEngine();

      const customPlugin: RendererPlugin = {
        name: 'custom',
        priority: 5,
        canHandle: () => false,
        insertSeparators: (boxes) => boxes,
        applyStyles: (boxes) => boxes.map(b => ({ ...b, fg: colorNone(), bg: colorNone(), bold: false })),
        render: () => '',
      };

      engine.use(customPlugin);

      const settings = createDefaultSettings();
      const plugin = engine.selectPlugin(settings);

      expect(plugin.name).toBe('standard');
    });

    it('returns engine for chaining', () => {
      const engine = createRenderEngine();

      const customPlugin: RendererPlugin = {
        name: 'custom',
        priority: 5,
        canHandle: () => false,
        insertSeparators: (boxes) => boxes,
        applyStyles: (boxes) => boxes.map(b => ({ ...b, fg: colorNone(), bg: colorNone(), bold: false })),
        render: () => '',
      };

      const result = engine.use(customPlugin);

      expect(result).toBe(engine);
    });
  });
});

describe('createRenderEngine', () => {
  it('creates a new engine instance', () => {
    const engine = createRenderEngine();
    expect(engine).toBeInstanceOf(RenderEngine);
  });

  it('creates independent instances', () => {
    const engine1 = createRenderEngine();
    const engine2 = createRenderEngine();

    const customPlugin: RendererPlugin = {
      name: 'engine1-only',
      priority: 100,
      canHandle: () => true,
      insertSeparators: (boxes) => boxes,
      applyStyles: (boxes) => boxes.map(b => ({ ...b, fg: colorNone(), bg: colorNone(), bold: false })),
      render: () => 'engine1',
    };

    engine1.use(customPlugin);

    const settings = createDefaultSettings();

    expect(engine1.selectPlugin(settings).name).toBe('engine1-only');

    expect(engine2.selectPlugin(settings).name).toBe('standard');
  });
});

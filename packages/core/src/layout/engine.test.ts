import { describe, it, expect } from 'vitest';
import { createLayoutEngine, shouldInsertSeparator, calculateMergePadding } from './engine';
import type { WidgetConfig } from '../types/widget';
import type { LayoutConstraints } from './types';

describe('LayoutEngine', () => {
  const engine = createLayoutEngine();
  const defaultConstraints: LayoutConstraints = {
    maxWidth: 80,
    minContentWidth: 20,
    defaultSeparator: ' | ',
    defaultPadding: ' ',
  };

  describe('basic layout', () => {
    it('layouts single widget', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
      ];
      const contents = ['Model: Claude'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes.length).toBe(1);
      expect(layout.boxes[0]?.content).toBe('Model: Claude');
      expect(layout.boxes[0]?.start).toBe(0);
      expect(layout.boxes[0]?.end).toBe(13);
      expect(layout.totalWidth).toBe(13);
      expect(layout.overflow).toBe(false);
    });

    it('layouts multiple widgets', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch' },
      ];
      const contents = ['Model: Claude', 'main'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes.length).toBe(2);
      expect(layout.totalWidth).toBe(17);
    });

    it('skips widgets with null content', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch' },
        { id: '3', type: 'git-changes' },
      ];
      const contents = ['Model: Claude', null, '+1 -2'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes.length).toBe(2);
      expect(layout.boxes[0]?.id).toBe('1');
      expect(layout.boxes[1]?.id).toBe('3');
    });

    it('returns empty layout when no widgets have content', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch' },
      ];
      const contents = [null, null];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes.length).toBe(0);
      expect(layout.totalWidth).toBe(0);
      expect(layout.overflow).toBe(false);
    });

    it('returns empty layout for empty widgets array', () => {
      const layout = engine.layout([], [], defaultConstraints);

      expect(layout.boxes.length).toBe(0);
      expect(layout.totalWidth).toBe(0);
    });
  });

  describe('separators', () => {
    it('includes separator with character', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'separator', character: '|' },
        { id: '3', type: 'git-branch' },
      ];
      const contents = ['Model: Claude', '|', 'main'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes.length).toBe(3);
      expect(layout.boxes[1]?.content).toBe('|');
      expect(layout.boxes[1]?.width).toBe(1);
    });

    it('uses default separator when no character specified', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'separator' },
        { id: '3', type: 'git-branch' },
      ];
      const contents = ['Model: Claude', null, 'main'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes[1]?.content).toBe(' | ');
      expect(layout.boxes[1]?.width).toBe(3);
    });
  });

  describe('flex separators', () => {
    it('expands flex separator to fill space', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
        { id: '3', type: 'git-branch' },
      ];
      const contents = ['Model', null, 'main'];
      const constraints = { ...defaultConstraints, maxWidth: 20 };

      const layout = engine.layout(widgets, contents, constraints);

      expect(layout.boxes.length).toBe(3);
      const flexBox = layout.boxes[1];
      expect(flexBox?.isFlex).toBe(true);
      expect(flexBox?.width).toBe(11);
    });

    it('distributes space among multiple flex separators', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
        { id: '3', type: 'git-branch' },
        { id: '4', type: 'flex-separator' },
        { id: '5', type: 'version' },
      ];
      const contents = ['A', null, 'B', null, 'C'];
      const constraints = { ...defaultConstraints, maxWidth: 23 };

      const layout = engine.layout(widgets, contents, constraints);

      const flex1 = layout.boxes[1];
      const flex2 = layout.boxes[3];
      expect(flex1?.width).toBe(10);
      expect(flex2?.width).toBe(10);
    });

    it('handles flex separator with zero remaining space', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
      ];
      const contents = ['A'.repeat(80), null];
      const constraints = { ...defaultConstraints, maxWidth: 80 };

      const layout = engine.layout(widgets, contents, constraints);

      const flexBox = layout.boxes.find(b => b.isFlex);
      expect(flexBox?.width).toBe(0);
    });

    it('fills flex separator with spaces', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'flex-separator' },
      ];
      const contents = ['A', null];
      const constraints = { ...defaultConstraints, maxWidth: 10 };

      const layout = engine.layout(widgets, contents, constraints);

      const flexBox = layout.boxes[1];
      expect(flexBox?.content).toBe('         '); // 9 spaces
    });
  });

  describe('truncation', () => {
    it('truncates content when exceeding max width', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
      ];
      const contents = ['This is a very long model name that should be truncated'];
      const constraints = { ...defaultConstraints, maxWidth: 20 };

      const layout = engine.layout(widgets, contents, constraints);

      expect(layout.boxes[0]?.truncated).toBe(true);
      expect(layout.boxes[0]?.content.endsWith('...')).toBe(true);
      expect(layout.boxes[0]?.width).toBeLessThanOrEqual(20);
    });

    it('skips widget when not enough space for ellipsis', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'git-branch' },
      ];
      const contents = ['A'.repeat(78), 'main'];
      const constraints = { ...defaultConstraints, maxWidth: 80 };

      const layout = engine.layout(widgets, contents, constraints);

      expect(layout.boxes.length).toBe(1);
      expect(layout.boxes[0]?.id).toBe('1');
    });
  });

  describe('overflow', () => {
    it('detects overflow with non-truncatable separators', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'separator', character: '='.repeat(50) },  // Non-truncatable
        { id: '2', type: 'separator', character: '='.repeat(50) },
      ];
      const contents = [null, null];
      const constraints = { ...defaultConstraints, maxWidth: 20 };

      const layout = engine.layout(widgets, contents, constraints);

      expect(layout.overflow).toBe(true);
    });

    it('does not report overflow when content fits', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
      ];
      const contents = ['short'];
      const constraints = { ...defaultConstraints, maxWidth: 80 };

      const layout = engine.layout(widgets, contents, constraints);

      expect(layout.overflow).toBe(false);
    });
  });

  describe('positions', () => {
    it('calculates correct start and end positions', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
        { id: '2', type: 'separator', character: '|' },
        { id: '3', type: 'git-branch' },
      ];
      const contents = ['ABC', '|', 'XY'];

      const layout = engine.layout(widgets, contents, defaultConstraints);

      expect(layout.boxes[0]?.start).toBe(0);
      expect(layout.boxes[0]?.end).toBe(3);
      expect(layout.boxes[1]?.start).toBe(3);
      expect(layout.boxes[1]?.end).toBe(4);
      expect(layout.boxes[2]?.start).toBe(4);
      expect(layout.boxes[2]?.end).toBe(6);
    });
  });

  describe('truncateLayout', () => {
    it('does not modify layout without overflow', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'model' },
      ];
      const contents = ['short'];

      const layout = engine.layout(widgets, contents, defaultConstraints);
      const truncated = engine.truncateLayout(layout);

      expect(truncated).toBe(layout); // Same reference
    });

    it('truncates last truncatable box when overflowing', () => {
      const widgets: WidgetConfig[] = [
        { id: '1', type: 'separator', character: '='.repeat(60) },  // Not truncatable, 60 chars
        { id: '2', type: 'model' },      // Truncatable
      ];
      const contents = [null, 'A'.repeat(30)];
      const constraints = { ...defaultConstraints, maxWidth: 80 };

      const layout = engine.layout(widgets, contents, constraints);
      const truncated = engine.truncateLayout(layout);

      const modelBox = truncated.boxes.find(b => b.id === '2');
      expect(modelBox?.truncated).toBe(true);
    });
  });
});

describe('shouldInsertSeparator', () => {
  it('returns true between regular widgets', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch' };

    expect(shouldInsertSeparator(current, next)).toBe(true);
  });

  it('returns false before separator', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'separator' };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false after separator', () => {
    const current: WidgetConfig = { id: '1', type: 'separator' };
    const next: WidgetConfig = { id: '2', type: 'git-branch' };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false before flex separator', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'flex-separator' };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false after flex separator', () => {
    const current: WidgetConfig = { id: '1', type: 'flex-separator' };
    const next: WidgetConfig = { id: '2', type: 'model' };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false when next wants to merge', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch', merge: true };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false when next uses no-padding merge', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch', merge: 'no-padding' };

    expect(shouldInsertSeparator(current, next)).toBe(false);
  });

  it('returns false when no next widget', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };

    expect(shouldInsertSeparator(current, undefined)).toBe(false);
  });
});

describe('calculateMergePadding', () => {
  it('returns default padding when next widget wants to merge', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch', merge: true };

    expect(calculateMergePadding(current, next, ' ')).toBe(' ');
  });

  it('returns empty string for no-padding merge', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch', merge: 'no-padding' };

    expect(calculateMergePadding(current, next, ' ')).toBe('');
  });

  it('returns empty string when no merge specified', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };
    const next: WidgetConfig = { id: '2', type: 'git-branch' };

    expect(calculateMergePadding(current, next, ' ')).toBe('');
  });

  it('returns empty string when no next widget', () => {
    const current: WidgetConfig = { id: '1', type: 'model' };

    expect(calculateMergePadding(current, undefined, ' ')).toBe('');
  });
});

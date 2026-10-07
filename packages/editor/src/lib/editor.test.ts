import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@statuscraft/core';
import { parseAnsi } from './ansi';
import { ansi256ToHex, configColorToCss, readableTextOn } from './colors';
import { addBrick, addLine, findBrick, MAX_LINES, moveBrick, newBrick, removeBrick, removeLine } from './layout-ops';
import { terminals } from './terminal-themes';

const palette = terminals['iterm2']!.themes['default']!.colors;

describe('layout operations', () => {
  const base = createDefaultSettings();

  it('adds bricks with warning colors when the widget offers them', () => {
    const brick = newBrick('context-bar', base);
    expect(brick.thresholds?.length).toBe(2);
    const layout = addBrick(base, 0, brick, 1);
    expect(findBrick(layout, brick.id)).toMatchObject({ line: 0, index: 1 });
  });

  it('lets a powerline theme color new bricks', () => {
    const themed = { ...base, powerline: { ...base.powerline, enabled: true, theme: 'nord' } };
    expect(newBrick('model', themed).color).toBeUndefined();
  });

  it('moves bricks within and between lines', () => {
    const forward = moveBrick(base, 'model', 0, 2);
    expect(forward.lines[0]!.map((w) => w.id)).toEqual(['context', 'branch', 'model', 'changes']);
    const twoLines = addLine(base);
    const across = moveBrick(twoLines, 'branch', 1, 0);
    expect(across.lines[1]!.map((w) => w.id)).toEqual(['branch']);
  });

  it('caps the number of lines and never leaves zero lines', () => {
    let layout = base;
    for (let i = 0; i < 5; i++) layout = addLine(layout);
    expect(layout.lines.length).toBe(MAX_LINES);
    expect(removeLine({ ...base, lines: [[]] }, 0).lines.length).toBe(1);
  });

  it('removes bricks', () => {
    expect(findBrick(removeBrick(base, 'model'), 'model')).toBeUndefined();
  });
});

describe('ANSI preview parser', () => {
  it('turns SGR codes into styled runs', () => {
    const runs = parseAnsi('\x1b[1m\x1b[38;5;196mhot\x1b[0m cold\x1b[K', palette);
    expect(runs).toEqual([
      { text: 'hot', bold: true, fg: ansi256ToHex(196, palette) },
      { text: ' cold' },
    ]);
  });

  it('keeps OSC 8 links', () => {
    const runs = parseAnsi('\x1b]8;;https://x.dev\x1b\\PR #1\x1b]8;;\x1b\\', palette);
    expect(runs).toEqual([{ text: 'PR #1', href: 'https://x.dev' }]);
  });

  it('reads truecolor', () => {
    expect(parseAnsi('\x1b[48;2;255;0;0mx', palette)[0]!.bg).toBe('#ff0000');
  });
});

describe('colors', () => {
  it('maps config colors through the terminal theme', () => {
    expect(configColorToCss('red', palette)).toBe(palette.red);
    expect(configColorToCss('bgBrightBlue', palette)).toBe(palette.brightBlue);
    expect(configColorToCss('hex:12AB34', palette)).toBe('#12AB34');
    expect(configColorToCss(undefined, palette)).toBeUndefined();
  });

  it('picks readable text', () => {
    expect(readableTextOn('#FDD835')).toBe('#2B2420');
    expect(readableTextOn('#1E88E5')).toBe('#FFFFFF');
  });
});

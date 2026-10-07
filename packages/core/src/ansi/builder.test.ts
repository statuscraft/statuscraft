import { describe, it, expect } from 'vitest';
import {
  AnsiBuilder,
  stripAnsi,
  visibleLength,
  truncateAnsi,
  styledText,
} from './builder';
import { colorNamed, colorHex, colorAnsi256 } from '../types/color';

describe('AnsiBuilder', () => {
  describe('basic operations', () => {
    it('creates empty builder', () => {
      const builder = AnsiBuilder.create();
      expect(builder.isEmpty).toBe(true);
      expect(builder.visibleLength).toBe(0);
      expect(builder.build()).toBe('');
    });

    it('adds plain text', () => {
      const result = AnsiBuilder.create()
        .text('Hello')
        .build();

      expect(result).toBe('Hello');
    });

    it('chains multiple text calls', () => {
      const result = AnsiBuilder.create()
        .text('Hello')
        .text(' ')
        .text('World')
        .build();

      expect(result).toBe('Hello World');
    });
  });

  describe('color styling', () => {
    it('applies foreground color', () => {
      const result = AnsiBuilder.create()
        .fg(colorNamed('cyan'))
        .text('Cyan')
        .build(2);

      expect(result).toContain('\x1b[38;5;30m');
      expect(result).toContain('Cyan');
      expect(result).toContain('\x1b[0m');
    });

    it('applies background color', () => {
      const result = AnsiBuilder.create()
        .bg(colorNamed('bgRed'))
        .text('RedBg')
        .build(2);

      expect(result).toContain('\x1b[48;5;160m');
      expect(result).toContain('RedBg');
    });

    it('applies both fg and bg', () => {
      const result = AnsiBuilder.create()
        .fg('cyan')
        .bg('bgBlue')
        .text('Both')
        .build(2);

      expect(stripAnsi(result)).toBe('Both');
    });

    it('handles hex colors', () => {
      const result = AnsiBuilder.create()
        .fg(colorHex('FF5733'))
        .text('Hex')
        .build(3);

      expect(result).toContain('\x1b[38;2;255;87;51m');
    });

    it('handles ansi256 colors', () => {
      const result = AnsiBuilder.create()
        .fg(colorAnsi256(196))
        .text('Ansi256')
        .build(2);

      expect(result).toContain('\x1b[38;5;196m');
    });
  });

  describe('bold styling', () => {
    it('applies bold', () => {
      const result = AnsiBuilder.create()
        .bold()
        .text('Bold')
        .build(2);

      expect(result).toContain('\x1b[1m');
      expect(result).toContain('Bold');
    });

    it('removes bold with noBold()', () => {
      const result = AnsiBuilder.create()
        .bold()
        .text('Bold')
        .noBold()
        .text('Normal')
        .buildPlain();

      expect(result).toBe('BoldNormal');
    });
  });

  describe('reset', () => {
    it('resets all styling', () => {
      const builder = AnsiBuilder.create()
        .fg('cyan')
        .bg('bgRed')
        .bold()
        .text('Styled')
        .reset()
        .text('Plain');

      expect(builder.buildPlain()).toBe('StyledPlain');
    });
  });

  describe('visible length', () => {
    it('calculates length without ANSI codes', () => {
      const builder = AnsiBuilder.create()
        .fg('cyan')
        .text('Hello')
        .reset()
        .text(' World');

      expect(builder.visibleLength).toBe(11);
    });
  });

  describe('truncation', () => {
    it('does not truncate when under limit', () => {
      const builder = AnsiBuilder.create().text('Short');
      const truncated = builder.truncate(10);

      expect(truncated.visibleLength).toBe(5);
      expect(truncated.buildPlain()).toBe('Short');
    });

    it('truncates long text with ellipsis', () => {
      const builder = AnsiBuilder.create().text('This is a long string');
      const truncated = builder.truncate(10);

      expect(truncated.visibleLength).toBe(10);
      expect(truncated.buildPlain()).toBe('This is...');
    });

    it('truncates styled text preserving styles', () => {
      const builder = AnsiBuilder.create()
        .fg('cyan')
        .text('Cyan text that is long');

      const truncated = builder.truncate(10);
      const result = truncated.build(2);

      expect(stripAnsi(result)).toBe('Cyan te...');
      expect(result).toContain('\x1b[38;5;30m');
    });

    it('handles very small max width', () => {
      const builder = AnsiBuilder.create().text('Long text');
      const truncated = builder.truncate(2);

      expect(truncated.visibleLength).toBe(2);
    });
  });

  describe('padding', () => {
    it('pads short text', () => {
      const builder = AnsiBuilder.create().text('Hi').padEnd(5);

      expect(builder.visibleLength).toBe(5);
      expect(builder.buildPlain()).toBe('Hi   ');
    });

    it('does not pad when already long enough', () => {
      const builder = AnsiBuilder.create().text('Hello').padEnd(3);

      expect(builder.visibleLength).toBe(5);
      expect(builder.buildPlain()).toBe('Hello');
    });
  });

  describe('append', () => {
    it('appends another builder', () => {
      const first = AnsiBuilder.create().fg('cyan').text('First');
      const second = AnsiBuilder.create().fg('red').text('Second');

      const combined = first.append(second);

      expect(combined.visibleLength).toBe(11);
      expect(combined.buildPlain()).toBe('FirstSecond');
    });
  });

  describe('color level handling', () => {
    it('outputs plain text for level 0', () => {
      const result = AnsiBuilder.create()
        .fg('cyan')
        .bold()
        .text('Styled')
        .build(0);

      expect(result).toBe('Styled');
    });

    it('uses ANSI 16 for level 1', () => {
      const result = AnsiBuilder.create()
        .fg(colorNamed('cyan'))
        .text('Cyan')
        .build(1);

      expect(result).toContain('\x1b[36m');
    });
  });
});

describe('utility functions', () => {
  describe('stripAnsi', () => {
    it('removes all ANSI codes', () => {
      const ansi = '\x1b[38;5;30mCyan\x1b[0m \x1b[1mBold\x1b[0m';
      expect(stripAnsi(ansi)).toBe('Cyan Bold');
    });

    it('handles plain text', () => {
      expect(stripAnsi('No codes')).toBe('No codes');
    });
  });

  describe('visibleLength', () => {
    it('calculates length of ANSI string', () => {
      const ansi = '\x1b[38;5;30mHello\x1b[0m';
      expect(visibleLength(ansi)).toBe(5);
    });
  });

  describe('truncateAnsi', () => {
    it('truncates ANSI string preserving codes', () => {
      const ansi = '\x1b[38;5;30mHello World\x1b[0m';
      const truncated = truncateAnsi(ansi, 8);

      expect(visibleLength(truncated)).toBe(8);
      expect(stripAnsi(truncated)).toBe('Hello...');
      expect(truncated).toContain('\x1b[38;5;30mHello');
    });

    it('keeps red red and bold bold', () => {
      const red = truncateAnsi('\x1b[31mhello world\x1b[0m', 8);
      expect(red).toContain('\x1b[31mhello');
      expect(red).not.toContain('\x1b[1m');
      const bold = truncateAnsi('\x1b[1;38;2;255;0;0mhello world\x1b[0m', 8);
      expect(bold).toContain('\x1b[38;2;255;0;0m');
      expect(bold).toContain('\x1b[1m');
      const background = truncateAnsi('\x1b[44;97mhello world\x1b[0m', 8);
      expect(background).toContain('\x1b[97m');
      expect(background).toContain('\x1b[44m');
    });
  });

  describe('styledText', () => {
    it('creates styled text in one call', () => {
      const result = styledText('Hello', { fg: 'cyan', bold: true }, 2);

      expect(stripAnsi(result)).toBe('Hello');
      expect(result).toContain('\x1b[38;5;30m');
      expect(result).toContain('\x1b[1m');
    });
  });
});

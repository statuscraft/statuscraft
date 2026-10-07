import { describe, it, expect } from 'vitest';
import { ansi256ToRgb, colorToAnsiFg, colorToAnsiBg, hexToRgb, rgbToAnsi16, rgbToAnsi256 } from './color-codes';
import { colorNamed, colorHex, colorAnsi256, colorNone } from '../types/color';

describe('colorToAnsiFg', () => {
  it('returns empty for none color', () => {
    expect(colorToAnsiFg(colorNone(), 2)).toBe('');
  });

  it('returns empty for level 0', () => {
    expect(colorToAnsiFg(colorNamed('cyan'), 0)).toBe('');
  });

  it('generates ANSI 16 codes', () => {
    expect(colorToAnsiFg(colorNamed('cyan'), 1)).toBe('\x1b[36m');
    expect(colorToAnsiFg(colorNamed('brightRed'), 1)).toBe('\x1b[91m');
  });

  it('generates ANSI 256 codes', () => {
    expect(colorToAnsiFg(colorNamed('cyan'), 2)).toBe('\x1b[38;5;30m');
    expect(colorToAnsiFg(colorAnsi256(196), 2)).toBe('\x1b[38;5;196m');
  });

  it('generates TrueColor codes', () => {
    expect(colorToAnsiFg(colorHex('FF5733'), 3)).toBe('\x1b[38;2;255;87;51m');
  });
});

describe('colorToAnsiBg', () => {
  it('generates background codes', () => {
    expect(colorToAnsiBg(colorNamed('bgRed'), 1)).toBe('\x1b[41m');
    expect(colorToAnsiBg(colorNamed('bgBrightBlue'), 1)).toBe('\x1b[104m');
  });

  it('generates ANSI 256 background codes', () => {
    expect(colorToAnsiBg(colorAnsi256(196), 2)).toBe('\x1b[48;5;196m');
  });
});

describe('hexToRgb', () => {
  it('parses hex colors', () => {
    expect(hexToRgb('FF5733')).toEqual({ r: 255, g: 87, b: 51 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToAnsi256', () => {
  it('converts grayscale correctly', () => {
    expect(rgbToAnsi256(0, 0, 0)).toBe(16);
    expect(rgbToAnsi256(255, 255, 255)).toBe(231);
  });

  it('keeps every gray inside the 256-color range', () => {
    for (let v = 0; v <= 255; v++) {
      const code = rgbToAnsi256(v, v, v);
      expect(code, `gray ${v}`).toBeGreaterThanOrEqual(16);
      expect(code, `gray ${v}`).toBeLessThanOrEqual(255);
    }
    expect(rgbToAnsi256(245, 245, 245)).toBe(255);
  });

  it('converts colors to cube', () => {
    const redCode = rgbToAnsi256(255, 0, 0);
    expect(redCode).toBeGreaterThanOrEqual(16);
    expect(redCode).toBeLessThanOrEqual(231);
  });
});

describe('16-color terminals', () => {
  it('picks the nearest basic color for hex and 256-color bricks', () => {
    expect(rgbToAnsi16(204, 0, 0)).toBe('red');
    expect(rgbToAnsi16(229, 57, 53)).toBe('brightRed');
    expect(rgbToAnsi16(43, 36, 32)).toBe('black');
    expect(rgbToAnsi16(250, 250, 250)).toBe('brightWhite');
    expect(ansi256ToRgb(196)).toEqual({ r: 255, g: 0, b: 0 });
    expect(ansi256ToRgb(244)).toEqual({ r: 128, g: 128, b: 128 });
    expect(colorToAnsiFg({ type: 'hex', value: '43A047' }, 1)).toBe('\x1b[32m');
    expect(colorToAnsiBg({ type: 'hex', value: '1E88E5' }, 1)).toBe('\x1b[104m');
    expect(colorToAnsiFg({ type: 'ansi256', value: 196 }, 1)).toBe('\x1b[31m');
    expect(colorToAnsiBg({ type: 'ansi256', value: 16 }, 1)).toBe('\x1b[40m');
  });
});

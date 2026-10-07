import { describe, it, expect } from 'vitest';
import {
  parseColor,
  serializeColor,
  colorNamed,
  colorHex,
  colorAnsi256,
  isValidColorName,
  isValidHex,
  isValidAnsi256,
} from './color';

describe('Color Types', () => {
  describe('parseColor', () => {
    it('parses named colors', () => {
      const color = parseColor('cyan');
      expect(color).toEqual({ type: 'named', value: 'cyan' });
    });

    it('parses hex colors', () => {
      const color = parseColor('hex:FF5733');
      expect(color).toEqual({ type: 'hex', value: 'FF5733' });
    });

    it('parses ansi256 colors', () => {
      const color = parseColor('ansi256:196');
      expect(color).toEqual({ type: 'ansi256', value: 196 });
    });

    it('returns none for invalid input', () => {
      expect(parseColor('invalid')).toEqual({ type: 'none' });
      expect(parseColor(undefined)).toEqual({ type: 'none' });
    });
  });

  describe('serializeColor', () => {
    it('serializes named colors', () => {
      expect(serializeColor(colorNamed('cyan'))).toBe('cyan');
    });

    it('serializes hex colors', () => {
      expect(serializeColor(colorHex('FF5733'))).toBe('hex:FF5733');
    });

    it('serializes ansi256 colors', () => {
      expect(serializeColor(colorAnsi256(196))).toBe('ansi256:196');
    });

    it('returns undefined for none', () => {
      expect(serializeColor({ type: 'none' })).toBeUndefined();
    });
  });

  describe('validators', () => {
    it('validates color names', () => {
      expect(isValidColorName('cyan')).toBe(true);
      expect(isValidColorName('invalid')).toBe(false);
    });

    it('validates hex colors', () => {
      expect(isValidHex('FF5733')).toBe(true);
      expect(isValidHex('GGG')).toBe(false);
    });

    it('validates ansi256 codes', () => {
      expect(isValidAnsi256(196)).toBe(true);
      expect(isValidAnsi256(256)).toBe(false);
      expect(isValidAnsi256(-1)).toBe(false);
    });
  });
});

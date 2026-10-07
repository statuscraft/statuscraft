import type { Color, ColorLevel } from '../types/color';
import {
  ANSI16_FG,
  ANSI16_BG,
  ansi256Fg,
  ansi256Bg,
  truecolorFg,
  truecolorBg,
  FG_RESET,
  BG_RESET,
} from './constants';

const NAMED_TO_ANSI256: Record<string, number> = {
  black: 16,
  red: 160,
  green: 70,
  yellow: 178,
  blue: 26,
  magenta: 96,
  cyan: 30,
  white: 188,
  brightBlack: 59,
  brightRed: 203,
  brightGreen: 155,
  brightYellow: 227,
  brightBlue: 111,
  brightMagenta: 140,
  brightCyan: 80,
  brightWhite: 231,
};

const NAMED_TO_HEX: Record<string, string> = {
  black: '000000',
  red: 'cc0000',
  green: '4e9a06',
  yellow: 'c4a000',
  blue: '3465a4',
  magenta: '75507b',
  cyan: '06989a',
  white: 'd3d7cf',
  brightBlack: '555753',
  brightRed: 'ef2929',
  brightGreen: '8ae234',
  brightYellow: 'fce94f',
  brightBlue: '729fcf',
  brightMagenta: 'ad7fa8',
  brightCyan: '34e2e2',
  brightWhite: 'eeeeec',
};

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

type Ansi16Name = keyof typeof ANSI16_FG;

// In terminal order, so codes 0-15 index straight into it
const ANSI16_NAMES = Object.keys(NAMED_TO_HEX) as Ansi16Name[];
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

export function ansi256ToRgb(code: number): { r: number; g: number; b: number } {
  if (code < 16) return hexToRgb(NAMED_TO_HEX[ANSI16_NAMES[code]!]!);
  if (code >= 232) {
    const v = 8 + (code - 232) * 10;
    return { r: v, g: v, b: v };
  }
  const i = code - 16;
  return { r: CUBE_LEVELS[Math.floor(i / 36)]!, g: CUBE_LEVELS[Math.floor(i / 6) % 6]!, b: CUBE_LEVELS[i % 6]! };
}

// The nearest of the 16 basic colors, for terminals that have no others
export function rgbToAnsi16(r: number, g: number, b: number): Ansi16Name {
  let best: Ansi16Name = 'white';
  let bestDistance = Infinity;
  for (const name of ANSI16_NAMES) {
    const c = hexToRgb(NAMED_TO_HEX[name]!);
    // Weighted for how the eye sees red, green and blue
    const distance = 2 * (r - c.r) ** 2 + 4 * (g - c.g) ** 2 + 3 * (b - c.b) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

function toAnsi16Bg(name: Ansi16Name): string {
  return ANSI16_BG[`bg${name.charAt(0).toUpperCase()}${name.slice(1)}` as keyof typeof ANSI16_BG];
}

export function colorToAnsiFg(color: Color, level: ColorLevel): string {
  if (level === 0 || color.type === 'none') {
    return '';
  }

  switch (color.type) {
    case 'named': {
      const name = color.value;

      if (level === 1) {
        return ANSI16_FG[name as keyof typeof ANSI16_FG] ?? '';
      }

      if (level === 2) {
        const code = NAMED_TO_ANSI256[name];
        return code !== undefined ? ansi256Fg(code) : '';
      }

      const hex = NAMED_TO_HEX[name];
      if (hex) {
        const { r, g, b } = hexToRgb(hex);
        return truecolorFg(r, g, b);
      }
      return '';
    }

    case 'hex': {
      if (level === 1) {
        const { r, g, b } = hexToRgb(color.value);
        return ANSI16_FG[rgbToAnsi16(r, g, b)];
      }

      if (level === 2) {
        const { r, g, b } = hexToRgb(color.value);
        const code = rgbToAnsi256(r, g, b);
        return ansi256Fg(code);
      }

      const { r, g, b } = hexToRgb(color.value);
      return truecolorFg(r, g, b);
    }

    case 'ansi256': {
      if (level === 1) {
        const { r, g, b } = ansi256ToRgb(color.value);
        return ANSI16_FG[rgbToAnsi16(r, g, b)];
      }

      return ansi256Fg(color.value);
    }
  }
}

export function colorToAnsiBg(color: Color, level: ColorLevel): string {
  if (level === 0 || color.type === 'none') {
    return '';
  }

  switch (color.type) {
    case 'named': {
      const name = color.value;

      if (level === 1) {
        return ANSI16_BG[name as keyof typeof ANSI16_BG] ?? '';
      }

      if (level === 2) {
        const baseName = name.startsWith('bgBright')
          ? 'bright' + name.slice(8).charAt(0).toUpperCase() + name.slice(9).toLowerCase()
          : name.startsWith('bg')
            ? name.slice(2).toLowerCase()
            : name;
        const code = NAMED_TO_ANSI256[baseName];
        return code !== undefined ? ansi256Bg(code) : '';
      }

      const baseName = name.startsWith('bgBright')
        ? 'bright' + name.slice(8).charAt(0).toUpperCase() + name.slice(9).toLowerCase()
        : name.startsWith('bg')
          ? name.slice(2).toLowerCase()
          : name;
      const hex = NAMED_TO_HEX[baseName];
      if (hex) {
        const { r, g, b } = hexToRgb(hex);
        return truecolorBg(r, g, b);
      }
      return '';
    }

    case 'hex': {
      if (level === 1) {
        const { r, g, b } = hexToRgb(color.value);
        return toAnsi16Bg(rgbToAnsi16(r, g, b));
      }

      if (level === 2) {
        const { r, g, b } = hexToRgb(color.value);
        const code = rgbToAnsi256(r, g, b);
        return ansi256Bg(code);
      }

      const { r, g, b } = hexToRgb(color.value);
      return truecolorBg(r, g, b);
    }

    case 'ansi256': {
      if (level === 1) {
        const { r, g, b } = ansi256ToRgb(color.value);
        return toAnsi16Bg(rgbToAnsi16(r, g, b));
      }

      return ansi256Bg(color.value);
    }
  }
}

export function getFgReset(): string {
  return FG_RESET;
}

export function getBgReset(): string {
  return BG_RESET;
}

export function rgbToAnsi256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    // 24 grays from 232 to 255
    return Math.round(((r - 8) / 247) * 24) + 232;
  }

  const toIndex = (v: number) => {
    if (v < 48) return 0;
    if (v < 115) return 1;
    return Math.min(5, Math.floor((v - 35) / 40));
  };

  return 16 + 36 * toIndex(r) + 6 * toIndex(g) + toIndex(b);
}

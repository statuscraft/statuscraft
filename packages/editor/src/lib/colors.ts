import { NAMED_COLORS, parseColor } from '@statuscraft/core';
import type { AnsiColors } from './terminal-themes';

const ANSI_ORDER = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
] as const;

export type AnsiName = (typeof ANSI_ORDER)[number];

export const FOREGROUND_NAMES: readonly AnsiName[] = ANSI_ORDER;

export function ansi256ToHex(code: number, palette: AnsiColors): string {
  if (code < 16) return palette[ANSI_ORDER[code]!];
  if (code < 232) {
    const n = code - 16;
    const level = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return rgbToHex(level(Math.floor(n / 36)), level(Math.floor((n % 36) / 6)), level(n % 6));
  }
  const gray = 8 + (code - 232) * 10;
  return rgbToHex(gray, gray, gray);
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

export function configColorToCss(value: string | undefined, palette: AnsiColors): string | undefined {
  const color = parseColor(value);
  switch (color.type) {
    case 'none':
      return undefined;
    case 'hex':
      return `#${color.value}`;
    case 'ansi256':
      return ansi256ToHex(color.value, palette);
    case 'named': {
      const name = String(color.value).replace(/^bg/, '');
      const key = (name.charAt(0).toLowerCase() + name.slice(1)) as AnsiName;
      return palette[key];
    }
  }
}

export function readableTextOn(hex: string): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.55 ? '#2B2420' : '#FFFFFF';
}

export function toBackgroundName(name: string): string {
  return NAMED_COLORS.includes(name as never) && !name.startsWith('bg') ? `bg${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
}

export const CATEGORY_COLORS: Record<string, string> = {
  model: '#1E88E5',
  context: '#8E24AA',
  usage: '#43A047',
  time: '#FB8C00',
  git: '#00897B',
  system: '#546E7A',
  fun: '#FDD835',
  custom: '#D81B60',
  layout: '#B0BEC5',
};

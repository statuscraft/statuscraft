import type { Brand } from './brand';

export type ColorName = Brand<string, 'ColorName'>;
export type HexColor = Brand<string, 'HexColor'>;
export type Ansi256Code = Brand<number, 'Ansi256Code'>;

export type ColorLevel = 0 | 1 | 2 | 3;
export type ColorLevelName = 'disabled' | 'ansi16' | 'ansi256' | 'truecolor';

export type Color =
  | { readonly type: 'named'; readonly value: ColorName }
  | { readonly type: 'hex'; readonly value: HexColor }
  | { readonly type: 'ansi256'; readonly value: Ansi256Code }
  | { readonly type: 'none' };

export const NAMED_COLORS = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
  'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
  'bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
  'bgBrightBlack', 'bgBrightRed', 'bgBrightGreen', 'bgBrightYellow',
  'bgBrightBlue', 'bgBrightMagenta', 'bgBrightCyan', 'bgBrightWhite',
] as const;

export type NamedColor = typeof NAMED_COLORS[number];

export function isValidColorName(s: string): s is ColorName {
  return NAMED_COLORS.includes(s as NamedColor);
}

export function isValidHex(s: string): s is HexColor {
  return /^[0-9A-Fa-f]{6}$/.test(s);
}

export function isValidAnsi256(n: number): n is Ansi256Code {
  return Number.isInteger(n) && n >= 0 && n <= 255;
}

export function colorNamed(name: string): Color {
  if (!isValidColorName(name)) {
    return { type: 'none' };
  }
  return { type: 'named', value: name as ColorName };
}

export function colorHex(hex: string): Color {
  const cleaned = hex.replace(/^#/, '');
  if (!isValidHex(cleaned)) {
    return { type: 'none' };
  }
  return { type: 'hex', value: cleaned as HexColor };
}

export function colorAnsi256(code: number): Color {
  if (!isValidAnsi256(code)) {
    return { type: 'none' };
  }
  return { type: 'ansi256', value: code as Ansi256Code };
}

export function colorNone(): Color {
  return { type: 'none' };
}

export function parseColor(input: string | undefined): Color {
  if (!input) return colorNone();

  if (input.startsWith('hex:')) {
    return colorHex(input.slice(4));
  }

  if (input.startsWith('ansi256:')) {
    const code = parseInt(input.slice(8), 10);
    return colorAnsi256(code);
  }

  return colorNamed(input);
}

export function serializeColor(color: Color): string | undefined {
  switch (color.type) {
    case 'none':
      return undefined;
    case 'named':
      return color.value;
    case 'hex':
      return `hex:${color.value}`;
    case 'ansi256':
      return `ansi256:${color.value}`;
  }
}

export function getColorLevelName(level: ColorLevel): ColorLevelName {
  switch (level) {
    case 0: return 'disabled';
    case 1: return 'ansi16';
    case 2: return 'ansi256';
    case 3: return 'truecolor';
  }
}

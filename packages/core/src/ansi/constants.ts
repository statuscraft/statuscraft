export const ESC = '\x1b';
export const CSI = `${ESC}[`;  // Control Sequence Introducer

export const RESET = `${CSI}0m`;
export const BOLD = `${CSI}1m`;
export const BOLD_OFF = `${CSI}22m`;
export const DIM = `${CSI}2m`;
export const DIM_OFF = `${CSI}22m`;
export const ITALIC = `${CSI}3m`;
export const ITALIC_OFF = `${CSI}23m`;
export const UNDERLINE = `${CSI}4m`;
export const UNDERLINE_OFF = `${CSI}24m`;

export const FG_RESET = `${CSI}39m`;
export const BG_RESET = `${CSI}49m`;

export const CLEAR_TO_EOL = `${CSI}K`;

export const ANSI16_FG = {
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  brightBlack: `${CSI}90m`,
  brightRed: `${CSI}91m`,
  brightGreen: `${CSI}92m`,
  brightYellow: `${CSI}93m`,
  brightBlue: `${CSI}94m`,
  brightMagenta: `${CSI}95m`,
  brightCyan: `${CSI}96m`,
  brightWhite: `${CSI}97m`,
} as const;

export const ANSI16_BG = {
  bgBlack: `${CSI}40m`,
  bgRed: `${CSI}41m`,
  bgGreen: `${CSI}42m`,
  bgYellow: `${CSI}43m`,
  bgBlue: `${CSI}44m`,
  bgMagenta: `${CSI}45m`,
  bgCyan: `${CSI}46m`,
  bgWhite: `${CSI}47m`,
  bgBrightBlack: `${CSI}100m`,
  bgBrightRed: `${CSI}101m`,
  bgBrightGreen: `${CSI}102m`,
  bgBrightYellow: `${CSI}103m`,
  bgBrightBlue: `${CSI}104m`,
  bgBrightMagenta: `${CSI}105m`,
  bgBrightCyan: `${CSI}106m`,
  bgBrightWhite: `${CSI}107m`,
} as const;

export function ansi256Fg(code: number): string {
  return `${CSI}38;5;${code}m`;
}

export function ansi256Bg(code: number): string {
  return `${CSI}48;5;${code}m`;
}

export function truecolorFg(r: number, g: number, b: number): string {
  return `${CSI}38;2;${r};${g};${b}m`;
}

export function truecolorBg(r: number, g: number, b: number): string {
  return `${CSI}48;2;${r};${g};${b}m`;
}

export const LAYOUT = {
  TERMINAL_PADDING: 6,
  CLAUDE_UI_WIDTH: 40,
  ELLIPSIS: '...',
  ELLIPSIS_LENGTH: 3,
  MIN_CONTENT_WIDTH: 20,
} as const;

// SGR codes, erase-line, and OSC 8 hyperlinks
export const ANSI_REGEX = new RegExp(`${ESC}\\[[0-9;]*[mK]|${ESC}\\]8;;[^\\u0007${ESC}]*(?:\\u0007|${ESC}\\\\)`, 'g');

export const ANSI_START_REGEX = new RegExp(`^(${ESC}\\[[0-9;]*m)`);

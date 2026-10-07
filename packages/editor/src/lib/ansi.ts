import { parseAnsiRuns, runColorCode, type TextRun } from '@statuscraft/core';
import { ansi256ToHex } from './colors';
import type { AnsiColors } from './terminal-themes';

export interface StyledRun {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
}

// Colors in runs from @statuscraft/core are "ansi256(n)" or "#rrggbb"; the preview needs CSS
export function runColorToCss(color: string | undefined, palette: AnsiColors): string | undefined {
  const code = runColorCode(color);
  return code === undefined ? color : ansi256ToHex(code, palette);
}

export function resolveRuns(runs: readonly TextRun[], palette: AnsiColors): StyledRun[] {
  return runs.map((run) => ({ ...run, fg: runColorToCss(run.fg, palette), bg: runColorToCss(run.bg, palette) }));
}

export function parseAnsi(line: string, palette: AnsiColors): StyledRun[] {
  return resolveRuns(parseAnsiRuns(line), palette);
}

// Drawn as shapes in the preview, so they show without a Nerd Font
export const POWERLINE_GLYPHS: Record<string, 'arrow-right' | 'arrow-left' | 'thin-right' | 'thin-left' | 'round-right' | 'round-left' | 'slash-up' | 'slash-down'> = {
  '\uE0B0': 'arrow-right',
  '\uE0B1': 'thin-right',
  '\uE0B2': 'arrow-left',
  '\uE0B3': 'thin-left',
  '\uE0B4': 'round-right',
  '\uE0B5': 'thin-right',
  '\uE0B6': 'round-left',
  '\uE0B7': 'thin-left',
  '\uE0BC': 'slash-up',
  '\uE0BD': 'slash-up',
  '\uE0BE': 'slash-down',
  '\uE0BF': 'slash-down',
  '\uE0C0': 'arrow-right',
  '\uE0C2': 'arrow-left',
  '\uE0C4': 'arrow-right',
  '\uE0C5': 'arrow-left',
};

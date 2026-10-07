import type { FlexMode, LayoutConstraints } from './types';
import { LAYOUT } from '../ansi/constants';

export function calculateEffectiveWidth(
  terminalWidth: number,
  flexMode: FlexMode,
  compactThreshold: number,
  contextPercent?: number
): number {
  switch (flexMode) {
    case 'full':
      return Math.max(1, terminalWidth - LAYOUT.TERMINAL_PADDING);

    case 'full-minus-40':
      return Math.max(1, terminalWidth - LAYOUT.CLAUDE_UI_WIDTH);

    // compactThreshold is a context percentage: past it, Claude Code shows its
    // auto-compact notice on the right, so leave room for that
    case 'full-until-compact':
      if ((contextPercent ?? 0) < compactThreshold) {
        return Math.max(1, terminalWidth - LAYOUT.TERMINAL_PADDING);
      }
      return Math.max(1, terminalWidth - LAYOUT.CLAUDE_UI_WIDTH);

    default:
      return Math.max(1, terminalWidth - LAYOUT.CLAUDE_UI_WIDTH);
  }
}

export function createConstraints(
  terminalWidth: number,
  flexMode: FlexMode,
  compactThreshold: number,
  defaultSeparator = ' | ',
  defaultPadding = ' ',
  contextPercent?: number
): LayoutConstraints {
  return {
    maxWidth: calculateEffectiveWidth(terminalWidth, flexMode, compactThreshold, contextPercent),
    minContentWidth: LAYOUT.MIN_CONTENT_WIDTH,
    defaultSeparator,
    defaultPadding,
  };
}

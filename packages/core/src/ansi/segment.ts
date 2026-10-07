import type { Color, ColorLevel } from '../types/color';
import { colorToAnsiFg, colorToAnsiBg } from './color-codes';
import { BOLD, RESET } from './constants';

export interface Segment {
  readonly content: string;
  readonly fg: Color;
  readonly bg: Color;
  readonly bold: boolean;
}

export function createSegment(content: string): Segment {
  return {
    content,
    fg: { type: 'none' },
    bg: { type: 'none' },
    bold: false,
  };
}

export function createStyledSegment(
  content: string,
  fg: Color,
  bg: Color,
  bold: boolean
): Segment {
  return { content, fg, bg, bold };
}

export function segmentToAnsi(segment: Segment, level: ColorLevel): string {
  if (level === 0) {
    return segment.content;
  }

  const parts: string[] = [];

  const bgCode = colorToAnsiBg(segment.bg, level);
  if (bgCode) {
    parts.push(bgCode);
  }

  const fgCode = colorToAnsiFg(segment.fg, level);
  if (fgCode) {
    parts.push(fgCode);
  }

  if (segment.bold) {
    parts.push(BOLD);
  }

  parts.push(segment.content);

  if (bgCode || fgCode || segment.bold) {
    parts.push(RESET);
  }

  return parts.join('');
}

export function segmentVisibleLength(segment: Segment): number {
  return segment.content.length;
}

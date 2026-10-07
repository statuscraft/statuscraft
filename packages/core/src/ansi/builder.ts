import type { Color, ColorLevel } from '../types/color';
import type { Segment } from './segment';
import {
  createSegment,
  createStyledSegment,
  segmentToAnsi,
  segmentVisibleLength
} from './segment';
import { colorAnsi256, colorHex, colorNamed, colorNone, parseColor } from '../types/color';
import { ANSI_REGEX, LAYOUT } from './constants';

export class AnsiBuilder {
  private readonly segments: readonly Segment[];
  private readonly currentFg: Color;
  private readonly currentBg: Color;
  private readonly currentBold: boolean;

  constructor(
    segments: readonly Segment[] = [],
    fg: Color = colorNone(),
    bg: Color = colorNone(),
    bold = false
  ) {
    this.segments = segments;
    this.currentFg = fg;
    this.currentBg = bg;
    this.currentBold = bold;
  }

  static create(): AnsiBuilder {
    return new AnsiBuilder();
  }

  static fromAnsi(ansiString: string): AnsiBuilder {
    const segments: Segment[] = [];
    let currentFg: Color = colorNone();
    let currentBg: Color = colorNone();
    let currentBold = false;

    const parts = ansiString.split(ANSI_REGEX);
    const codes = ansiString.match(ANSI_REGEX) ?? [];

    for (let i = 0; i < parts.length; i++) {
      const text = parts[i];
      if (text && text.length > 0) {
        segments.push(createStyledSegment(text, currentFg, currentBg, currentBold));
      }

      const code = codes[i];
      // Only SGR codes style text; erase-line and hyperlinks pass by
      const sgr = code && /^\x1b\[([0-9;]*)m$/.exec(code);
      if (!sgr) continue;
      const params = (sgr[1] || '0').split(';').map((p) => Number(p || 0));
      for (let p = 0; p < params.length; p++) {
        const n = params[p]!;
        if (n === 0) {
          currentFg = colorNone();
          currentBg = colorNone();
          currentBold = false;
        } else if (n === 1) {
          currentBold = true;
        } else if (n === 22) {
          currentBold = false;
        } else if (n === 39) {
          currentFg = colorNone();
        } else if (n === 49) {
          currentBg = colorNone();
        } else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) {
          currentFg = colorNamed(sgrColorName(n % 10, n >= 90));
        } else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) {
          const name = sgrColorName(n % 10, n >= 100);
          currentBg = colorNamed(`bg${name.charAt(0).toUpperCase()}${name.slice(1)}`);
        } else if ((n === 38 || n === 48) && params[p + 1] === 5) {
          const color = colorAnsi256(params[p + 2] ?? -1);
          if (n === 38) currentFg = color;
          else currentBg = color;
          p += 2;
        } else if ((n === 38 || n === 48) && params[p + 1] === 2) {
          const hex = params.slice(p + 2, p + 5).map((v) => v.toString(16).padStart(2, '0')).join('');
          const color = colorHex(hex);
          if (n === 38) currentFg = color;
          else currentBg = color;
          p += 4;
        }
      }
    }

    return new AnsiBuilder(segments, currentFg, currentBg, currentBold);
  }

  text(content: string): AnsiBuilder {
    if (content.length === 0) {
      return this;
    }

    const segment = createStyledSegment(
      content,
      this.currentFg,
      this.currentBg,
      this.currentBold
    );

    return new AnsiBuilder(
      [...this.segments, segment],
      this.currentFg,
      this.currentBg,
      this.currentBold
    );
  }

  fg(color: Color | string): AnsiBuilder {
    const parsedColor = typeof color === 'string' ? parseColor(color) : color;
    return new AnsiBuilder(
      this.segments,
      parsedColor,
      this.currentBg,
      this.currentBold
    );
  }

  bg(color: Color | string): AnsiBuilder {
    const parsedColor = typeof color === 'string' ? parseColor(color) : color;
    return new AnsiBuilder(
      this.segments,
      this.currentFg,
      parsedColor,
      this.currentBold
    );
  }

  bold(): AnsiBuilder {
    return new AnsiBuilder(
      this.segments,
      this.currentFg,
      this.currentBg,
      true
    );
  }

  noBold(): AnsiBuilder {
    return new AnsiBuilder(
      this.segments,
      this.currentFg,
      this.currentBg,
      false
    );
  }

  reset(): AnsiBuilder {
    return new AnsiBuilder(
      this.segments,
      colorNone(),
      colorNone(),
      false
    );
  }

  append(other: AnsiBuilder): AnsiBuilder {
    return new AnsiBuilder(
      [...this.segments, ...other.segments],
      other.currentFg,
      other.currentBg,
      other.currentBold
    );
  }

  get visibleLength(): number {
    return this.segments.reduce(
      (sum, seg) => sum + segmentVisibleLength(seg),
      0
    );
  }

  get isEmpty(): boolean {
    return this.segments.length === 0;
  }

  truncate(maxWidth: number, ellipsis = LAYOUT.ELLIPSIS): AnsiBuilder {
    const currentLength = this.visibleLength;

    if (currentLength <= maxWidth) {
      return this;
    }

    const ellipsisLength = ellipsis.length;
    const targetLength = maxWidth - ellipsisLength;

    if (targetLength <= 0) {
      return new AnsiBuilder([createSegment(ellipsis.slice(0, maxWidth))]);
    }

    const newSegments: Segment[] = [];
    let remaining = targetLength;

    for (const segment of this.segments) {
      const segLen = segmentVisibleLength(segment);

      if (remaining <= 0) {
        break;
      }

      if (segLen <= remaining) {
        newSegments.push(segment);
        remaining -= segLen;
      } else {
        const truncatedContent = segment.content.slice(0, remaining);
        newSegments.push(createStyledSegment(
          truncatedContent,
          segment.fg,
          segment.bg,
          segment.bold
        ));
        remaining = 0;
      }
    }

    newSegments.push(createSegment(ellipsis));

    return new AnsiBuilder(
      newSegments,
      colorNone(),
      colorNone(),
      false
    );
  }

  padEnd(minWidth: number, padChar = ' '): AnsiBuilder {
    const currentLength = this.visibleLength;

    if (currentLength >= minWidth) {
      return this;
    }

    const padding = padChar.repeat(minWidth - currentLength);
    return this.text(padding);
  }

  build(level: ColorLevel = 2): string {
    return this.segments
      .map(seg => segmentToAnsi(seg, level))
      .join('');
  }

  buildPlain(): string {
    return this.segments
      .map(seg => seg.content)
      .join('');
  }
}

export function styledText(
  content: string,
  options: {
    fg?: Color | string;
    bg?: Color | string;
    bold?: boolean;
  } = {},
  level: ColorLevel = 2
): string {
  let builder = AnsiBuilder.create();

  if (options.fg) {
    builder = builder.fg(options.fg);
  }
  if (options.bg) {
    builder = builder.bg(options.bg);
  }
  if (options.bold) {
    builder = builder.bold();
  }

  return builder.text(content).build(level);
}

const SGR_COLOR_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

function sgrColorName(index: number, bright: boolean): string {
  const name = SGR_COLOR_NAMES[index] ?? 'white';
  return bright ? `bright${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
}

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function truncateAnsi(
  str: string,
  maxWidth: number,
  ellipsis = LAYOUT.ELLIPSIS
): string {
  const visible = stripAnsi(str);

  if (visible.length <= maxWidth) {
    return str;
  }

  // Rebuild at the color depth the string came in, so its colors come back unchanged
  const level: ColorLevel = /\x1b\[[0-9;]*[34]8;2;/.test(str) ? 3 : /\x1b\[[0-9;]*[34]8;5;/.test(str) ? 2 : 1;
  return AnsiBuilder.fromAnsi(str)
    .truncate(maxWidth, ellipsis)
    .build(level);
}

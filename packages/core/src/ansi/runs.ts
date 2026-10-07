// Splits ANSI text into styled runs with palette-free colors: "ansi256(n)" (0-15 are the
// terminal's own palette) or "#rrggbb". The editor turns them into CSS for the preview, and
// the mod hands them to Claude Code's Text element, which refuses escape codes.
export interface TextRun {
  readonly text: string;
  readonly fg?: string;
  readonly bg?: string;
  readonly bold?: boolean;
  readonly dim?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly href?: string;
}

type Style = { -readonly [K in keyof Omit<TextRun, 'text'>]?: TextRun[K] };

const TOKEN = /\x1b\[([0-9;]*)m|\x1b\[[0-9;]*K|\x1b\]8;;([^\x07\x1b]*)(?:\x07|\x1b\\)/g;

export function parseAnsiRuns(line: string): TextRun[] {
  const runs: { text: string; style: Style }[] = [];
  let style: Style = {};
  let last = 0;

  const push = (text: string) => {
    if (!text) return;
    const previous = runs[runs.length - 1];
    if (previous && sameStyle(previous.style, style)) previous.text += text;
    else runs.push({ text, style: { ...style } });
  };

  for (const match of line.matchAll(TOKEN)) {
    push(line.slice(last, match.index));
    last = match.index! + match[0].length;
    if (match[1] !== undefined) style = applySgr(style, match[1]);
    else if (match[2] !== undefined) style = { ...style, href: match[2] || undefined };
  }
  push(line.slice(last));
  return runs.map(({ text, style: s }) => ({ text, ...s }));
}

function rgb(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function applySgr(current: Style, params: string): Style {
  const codes = params === '' ? [0] : params.split(';').map(Number);
  let style: Style = { ...current };
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    if (code === 0) style = { href: style.href };
    else if (code === 1) style.bold = true;
    else if (code === 2) style.dim = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 22) style.bold = style.dim = undefined;
    else if (code === 23) style.italic = undefined;
    else if (code === 24) style.underline = undefined;
    else if (code >= 30 && code <= 37) style.fg = `ansi256(${code - 30})`;
    else if (code >= 90 && code <= 97) style.fg = `ansi256(${code - 82})`;
    else if (code >= 40 && code <= 47) style.bg = `ansi256(${code - 40})`;
    else if (code >= 100 && code <= 107) style.bg = `ansi256(${code - 92})`;
    else if (code === 39) style.fg = undefined;
    else if (code === 49) style.bg = undefined;
    else if (code === 38 || code === 48) {
      const target = code === 38 ? 'fg' : 'bg';
      if (codes[i + 1] === 5) {
        style[target] = `ansi256(${codes[i + 2] ?? 0})`;
        i += 2;
      } else if (codes[i + 1] === 2) {
        style[target] = rgb(codes[i + 2] ?? 0, codes[i + 3] ?? 0, codes[i + 4] ?? 0);
        i += 4;
      }
    }
  }
  return style;
}

function sameStyle(a: Style, b: Style): boolean {
  return a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.dim === b.dim && a.italic === b.italic && a.underline === b.underline && a.href === b.href;
}

// "ansi256(n)" -> n, for colors that came from parseAnsiRuns
export function runColorCode(color: string | undefined): number | undefined {
  const match = color?.match(/^ansi256\((\d{1,3})\)$/);
  return match ? Number(match[1]) : undefined;
}

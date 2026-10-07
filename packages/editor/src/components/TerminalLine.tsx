import { useMemo } from 'react';
import type { TextRun } from '@statuscraft/core';
import { parseAnsi, POWERLINE_GLYPHS, resolveRuns, type StyledRun } from '../lib/ansi';
import type { AnsiColors } from '../lib/terminal-themes';

const SHAPES: Record<string, string> = {
  'arrow-right': 'M0 0 L10 10 L0 20 Z',
  'arrow-left': 'M10 0 L0 10 L10 20 Z',
  'round-right': 'M0 0 C13 0 13 20 0 20 Z',
  'round-left': 'M10 0 C-3 0 -3 20 10 20 Z',
  'slash-up': 'M0 20 L10 0 L10 20 Z',
  'slash-down': 'M0 0 L10 0 L0 20 Z',
};

function Glyph({ kind, fg, bg }: { kind: string; fg: string; bg?: string }) {
  const thin = kind.startsWith('thin');
  return (
    <svg
      viewBox="0 0 10 20"
      preserveAspectRatio="none"
      className="inline-block align-top"
      style={{ width: '1ch', height: 20, background: bg }}
      aria-hidden
    >
      {thin ? (
        <path d={kind === 'thin-right' ? 'M1 0 L9 10 L1 20' : 'M9 0 L1 10 L9 20'} fill="none" stroke={fg} strokeWidth="1.5" />
      ) : (
        <path d={SHAPES[kind]} fill={fg} />
      )}
    </svg>
  );
}

function Run({ run, palette }: { run: StyledRun; palette: AnsiColors }) {
  const fg = run.fg ?? palette.foreground;
  const style: React.CSSProperties = {
    // Same box as the glyph shapes, so backgrounds and arrows line up
    display: 'inline-block',
    height: 20,
    lineHeight: '20px',
    verticalAlign: 'top',
    color: fg,
    background: run.bg,
    fontWeight: run.bold ? 700 : undefined,
    opacity: run.dim ? 0.6 : undefined,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: run.underline || run.href ? 'underline' : undefined,
    textDecorationStyle: run.href ? 'dotted' : undefined,
  };

  const parts: React.ReactNode[] = [];
  let buffer = '';
  [...run.text].forEach((char, i) => {
    const kind = POWERLINE_GLYPHS[char];
    if (!kind) {
      buffer += char;
      return;
    }
    if (buffer) parts.push(<span key={`t${i}`} style={style}>{buffer}</span>);
    buffer = '';
    parts.push(<Glyph key={`g${i}`} kind={kind} fg={fg} bg={run.bg} />);
  });
  if (buffer) parts.push(<span key="end" style={style}>{buffer}</span>);

  return run.href ? (
    <a href={run.href} target="_blank" rel="noreferrer" title={run.href}>
      {parts}
    </a>
  ) : (
    <>{parts}</>
  );
}

// Pass either ANSI text (the status line) or runs (what a mod draws)
export function TerminalLine({ ansi, runs: textRuns, palette, className }: { ansi?: string; runs?: readonly TextRun[]; palette: AnsiColors; className?: string }) {
  const runs = useMemo(() => (textRuns ? resolveRuns(textRuns, palette) : parseAnsi(ansi ?? '', palette)), [ansi, textRuns, palette]);
  return (
    <div className={className ? `terminal-line ${className}` : 'terminal-line'}>
      {runs.length === 0 ? ' ' : runs.map((run, i) => <Run key={i} run={run} palette={palette} />)}
    </div>
  );
}

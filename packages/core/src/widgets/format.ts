export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(2).replace(/\.?0+$/, '')}M`;
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export function formatCountdown(resetsAtSeconds: number, nowMs: number): string {
  const ms = resetsAtSeconds * 1000 - nowMs;
  if (ms <= 60_000) return '<1m';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${String(minutes % 60).padStart(2, '0')}m`;
  return `${minutes}m`;
}

export function formatCost(usd: number): string {
  if (usd > 0 && usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function progressBar(percent: number, width: number, style: string): string {
  const [full, empty] = BAR_STYLES[style] ?? BAR_STYLES['blocks']!;
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  return full.repeat(filled) + empty.repeat(width - filled);
}

export const BAR_STYLES: Record<string, readonly [string, string]> = {
  blocks: ['█', '░'],
  shades: ['▓', '░'],
  bricks: ['▰', '▱'],
  dots: ['●', '○'],
  ascii: ['#', '-'],
};

export function hyperlink(text: string, url: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

export function shortenHome(path: string, home: string | undefined): string {
  if (home && (path === home || path.startsWith(home + '/') || path.startsWith(home + '\\'))) {
    return '~' + path.slice(home.length);
  }
  return path;
}

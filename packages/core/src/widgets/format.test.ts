import { describe, expect, it } from 'vitest';
import { formatCost, formatCountdown, formatDuration, formatTokens, progressBar, shortenHome } from './format';

describe('formatters', () => {
  it('formats tokens compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1_200)).toBe('1.2k');
    expect(formatTokens(56_400)).toBe('56k');
    expect(formatTokens(1_250_000)).toBe('1.25M');
  });

  it('formats durations', () => {
    expect(formatDuration(9_000)).toBe('9s');
    expect(formatDuration(95_000)).toBe('1m 35s');
    expect(formatDuration(5_400_000)).toBe('1h 30m');
    expect(formatDuration(90_000_000)).toBe('1d 1h');
  });

  it('formats countdowns from epoch seconds', () => {
    const now = 1_000_000_000_000;
    expect(formatCountdown(now / 1000 + 30, now)).toBe('<1m');
    expect(formatCountdown(now / 1000 + 23 * 60, now)).toBe('23m');
    expect(formatCountdown(now / 1000 + 2 * 3600 + 5 * 60, now)).toBe('2h05m');
  });

  it('formats cost', () => {
    expect(formatCost(0.004)).toBe('$0.004');
    expect(formatCost(3.871)).toBe('$3.87');
  });

  it('draws progress bars', () => {
    expect(progressBar(50, 10, 'ascii')).toBe('#####-----');
    expect(progressBar(150, 4, 'ascii')).toBe('####');
  });

  it('shortens the home folder', () => {
    expect(shortenHome('/home/you/code', '/home/you')).toBe('~/code');
    expect(shortenHome('/home/younger', '/home/you')).toBe('/home/younger');
  });
});

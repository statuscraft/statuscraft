import { describe, it, expect } from 'vitest';
import { calculateEffectiveWidth, createConstraints } from './terminal';

describe('calculateEffectiveWidth', () => {
  it('calculates full mode width', () => {
    const width = calculateEffectiveWidth(120, 'full', 60);
    expect(width).toBe(114);  // 120 - 6 padding
  });

  it('calculates full-minus-40 mode width', () => {
    const width = calculateEffectiveWidth(120, 'full-minus-40', 60);
    expect(width).toBe(80);  // 120 - 40
  });

  it('uses the full width until the context passes the threshold', () => {
    expect(calculateEffectiveWidth(120, 'full-until-compact', 60, 30)).toBe(114);  // 120 - 6
    expect(calculateEffectiveWidth(120, 'full-until-compact', 60)).toBe(114);  // no context yet
  });

  it('leaves room for the compact notice from the threshold on', () => {
    expect(calculateEffectiveWidth(120, 'full-until-compact', 60, 60)).toBe(80);  // 120 - 40
    expect(calculateEffectiveWidth(120, 'full-until-compact', 60, 92)).toBe(80);
  });

  it('never returns zero or negative', () => {
    expect(calculateEffectiveWidth(5, 'full-minus-40', 60)).toBeGreaterThanOrEqual(1);
    expect(calculateEffectiveWidth(0, 'full', 60)).toBeGreaterThanOrEqual(1);
    expect(calculateEffectiveWidth(-10, 'full', 60)).toBeGreaterThanOrEqual(1);
  });

  it('handles unknown flex mode with default', () => {
    const width = calculateEffectiveWidth(120, 'unknown' as 'full', 60);
    expect(width).toBe(80);  // Default to full-minus-40 behavior
  });

  it('handles small terminal widths', () => {
    expect(calculateEffectiveWidth(10, 'full', 60)).toBe(4);  // 10 - 6
    expect(calculateEffectiveWidth(6, 'full', 60)).toBe(1);   // Clamped to 1
  });
});

describe('createConstraints', () => {
  it('creates constraints with defaults', () => {
    const constraints = createConstraints(100, 'full-minus-40', 60);

    expect(constraints.maxWidth).toBe(60);
    expect(constraints.minContentWidth).toBe(20);
    expect(constraints.defaultSeparator).toBe(' | ');
    expect(constraints.defaultPadding).toBe(' ');
  });

  it('accepts custom separator and padding', () => {
    const constraints = createConstraints(100, 'full', 60, '|', '');

    expect(constraints.defaultSeparator).toBe('|');
    expect(constraints.defaultPadding).toBe('');
  });

  it('calculates maxWidth based on flex mode', () => {
    const fullConstraints = createConstraints(100, 'full', 60);
    const minus40Constraints = createConstraints(100, 'full-minus-40', 60);

    expect(fullConstraints.maxWidth).toBe(94);  // 100 - 6
    expect(minus40Constraints.maxWidth).toBe(60);  // 100 - 40
  });

  it('uses compactThreshold for full-until-compact', () => {
    const pastThreshold = createConstraints(100, 'full-until-compact', 80, ' | ', ' ', 85);
    const belowThreshold = createConstraints(100, 'full-until-compact', 80, ' | ', ' ', 40);

    expect(pastThreshold.maxWidth).toBe(60);  // 100 - 40
    expect(belowThreshold.maxWidth).toBe(94);  // 100 - 6 (full mode)
  });
});


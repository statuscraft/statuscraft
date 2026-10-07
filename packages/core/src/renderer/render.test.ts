import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../ansi/builder';
import { createScenarioContext } from '../input/samples';
import { parseStatusInput, contextPercent } from '../input/parse';
import { createDefaultSettings } from '../types/settings';
import { renderStatusLines, renderStatusText } from './render';
import { PRESETS } from '../config/presets';
import { calculateEffectiveWidth } from '../layout/terminal';
import type { Settings } from '../types/settings';

const NOW = Date.UTC(2026, 9, 5, 14, 30);

describe('renderStatusText', () => {
  it('draws the default layout for a busy session', () => {
    const text = stripAnsi(renderStatusText(createDefaultSettings(), createScenarioContext('busy', { now: NOW })));
    expect(text).toBe('Opus 5.5 │ Ctx 56% │ feature/login │ +128 -31');
  });

  it('leaves no dangling separator when a widget hides itself', () => {
    const text = stripAnsi(renderStatusText(createDefaultSettings(), createScenarioContext('calm', { now: NOW })));
    expect(text).toBe('Opus 5.5 │ Ctx 18% │ main');
  });

  it('measures clickable links by their visible text', () => {
    const settings = { ...createDefaultSettings(), lines: [[{ id: 'p', type: 'pull-request' }, { id: 'f', type: 'flex-separator' }, { id: 'm', type: 'model' }]] };
    const [line] = renderStatusLines(settings, createScenarioContext('busy', { now: NOW, terminalWidth: 80 }));
    expect(line!.visibleLength).toBe(40);
  });

  it('skips lines that end up empty', () => {
    const settings = { ...createDefaultSettings(), lines: [[{ id: 'm', type: 'model' }], [{ id: 'g', type: 'git-changes' }]] };
    expect(stripAnsi(renderStatusText(settings, createScenarioContext('calm', { now: NOW })))).toBe('Opus 5.5');
  });
});

describe('parseStatusInput', () => {
  it('accepts objects only', () => {
    expect(parseStatusInput('{"model":{"display_name":"Opus"}}')?.model?.display_name).toBe('Opus');
    expect(parseStatusInput('[1]')).toBeNull();
    expect(parseStatusInput('not json')).toBeNull();
  });

  it('computes context use when Claude Code omits the percentage', () => {
    expect(contextPercent({ context_window: { total_input_tokens: 50_000, context_window_size: 200_000 } })).toBe(25);
    expect(contextPercent({ context_window: { used_percentage: 42 } })).toBe(42);
    expect(contextPercent({})).toBeUndefined();
  });
});

describe('fitting the width', () => {
  it('keeps every starter kit inside its width budget', () => {
    for (const preset of PRESETS) {
      for (const width of [60, 80, 100, 140]) {
        const budget = calculateEffectiveWidth(width, preset.layout.flexMode, preset.layout.compactThreshold);
        for (const scenario of ['busy', 'danger'] as const) {
          const lines = renderStatusLines(preset.layout, createScenarioContext(scenario, { now: NOW, terminalWidth: width }), width);
          for (const line of lines) expect(line.visibleLength, `${preset.id} at ${width}, ${scenario}`).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  it('shortens the widget at the edge and leaves no separator behind', () => {
    const settings = {
      ...createDefaultSettings(),
      lines: [['x', 'y', 'z'].map((c) => ({ id: c, type: 'custom-text', customText: c.repeat(30) }))],
    } as Settings;
    const [line] = renderStatusLines(settings, createScenarioContext('busy', { now: NOW, terminalWidth: 80 }), 80);
    expect(stripAnsi(line!.output)).toBe(`${'x'.repeat(30)} │ yyyy...`);
    expect(line!.truncated).toBe(true);

    const git = PRESETS.find((preset) => preset.id === 'git')!.layout;
    for (const text of renderStatusLines(git, createScenarioContext('danger', { now: NOW, terminalWidth: 80 }), 80).map((r) => stripAnsi(r.output))) {
      expect(text).not.toMatch(/│\s*│|│\s*$/);
    }
  });

  it('uses the full width until the context passes compactThreshold', () => {
    const settings = {
      ...createDefaultSettings(),
      flexMode: 'full-until-compact',
      compactThreshold: 60,
      lines: [[{ id: 'm', type: 'model' }, { id: 'f', type: 'flex-separator' }, { id: 'c', type: 'context-percentage' }]],
    } as Settings;
    const calm = renderStatusLines(settings, createScenarioContext('calm', { now: NOW, terminalWidth: 120 }), 120)[0]!;
    const danger = renderStatusLines(settings, createScenarioContext('danger', { now: NOW, terminalWidth: 120 }), 120)[0]!;
    expect(calm.visibleLength).toBe(114);
    expect(danger.visibleLength).toBe(80);
  });

  it('lets a Spacer push powerline segments to the right', () => {
    const base = PRESETS.find((preset) => preset.id === 'bricks')!.layout;
    const settings: Settings = {
      ...base,
      flexMode: 'full-minus-40',
      lines: [[{ id: 'm', type: 'model' }, { id: 'f', type: 'flex-separator' }, { id: 'c', type: 'session-cost' }]],
    };
    const [line] = renderStatusLines(settings, createScenarioContext('busy', { now: NOW, terminalWidth: 200 }), 200);
    expect(line!.visibleLength).toBeGreaterThan(150);
    expect(line!.visibleLength).toBeLessThanOrEqual(160);
    expect(stripAnsi(line!.output).trimEnd()).toMatch(/\$3\.87\s*\S?$/);
  });
});

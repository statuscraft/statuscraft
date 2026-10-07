import { describe, expect, it } from 'vitest';
import { createScenarioContext, SCENARIOS } from '../input/samples';
import { createDefaultSettings } from '../types/settings';
import { stripAnsi } from '../ansi/builder';
import { WIDGET_CATEGORIES } from './define';
import { applyTones, collectNeeds, currentTone, getWidget, renderWidget, WIDGETS } from './registry';

const NOW = Date.UTC(2026, 9, 5, 14, 30);

describe('widget catalog', () => {
  it('has unique types and known categories', () => {
    const types = WIDGETS.map((w) => w.type);
    const categories = WIDGET_CATEGORIES.map((c) => c.id) as string[];
    expect(new Set(types).size).toBe(types.length);
    for (const widget of WIDGETS) expect(categories).toContain(widget.category);
  });

  it.each(SCENARIOS)('renders every widget without throwing in the %s scenario', (scenario) => {
    const ctx = createScenarioContext(scenario, { now: NOW });
    for (const widget of WIDGETS) {
      expect(() => widget.render(ctx, { id: 'x', type: widget.type })).not.toThrow();
    }
  });

  it('gives a value() to every widget that offers thresholds', () => {
    for (const widget of WIDGETS.filter((w) => w.thresholds)) {
      expect(widget.value, widget.type).toBeTypeOf('function');
    }
  });
});

describe('renderWidget', () => {
  const busy = createScenarioContext('busy', { now: NOW });

  it('adds the label unless rawValue is set', () => {
    expect(renderWidget({ id: 'c', type: 'context-percentage' }, busy)).toBe('Ctx 56%');
    expect(renderWidget({ id: 'c', type: 'context-percentage', rawValue: true }, busy)).toBe('56%');
  });

  it('returns null for unknown types', () => {
    expect(renderWidget({ id: 'u', type: 'nope' }, busy)).toBeNull();
  });

  it('hides git changes on a clean tree', () => {
    const calm = createScenarioContext('calm', { now: NOW });
    expect(renderWidget({ id: 'g', type: 'git-changes' }, calm)).toBeNull();
    expect(renderWidget({ id: 'g', type: 'git-changes' }, busy)).toBe('+128 -31');
  });

  it('shows rate limits with a reset countdown', () => {
    expect(renderWidget({ id: 'r', type: 'rate-limit-5h' }, busy)).toBe('5h 47% ↻2h20m');
    expect(renderWidget({ id: 'r', type: 'rate-limit-5h', metadata: { reset: 'false' } }, busy)).toBe('5h 47%');
  });

  it('makes pull requests clickable with OSC 8', () => {
    const text = renderWidget({ id: 'p', type: 'pull-request' }, busy)!;
    expect(text).toContain('\x1b]8;;https://github.com/acme/my-app/pull/1234');
    expect(stripAnsi(text)).toBe('PR #1234 …');
  });

  it('lets Pip panic when context runs out', () => {
    const danger = createScenarioContext('danger', { now: NOW });
    expect(renderWidget({ id: 'm', type: 'mood' }, createScenarioContext('calm', { now: NOW }))).toBe('(^_^)');
    expect(renderWidget({ id: 'm', type: 'mood' }, danger)).toBe('(×_×)');
  });

  it('cleans custom command output', () => {
    const ctx = { ...busy, isPreview: false, commands: { cmd: '\x1b[32mhello\x1b[0m world\nsecond line' } };
    expect(renderWidget({ id: 'cmd', type: 'custom-command', commandPath: 'echo' }, ctx)).toBe('hello world');
    expect(renderWidget({ id: 'cmd', type: 'custom-command', commandPath: 'echo', maxWidth: 6 }, ctx)).toBe('hello…');
  });
});

describe('thresholds', () => {
  const thresholds = [{ at: 70, tone: 'warn' as const }, { at: 90, tone: 'danger' as const }];

  it('picks the highest threshold reached', () => {
    const config = { id: 'c', type: 'context-percentage', thresholds };
    expect(currentTone(config, createScenarioContext('calm', { now: NOW }))).toBeUndefined();
    expect(currentTone(config, createScenarioContext('danger', { now: NOW }))).toBe('danger');
  });

  it('recolors text in plain mode and backgrounds in powerline mode', () => {
    const danger = createScenarioContext('danger', { now: NOW });
    const base = createDefaultSettings();
    const plain = applyTones(base, danger).lines[0]!.find((w) => w.id === 'context')!;
    expect(plain.color).toBe('red');
    const powerline = applyTones({ ...base, powerline: { ...base.powerline, enabled: true } }, danger).lines[0]!.find((w) => w.id === 'context')!;
    expect(powerline.backgroundColor).toBe('bgRed');
  });
});

describe('collectNeeds', () => {
  it('lists git and custom commands', () => {
    const settings = {
      ...createDefaultSettings(),
      lines: [[{ id: 'b', type: 'git-branch' }, { id: 'c', type: 'custom-command', commandPath: 'date' }]],
    };
    const { needs, commands } = collectNeeds(settings);
    expect([...needs].sort()).toEqual(['command', 'git']);
    expect(commands.map((c) => c.id)).toEqual(['c']);
  });

  it('knows each widget by type', () => {
    expect(getWidget('model')?.name).toBe('Model');
  });
});

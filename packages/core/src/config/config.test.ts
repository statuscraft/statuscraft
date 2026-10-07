import { describe, expect, it } from 'vitest';
import { createScenarioContext, SCENARIOS } from '../input/samples';
import { renderStatusText } from '../renderer/render';
import { SettingsSchema } from '../types/schemas';
import { createDefaultSettings } from '../types/settings';
import { stripAnsi } from '../ansi/builder';
import { parseConfig, parseProjectConfig } from './load';
import { createDefaultConfig } from './model';
import { PRESETS } from './presets';
import { globMatch, resolveLayout, ruleMatches } from './resolve';
import { decodeShareCode, encodeShareCode } from './share';

const NOW = Date.UTC(2026, 9, 5, 14, 30);

describe('parseConfig', () => {
  it('turns an old single-layout file into the default profile', () => {
    const result = parseConfig({ version: 3, lines: [[{ id: '1', type: 'model' }]], powerline: { enabled: false } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.activeProfile).toBe('default');
      expect(result.value.profiles['default']!.lines[0]![0]!.type).toBe('model');
    }
  });

  it('upgrades unversioned layouts inside profiles', () => {
    const result = parseConfig({ version: 4, profiles: { work: { lines: [[{ type: 'model' }]] } } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.profiles['work']!.lines[0]![0]!.id).toBe('0-0');
  });

  it('explains what is wrong', () => {
    const result = parseConfig({ version: 4, profiles: { work: { lines: [] } } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('profiles.work.lines');
  });

  it('reads project files', () => {
    expect(parseProjectConfig({ profile: 'minimal' })).toEqual({ ok: true, value: { profile: 'minimal' } });
  });
});

describe('resolveLayout', () => {
  const work = { ...createDefaultSettings(), lines: [[{ id: 'w', type: 'repo' }]] };
  const minimal = { ...createDefaultSettings(), lines: [[{ id: 'm', type: 'model' }]] };
  const config = {
    ...createDefaultConfig(),
    profiles: { ...createDefaultConfig().profiles, work, minimal },
    rules: [{ match: { repo: 'acme/*' }, profile: 'work' }],
  };
  const input = createScenarioContext('busy', { now: NOW }).input;

  it('uses the active profile by default', () => {
    expect(resolveLayout({ config }).source).toBe('active-profile');
  });

  it('applies the first matching rule', () => {
    expect(resolveLayout({ config, input })).toMatchObject({ source: 'rule', profile: 'work' });
  });

  it('lets project files beat rules and local files beat project files', () => {
    expect(resolveLayout({ config, input, project: { profile: 'minimal' } })).toMatchObject({ source: 'project-file', profile: 'minimal' });
    expect(resolveLayout({ config, input, project: { profile: 'minimal' }, local: { profile: 'default' } }).source).toBe('local-file');
  });

  it('lets the session pick and env var beat everything', () => {
    expect(resolveLayout({ config, input, local: { profile: 'default' }, sessionProfile: 'minimal' }).source).toBe('session');
    expect(resolveLayout({ config, input, sessionProfile: 'minimal', envProfile: 'work' }).source).toBe('env');
  });

  it('ignores names that do not exist and falls back to the built-in layout', () => {
    expect(resolveLayout({ envProfile: 'ghost' }).source).toBe('built-in');
  });

  it('matches rules on folders, models and agents', () => {
    expect(ruleMatches({ path: '~/code/*' }, input, '/home/you')).toBe(true);
    expect(ruleMatches({ path: '~/code/my-app' }, input, '/home/you')).toBe(true);
    expect(ruleMatches({ path: '~/code/' }, input, '/home/you')).toBe(true);
    expect(ruleMatches({ path: '~/code/my-app/' }, input, '/home/you')).toBe(true);
    expect(ruleMatches({ path: '/' }, input, '/home/you')).toBe(true);
    expect(ruleMatches({ path: '~/work' }, input, '/home/you')).toBe(false);
    expect(ruleMatches({ model: 'opus' }, input)).toBe(true);
    expect(ruleMatches({ agent: 'reviewer' }, input)).toBe(false);
    expect(ruleMatches({}, input)).toBe(false);
    expect(globMatch('acme/*', 'ACME/web')).toBe(true);
  });
});

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))('%s is valid and draws something in every scenario', (_id, preset) => {
    expect(SettingsSchema.safeParse(preset.layout).success).toBe(true);
    for (const scenario of SCENARIOS) {
      const text = stripAnsi(renderStatusText(preset.layout, createScenarioContext(scenario, { now: NOW })));
      expect(text.trim().length, `${preset.id} in ${scenario}`).toBeGreaterThan(0);
    }
  });

  it('have unique ids', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
});

describe('share codes', () => {
  it('round-trips a layout', () => {
    const layout = PRESETS.find((p) => p.id === 'pro')!.layout;
    const decoded = decodeShareCode(encodeShareCode(layout));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.lines.map((line) => line.map((w) => w.type))).toEqual(layout.lines.map((line) => line.map((w) => w.type)));
      expect(decoded.value.powerline).toEqual(layout.powerline);
    }
  });

  it('survives emoji and rejects junk', () => {
    const layout = { ...createDefaultSettings(), lines: [[{ id: 't', type: 'custom-text', customText: '🚀 ship it' }]] };
    const decoded = decodeShareCode(encodeShareCode(layout));
    expect(decoded.ok && decoded.value.lines[0]![0]!.customText).toBe('🚀 ship it');
    expect(decodeShareCode('hello').ok).toBe(false);
    expect(decodeShareCode('sc1.@@@').ok).toBe(false);
  });
});

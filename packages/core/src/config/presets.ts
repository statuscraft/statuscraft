import { createDefaultSettings, type Settings } from '../types/settings';
import type { Threshold, WidgetConfig } from '../types/widget';

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly description: string;
  readonly needsNerdFont: boolean;
  readonly layout: Settings;
}

const WARN_AT_70: readonly Threshold[] = [{ at: 70, tone: 'warn' }, { at: 90, tone: 'danger' }];

function brick(type: string, extra: Partial<WidgetConfig> = {}, id: string = type): WidgetConfig {
  return { id, type, ...extra };
}

function layout(lines: WidgetConfig[][], overrides: Partial<Settings> = {}): Settings {
  const base = createDefaultSettings();
  return { ...base, ...overrides, lines, powerline: { ...base.powerline, ...overrides.powerline } };
}

function powerline(theme: string, caps: 'round' | 'none' = 'none'): Partial<Settings> {
  return {
    powerline: {
      enabled: true,
      theme,
      separators: [caps === 'round' ? '\uE0B4' : '\uE0B0'],
      separatorInvertBackground: [false],
      startCaps: caps === 'round' ? ['\uE0B6'] : [],
      endCaps: caps === 'round' ? ['\uE0B4'] : [],
      autoAlign: false,
    },
  };
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'starter',
    name: 'Starter',
    emoji: '🧱',
    description: 'Model, context, branch and changes. A great first status line.',
    needsNerdFont: false,
    layout: createDefaultSettings(),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    emoji: '🌙',
    description: 'Just the model and a context bar. Calm and quiet.',
    needsNerdFont: false,
    layout: layout([[
      brick('model', { color: 'brightBlack' }),
      brick('context-bar', { color: 'green', thresholds: WARN_AT_70, metadata: { width: '8', style: 'bricks' } }),
    ]], { defaultSeparator: '  ' }),
  },
  {
    id: 'pip',
    name: 'Pip',
    emoji: '😄',
    description: 'Pip the brick keeps you company and panics when context runs low.',
    needsNerdFont: false,
    layout: layout([[
      brick('mood', { color: 'brightYellow', thresholds: [{ at: 75, tone: 'warn' }, { at: 90, tone: 'danger' }] }),
      brick('model', { color: 'cyan' }),
      brick('context-bar', { color: 'green', thresholds: WARN_AT_70, metadata: { style: 'bricks' } }),
      brick('git-branch', { color: 'magenta' }),
    ]], { defaultSeparator: '  ' }),
  },
  {
    id: 'bricks',
    name: 'Bricks',
    emoji: '🎨',
    description: 'Bright toy-brick colors with powerline arrows.',
    needsNerdFont: true,
    layout: layout([[
      brick('model'),
      brick('current-working-dir'),
      brick('git-branch'),
      brick('git-changes'),
      brick('context-percentage', { thresholds: WARN_AT_70 }),
    ]], powerline('bricks')),
  },
  {
    id: 'budget',
    name: 'Budget Watch',
    emoji: '💰',
    description: 'Cost, rate limits and reset timer, so you never hit a wall by surprise.',
    needsNerdFont: false,
    layout: layout([[
      brick('model', { color: 'cyan' }),
      brick('session-cost', { color: 'green', thresholds: [{ at: 5, tone: 'warn' }, { at: 20, tone: 'danger' }] }),
      brick('rate-limit-5h', { color: 'green', thresholds: WARN_AT_70 }),
      brick('rate-limit-7d', { color: 'green', thresholds: WARN_AT_70 }),
      brick('context-bar', { color: 'blue', thresholds: WARN_AT_70 }),
    ]]),
  },
  {
    id: 'git',
    name: 'Git Guru',
    emoji: '🌿',
    description: 'Repo, branch, PR status and changes at a glance.',
    needsNerdFont: false,
    layout: layout([[
      brick('repo', { color: 'brightCyan' }),
      brick('git-branch', { color: 'magenta', metadata: { aheadBehind: 'true' } }),
      brick('git-status', { color: 'yellow' }),
      brick('pull-request', { color: 'brightBlue' }),
      brick('flex-separator'),
      brick('lines-changed', { color: 'green' }),
    ]]),
  },
  {
    id: 'pro',
    name: 'Two-Liner Pro',
    emoji: '🚀',
    description: 'Everything that matters on two lines: session on top, budget below.',
    needsNerdFont: true,
    layout: layout([
      [
        brick('model'),
        brick('effort'),
        brick('current-working-dir'),
        brick('git-branch'),
        brick('pull-request'),
      ],
      [
        brick('context-bar', { thresholds: WARN_AT_70, metadata: { width: '12' } }),
        brick('prompt-cache'),
        brick('session-cost'),
        brick('rate-limit-5h', { thresholds: WARN_AT_70 }),
        brick('session-clock'),
      ],
    ], { ...powerline('catppuccin', 'round'), colorLevel: 3 }),
  },
  {
    id: 'nord',
    name: 'Nordic',
    emoji: '❄️',
    description: 'Cool arctic powerline: folder, branch, context and cost.',
    needsNerdFont: true,
    layout: layout([[
      brick('current-working-dir'),
      brick('git-branch'),
      brick('context-percentage', { thresholds: WARN_AT_70 }),
      brick('session-cost'),
    ]], { ...powerline('nord'), colorLevel: 3 }),
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

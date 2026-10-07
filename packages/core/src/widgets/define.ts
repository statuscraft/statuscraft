import type { WidgetContext } from '../input/types';
import type { Threshold, WidgetConfig } from '../types/widget';

export const WIDGET_CATEGORIES = [
  { id: 'model', name: 'Model & Session', emoji: '🤖' },
  { id: 'context', name: 'Context & Tokens', emoji: '🧠' },
  { id: 'usage', name: 'Usage & Cost', emoji: '💰' },
  { id: 'time', name: 'Time', emoji: '⏱️' },
  { id: 'git', name: 'Git & Code', emoji: '🌿' },
  { id: 'system', name: 'System', emoji: '💻' },
  { id: 'fun', name: 'Fun', emoji: '🎈' },
  { id: 'custom', name: 'Custom', emoji: '✏️' },
  { id: 'layout', name: 'Layout', emoji: '📐' },
] as const;

export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number]['id'];

export type WidgetNeed = 'git' | 'command' | 'companion';

const CONFIG_FIELDS = ['customText', 'commandPath', 'character', 'maxWidth', 'timeout'] as const;

export type WidgetOption =
  | { readonly key: string; readonly label: string; readonly kind: 'select'; readonly choices: readonly { readonly value: string; readonly label: string }[]; readonly default: string }
  | { readonly key: string; readonly label: string; readonly kind: 'number'; readonly min?: number; readonly max?: number; readonly default: number }
  | { readonly key: string; readonly label: string; readonly kind: 'text'; readonly placeholder?: string; readonly default: string }
  | { readonly key: string; readonly label: string; readonly kind: 'toggle'; readonly default: boolean };

export interface WidgetDefinition {
  // Saved in config files: never rename an existing type
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly category: WidgetCategory;
  readonly emoji: string;
  readonly defaultColor: string;
  readonly label?: string;
  readonly needs?: readonly WidgetNeed[];
  readonly options?: readonly WidgetOption[];
  readonly thresholds?: { readonly hint: string; readonly defaults: readonly Threshold[] };
  // For thresholds: higher means worse
  value?(ctx: WidgetContext, config: WidgetConfig): number | undefined;
  // Pure: no I/O. Return null to hide the widget.
  render(ctx: WidgetContext, config: WidgetConfig): string | null;
}

export function defineWidget(definition: WidgetDefinition): WidgetDefinition {
  return definition;
}

function isConfigField(key: string): key is (typeof CONFIG_FIELDS)[number] {
  return (CONFIG_FIELDS as readonly string[]).includes(key);
}

function storedOption(config: WidgetConfig, key: string): string | number | undefined {
  if (isConfigField(key)) return config[key];
  return config.metadata?.[key];
}

export function readString(config: WidgetConfig, key: string, fallback: string): string {
  const value = storedOption(config, key);
  return value === undefined || value === '' ? fallback : String(value);
}

export function readNumber(config: WidgetConfig, key: string, fallback: number): number {
  const value = Number(storedOption(config, key));
  return Number.isFinite(value) && storedOption(config, key) !== undefined ? value : fallback;
}

export function readBoolean(config: WidgetConfig, key: string, fallback: boolean): boolean {
  const value = storedOption(config, key);
  if (value === undefined) return fallback;
  return value === 'true' || value === 1;
}

export function writeOption(config: WidgetConfig, key: string, value: string | number | boolean): WidgetConfig {
  if (isConfigField(key)) {
    const numeric = key === 'maxWidth' || key === 'timeout';
    return { ...config, [key]: numeric ? Number(value) : String(value) };
  }
  return { ...config, metadata: { ...config.metadata, [key]: String(value) } };
}

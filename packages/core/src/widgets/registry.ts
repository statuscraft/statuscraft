import type { WidgetContext } from '../input/types';
import type { Settings } from '../types/settings';
import type { Tone, WidgetConfig } from '../types/widget';
import type { WidgetDefinition, WidgetNeed } from './define';
import { contextWidgets } from './catalog/context';
import { customWidgets } from './catalog/custom';
import { funWidgets } from './catalog/fun';
import { gitWidgets } from './catalog/git';
import { layoutWidgets } from './catalog/layout';
import { modelWidgets } from './catalog/model';
import { systemWidgets } from './catalog/system';
import { timeWidgets } from './catalog/time';
import { usageWidgets } from './catalog/usage';

export const WIDGETS: readonly WidgetDefinition[] = [
  ...modelWidgets,
  ...contextWidgets,
  ...usageWidgets,
  ...timeWidgets,
  ...gitWidgets,
  ...systemWidgets,
  ...funWidgets,
  ...customWidgets,
  ...layoutWidgets,
];

const BY_TYPE = new Map(WIDGETS.map((widget) => [widget.type, widget]));

export function getWidget(type: string): WidgetDefinition | undefined {
  return BY_TYPE.get(type);
}

export function isKnownWidgetType(type: string): boolean {
  return BY_TYPE.has(type);
}

export function renderWidget(config: WidgetConfig, ctx: WidgetContext): string | null {
  const widget = getWidget(config.type);
  if (!widget) return null;
  let text: string | null;
  try {
    text = widget.render(ctx, config);
  } catch {
    return null;
  }
  if (!text) return null;
  return widget.label && !config.rawValue ? `${widget.label} ${text}` : text;
}

export function renderWidgets(
  widgets: readonly WidgetConfig[],
  ctx: WidgetContext,
): readonly (string | null)[] {
  return widgets.map((config) => renderWidget(config, ctx));
}

export function currentTone(config: WidgetConfig, ctx: WidgetContext): Tone | undefined {
  const widget = getWidget(config.type);
  if (!config.thresholds?.length || !widget?.value) return undefined;
  const value = widget.value(ctx, config);
  if (value === undefined) return undefined;
  let tone: Tone | undefined;
  let highest = -Infinity;
  for (const threshold of config.thresholds) {
    if (value >= threshold.at && threshold.at >= highest) {
      tone = threshold.tone;
      highest = threshold.at;
    }
  }
  return tone;
}

const TONE_STYLES: Record<Tone, { plain: Partial<WidgetConfig>; powerline: Partial<WidgetConfig> }> = {
  warn: { plain: { color: 'yellow' }, powerline: { color: 'black', backgroundColor: 'bgYellow' } },
  danger: { plain: { color: 'red', bold: true }, powerline: { color: 'brightWhite', backgroundColor: 'bgRed', bold: true } },
};

export function applyTones(settings: Settings, ctx: WidgetContext): Settings {
  const mode = settings.powerline.enabled ? 'powerline' : 'plain';
  return {
    ...settings,
    lines: settings.lines.map((line) =>
      line.map((config) => {
        const tone = currentTone(config, ctx);
        return tone ? { ...config, ...TONE_STYLES[tone][mode] } : config;
      }),
    ),
  };
}

export function collectNeeds(settings: Settings): { needs: Set<WidgetNeed>; commands: WidgetConfig[] } {
  const needs = new Set<WidgetNeed>();
  const commands: WidgetConfig[] = [];
  for (const line of settings.lines) {
    for (const config of line) {
      for (const need of getWidget(config.type)?.needs ?? []) needs.add(need);
      if (config.type === 'custom-command' && config.commandPath) commands.push(config);
    }
  }
  return { needs, commands };
}

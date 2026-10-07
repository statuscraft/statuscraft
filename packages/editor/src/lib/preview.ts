import { useEffect, useMemo, useState } from 'react';
import {
  createScenarioContext,
  currentTone,
  getWidget,
  moodFor,
  POWERLINE_THEMES,
  sessionPressure,
  type Mood,
  type Settings,
  type WidgetConfig,
  type WidgetContext,
} from '@statuscraft/core';
import { useEditor } from '../store';
import { CATEGORY_COLORS, configColorToCss } from './colors';
import { terminals, type AnsiColors } from './terminal-themes';

function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function usePreviewContext(): WidgetContext {
  const preview = useEditor((s) => s.preview);
  const live = useEditor((s) => s.live);
  const now = useNow();
  return useMemo(() => {
    if (preview.scenario === 'live' && live) {
      return {
        input: live.input,
        git: live.git,
        commands: {},
        now,
        terminalWidth: preview.width,
        home: live.home,
        isPreview: true,
      };
    }
    const scenario = preview.scenario === 'live' ? 'busy' : preview.scenario;
    return createScenarioContext(scenario, { now, terminalWidth: preview.width });
  }, [preview.scenario, preview.width, live, now]);
}

export function usePalette(): AnsiColors {
  const { terminal, theme } = useEditor((s) => s.preview);
  const app = terminals[terminal] ?? terminals['iterm2']!;
  return (app.themes[theme] ?? app.themes[app.defaultTheme]!).colors;
}

export function previewMood(ctx: WidgetContext): Mood {
  return moodFor(sessionPressure(ctx.input) ?? 0);
}

export function brickColor(widget: WidgetConfig, position: number, layout: Settings, palette: AnsiColors, ctx?: WidgetContext): string {
  const fallback = CATEGORY_COLORS[getWidget(widget.type)?.category ?? 'layout'] ?? '#78909C';
  if (widget.type === 'separator' || widget.type === 'flex-separator') return '#B0BEC5';
  const tone = ctx ? currentTone(widget, ctx) : undefined;
  if (tone) return configColorToCss(tone === 'danger' ? 'red' : 'yellow', palette) ?? fallback;
  if (layout.powerline.enabled) {
    const own = configColorToCss(widget.backgroundColor, palette);
    if (own) return own;
    const theme = POWERLINE_THEMES[layout.powerline.theme ?? 'custom'];
    const colors = theme?.[3]?.bg;
    if (colors?.length) return configColorToCss(colors[position % colors.length], palette) ?? fallback;
    return configColorToCss('bgBlue', palette) ?? fallback;
  }
  return configColorToCss(widget.color, palette) ?? fallback;
}

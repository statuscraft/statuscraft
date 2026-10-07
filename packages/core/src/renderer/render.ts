import type { WidgetContext } from '../input/types';
import type { Settings } from '../types/settings';
import type { RenderResult } from './types';
import { createRenderEngine } from './engine';
import { applyTones, renderWidgets } from '../widgets/registry';
import { contextPercent } from '../input/parse';

export function renderStatusLines(
  settings: Settings,
  ctx: WidgetContext,
  terminalWidth: number = ctx.terminalWidth,
): RenderResult[] {
  const styled = applyTones(settings, ctx);
  const contents = styled.lines.map((line) => renderWidgets(line, ctx));
  return createRenderEngine().renderAllLines(styled, contents, { lineIndex: 0, contextPercent: contextPercent(ctx.input) }, terminalWidth);
}

export function renderStatusText(settings: Settings, ctx: WidgetContext): string {
  return renderStatusLines(settings, ctx)
    .map((result) => result.output)
    .filter((output) => output.replace(/\x1b\[[0-9;]*[mK]/g, '').trim().length > 0)
    .join('\n');
}

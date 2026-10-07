import { generateWidgetId, getWidget, type Settings, type WidgetConfig } from '@statuscraft/core';

export const MAX_LINES = 3;

export function newBrick(type: string, layout: Settings): WidgetConfig {
  const widget = getWidget(type);
  const themed = layout.powerline.enabled && (layout.powerline.theme ?? 'custom') !== 'custom';
  const brick: WidgetConfig = { id: generateWidgetId(), type };
  return {
    ...brick,
    ...(widget && !themed && type !== 'flex-separator' ? { color: widget.defaultColor } : {}),
    ...(widget?.thresholds ? { thresholds: widget.thresholds.defaults.map((t) => ({ ...t })) } : {}),
  };
}

export function findBrick(layout: Settings, id: string): { line: number; index: number; widget: WidgetConfig } | undefined {
  for (let line = 0; line < layout.lines.length; line++) {
    const index = layout.lines[line]!.findIndex((w) => w.id === id);
    if (index >= 0) return { line, index, widget: layout.lines[line]![index]! };
  }
  return undefined;
}

export function addBrick(layout: Settings, line: number, brick: WidgetConfig, index?: number): Settings {
  const lines = layout.lines.map((l) => [...l]);
  while (lines.length <= line && lines.length < MAX_LINES) lines.push([]);
  const target = lines[Math.min(line, lines.length - 1)]!;
  target.splice(index ?? target.length, 0, brick);
  return { ...layout, lines };
}

export function moveBrick(layout: Settings, id: string, toLine: number, toIndex: number): Settings {
  const found = findBrick(layout, id);
  if (!found) return layout;
  const lines = layout.lines.map((l) => [...l]);
  lines[found.line]!.splice(found.index, 1);
  while (lines.length <= toLine && lines.length < MAX_LINES) lines.push([]);
  const target = lines[Math.min(toLine, lines.length - 1)]!;
  target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, found.widget);
  return { ...layout, lines };
}

export function removeBrick(layout: Settings, id: string): Settings {
  return { ...layout, lines: layout.lines.map((l) => l.filter((w) => w.id !== id)) };
}

export function updateBrick(layout: Settings, id: string, change: (widget: WidgetConfig) => WidgetConfig): Settings {
  return { ...layout, lines: layout.lines.map((l) => l.map((w) => (w.id === id ? change(w) : w))) };
}

export function addLine(layout: Settings): Settings {
  if (layout.lines.length >= MAX_LINES) return layout;
  return { ...layout, lines: [...layout.lines, []] };
}

export function removeLine(layout: Settings, line: number): Settings {
  if (layout.lines.length <= 1) return { ...layout, lines: [[]] };
  return { ...layout, lines: layout.lines.filter((_, i) => i !== line) };
}

export function clearBrickColors(layout: Settings): Settings {
  return {
    ...layout,
    lines: layout.lines.map((l) => l.map(({ color: _c, backgroundColor: _b, ...rest }) => rest)),
  };
}

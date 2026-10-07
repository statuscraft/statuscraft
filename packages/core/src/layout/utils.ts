import type { Layout, LayoutBox } from './types';

export function getLayoutStats(layout: Layout): {
  widgetCount: number;
  flexCount: number;
  totalChars: number;
  utilization: number;
} {
  const widgetCount = layout.boxes.filter(b => !b.isFlex && b.widget.type !== 'separator').length;
  const flexCount = layout.boxes.filter(b => b.isFlex).length;
  const totalChars = layout.totalWidth;
  const utilization = layout.availableWidth > 0
    ? (totalChars / layout.availableWidth) * 100
    : 0;

  return { widgetCount, flexCount, totalChars, utilization };
}

export function findBoxById(layout: Layout, id: string): LayoutBox | undefined {
  return layout.boxes.find(box => box.id === id);
}

export function hasFlexSeparators(layout: Layout): boolean {
  return layout.boxes.some(box => box.isFlex);
}

export function layoutToPlainText(layout: Layout): string {
  return layout.boxes.map(box => box.content).join('');
}

export function splitByFlex(layout: Layout): LayoutBox[][] {
  const segments: LayoutBox[][] = [];
  let current: LayoutBox[] = [];

  for (const box of layout.boxes) {
    if (box.isFlex) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      segments.push([box]);
    } else {
      current.push(box);
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

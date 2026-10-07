import type { RendererPlugin, RenderResult } from './types';
import type { WidgetConfig } from '../types/widget';
import type { Settings } from '../types/settings';
import type { RenderContext } from './types';
import type { LayoutConstraints, StyledBox } from '../layout/types';
import { createLayoutEngine, createConstraints } from '../layout';
import { standardRenderer } from './standard';
import { powerlineRenderer, calculateAlignment, renderWithAlignment, type AlignmentInfo } from './powerline';
import { visibleLength } from '../ansi/builder';

export class RenderEngine {
  private plugins: RendererPlugin[] = [];

  constructor() {
    this.use(standardRenderer);
    this.use(powerlineRenderer);
  }

  use(plugin: RendererPlugin): this {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);
    return this;
  }

  selectPlugin(settings: Settings): RendererPlugin {
    for (const plugin of this.plugins) {
      if (plugin.canHandle(settings)) {
        return plugin;
      }
    }
    return standardRenderer;
  }

  private calculateStyledBoxes(
    widgets: readonly WidgetConfig[],
    contents: readonly (string | null)[],
    settings: Settings,
    context: RenderContext,
    constraints: LayoutConstraints
  ): { styledBoxes: readonly StyledBox[]; plugin: RendererPlugin; truncated: boolean } {
    const plugin = this.selectPlugin(settings);

    const contentById = new Map(widgets.map((w, i) => [w.id, contents[i] ?? null]));
    const visibleWidgets = dropHiddenWidgets(widgets, contentById);

    let processedWidgets: readonly WidgetConfig[] = visibleWidgets;
    if (plugin.preLayout) {
      processedWidgets = plugin.preLayout(visibleWidgets, settings);
    }

    // Separators the renderer added draw their own character, so they have no content here
    const processedContents = processedWidgets.map(w => contentById.get(w.id) ?? null);

    const overhead = plugin.overhead?.(processedWidgets, settings);
    const lineConstraints = overhead ? { ...constraints, boxOverhead: overhead.box, lineOverhead: overhead.line } : constraints;

    const layoutEngine = createLayoutEngine();
    let layout = layoutEngine.layout(processedWidgets, processedContents, lineConstraints);
    if (layout.overflow) {
      layout = layoutEngine.truncateLayout(layout);
    }

    const withSeparators = plugin.insertSeparators(layout.boxes, settings);
    const styledBoxes = plugin.applyStyles(withSeparators, settings, context);

    return { styledBoxes, plugin, truncated: layout.overflow || layout.clipped === true };
  }

  renderLine(
    widgets: readonly WidgetConfig[],
    contents: readonly (string | null)[],
    settings: Settings,
    context: RenderContext,
    constraints: LayoutConstraints,
    alignment?: AlignmentInfo
  ): RenderResult {
    const { styledBoxes, plugin, truncated } = this.calculateStyledBoxes(
      widgets,
      contents,
      settings,
      context,
      constraints
    );

    let output: string;
    if (alignment?.enabled && plugin.name === 'powerline') {
      output = renderWithAlignment(styledBoxes, settings, context, alignment);
    } else {
      output = plugin.render(styledBoxes, settings, context);
    }

    if (plugin.postRender) {
      output = plugin.postRender(output, settings);
    }

    return {
      output,
      pluginName: plugin.name,
      visibleLength: visibleLength(output),
      truncated,
    };
  }

  renderAllLines(
    settings: Settings,
    contents: readonly (readonly (string | null)[])[],
    context: RenderContext,
    terminalWidth: number
  ): RenderResult[] {
    const constraints = createConstraints(
      terminalWidth,
      settings.flexMode,
      settings.compactThreshold,
      settings.defaultSeparator,
      settings.defaultPadding,
      context.contextPercent
    );

    const shouldAutoAlign =
      settings.powerline.enabled && settings.powerline.autoAlign;

    let alignment: AlignmentInfo | undefined;

    if (shouldAutoAlign) {
      const allStyledBoxes: StyledBox[][] = [];

      for (let index = 0; index < settings.lines.length; index++) {
        const line = settings.lines[index];
        if (!line) continue;

        const lineContents = contents[index] ?? [];
        const lineContext: RenderContext = {
          ...context,
          lineIndex: index,
        };

        const { styledBoxes } = this.calculateStyledBoxes(
          line,
          lineContents,
          settings,
          lineContext,
          constraints
        );

        allStyledBoxes.push([...styledBoxes]);
      }

      alignment = calculateAlignment(allStyledBoxes);
    }

    const renderAll = (lineAlignment?: AlignmentInfo) =>
      settings.lines.map((line, index) => {
        const lineContents = contents[index] ?? [];
        const lineContext: RenderContext = {
          ...context,
          lineIndex: index,
        };

        return this.renderLine(
          line,
          lineContents,
          settings,
          lineContext,
          constraints,
          lineAlignment
        );
      });

    const results = renderAll(alignment);
    // Lining segments up pads them, so give it up when that would not fit
    if (alignment && results.some(result => result.visibleLength > constraints.maxWidth)) {
      return renderAll();
    }
    return results;
  }
}

// Drop widgets that rendered nothing, and any separator left at an edge, doubled, or next to a spacer.
export function dropHiddenWidgets(
  widgets: readonly WidgetConfig[],
  contentById: ReadonlyMap<string, string | null>
): WidgetConfig[] {
  const result: WidgetConfig[] = [];
  for (const widget of widgets) {
    const isLayout = widget.type === 'separator' || widget.type === 'flex-separator';
    if (!isLayout && !contentById.get(widget.id)) continue;
    const previous = result[result.length - 1];
    const followsNothingVisible = !previous || previous.type === 'separator' || previous.type === 'flex-separator';
    if (widget.type === 'separator' && followsNothingVisible) continue;
    if (widget.type === 'flex-separator' && previous?.type === 'separator') result.pop();
    result.push(widget);
  }
  while (result[result.length - 1]?.type === 'separator') result.pop();
  return result;
}

export function createRenderEngine(): RenderEngine {
  return new RenderEngine();
}

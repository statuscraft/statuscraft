import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WIDGET_CATEGORIES, WIDGETS, type WidgetDefinition } from '@statuscraft/core';
import { CATEGORY_COLORS } from '../lib/colors';
import { addBrick, newBrick } from '../lib/layout-ops';
import { selectLayout, useEditor } from '../store';
import { Brick } from './Brick';

function ToolboxBrick({ widget }: { widget: WidgetDefinition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new:${widget.type}`,
    data: { kind: 'new', type: widget.type },
  });
  const change = useEditor((s) => s.change);
  const select = useEditor((s) => s.select);

  const addToActiveLine = () => {
    const state = useEditor.getState();
    const brick = newBrick(widget.type, selectLayout(state));
    change((layout) => addBrick(layout, state.activeLine, brick));
    select(brick.id);
  };

  return (
    <div className="relative" title={widget.description}>
      <Brick
        ref={setNodeRef}
        color={CATEGORY_COLORS[widget.category] ?? '#78909C'}
        emoji={widget.emoji}
        name={widget.name}
        compact
        className={isDragging ? 'opacity-40' : 'cursor-grab'}
        onClick={addToActiveLine}
        onKeyDown={(event) => event.key === 'Enter' && addToActiveLine()}
        {...attributes}
        {...listeners}
      />
      {widget.needs?.includes('companion') && (
        <span className="absolute -right-1 -top-1 rounded-full border-2 border-ink-800 bg-white px-1.5 text-[10px] font-black" title="Needs the StatusCraft Claude Code plugin">
          plugin
        </span>
      )}
    </div>
  );
}

export function Toolbox() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WIDGET_CATEGORIES.map((category) => ({
      ...category,
      widgets: WIDGETS.filter(
        (w) => w.category === category.id && (!q || `${w.name} ${w.description} ${w.type}`.toLowerCase().includes(q)),
      ),
    })).filter((group) => group.widgets.length > 0);
  }, [query]);

  return (
    <aside className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b-[3px] border-ink-800 bg-brick-red px-4 py-3 text-white">
        <h2 className="text-lg font-black">🧰 Brick box</h2>
        <p className="text-sm font-semibold opacity-90">Click a brick to add it, or drag it onto a line.</p>
      </div>
      <div className="p-3">
        <input
          className="input"
          placeholder="🔍 Find a brick…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Find a brick"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <section key={group.id}>
            <h3 className="field-label flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CATEGORY_COLORS[group.id] }} />
              {group.emoji} {group.name}
            </h3>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {group.widgets.map((widget) => (
                <ToolboxBrick key={widget.type} widget={widget} />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="px-1 text-sm text-ink-400">No brick matches “{query}”.</p>}
      </div>
    </aside>
  );
}

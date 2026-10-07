import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { getWidget, renderWidget, stripAnsi, type WidgetConfig } from '@statuscraft/core';
import { addLine, MAX_LINES, removeBrick, removeLine } from '../lib/layout-ops';
import { brickColor, usePalette, usePreviewContext } from '../lib/preview';
import { selectLayout, useEditor } from '../store';
import { Brick } from './Brick';

function PlacedBrick({ widget, position }: { widget: WidgetConfig; position: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { kind: 'brick' },
  });
  const layout = useEditor(selectLayout);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const change = useEditor((s) => s.change);
  const palette = usePalette();
  const ctx = usePreviewContext();
  const definition = getWidget(widget.type);
  const value = widget.type === 'flex-separator' ? 'pushes right' : renderWidget(widget, ctx);

  return (
    <div className="group relative" style={{ transform: CSS.Translate.toString(transform), transition }}>
      <Brick
        ref={setNodeRef}
        color={brickColor(widget, position, layout, palette, ctx)}
        emoji={definition?.emoji ?? '❓'}
        name={definition?.name ?? widget.type}
        value={value === null ? 'hidden right now' : stripAnsi(value)}
        selected={selectedId === widget.id}
        className={clsx('cursor-grab', isDragging && 'opacity-30', value === null && 'opacity-70')}
        onClick={(event) => {
          event.stopPropagation();
          select(widget.id);
        }}
        {...attributes}
        {...listeners}
      />
      <button
        type="button"
        aria-label={`Remove ${definition?.name ?? widget.type}`}
        onClick={(event) => {
          event.stopPropagation();
          change((l) => removeBrick(l, widget.id));
        }}
        className="absolute -right-2 -top-0.5 hidden h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-white text-sm font-black leading-none shadow group-hover:flex"
      >
        ×
      </button>
    </div>
  );
}

function Line({ index, widgets }: { index: number; widgets: readonly WidgetConfig[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `line:${index}`, data: { kind: 'line', line: index } });
  const activeLine = useEditor((s) => s.activeLine);
  const setActiveLine = useEditor((s) => s.setActiveLine);
  const change = useEditor((s) => s.change);
  const lineCount = useEditor((s) => selectLayout(s).lines.length);
  const active = activeLine === index;

  return (
    <div
      ref={setNodeRef}
      onClick={() => setActiveLine(index)}
      className={clsx('baseplate-row relative min-h-[76px] px-3 pb-3 pt-2', (active || isOver) && 'baseplate-row-active')}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-white/90 drop-shadow">
          Line {index + 1} {active && <span className="ml-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-ink-800">new bricks go here</span>}
        </span>
        {lineCount > 1 && (
          <button
            type="button"
            className="rounded-lg px-2 text-xs font-bold text-white/80 hover:bg-white/20 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              change((l) => removeLine(l, index));
            }}
          >
            Remove line
          </button>
        )}
      </div>
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="flex min-h-[48px] flex-wrap items-end gap-x-2 gap-y-1">
          {widgets.map((widget, position) => (
            <PlacedBrick key={widget.id} widget={widget} position={position} />
          ))}
          {widgets.length === 0 && (
            <div className="flex h-12 flex-1 items-center justify-center rounded-xl border-[3px] border-dashed border-white/70 text-sm font-bold text-white">
              Drop bricks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function Baseplate() {
  const layout = useEditor(selectLayout);
  const change = useEditor((s) => s.change);
  const setActiveLine = useEditor((s) => s.setActiveLine);
  const select = useEditor((s) => s.select);

  return (
    <div className="baseplate p-4" onClick={() => select(undefined)}>
      <div className="space-y-3">
        {layout.lines.map((widgets, index) => (
          <Line key={index} index={index} widgets={widgets} />
        ))}
      </div>
      {layout.lines.length < MAX_LINES && (
        <button
          type="button"
          className="mt-3 w-full rounded-xl border-[3px] border-dashed border-white/70 py-2 text-sm font-black text-white hover:bg-white/10"
          onClick={(event) => {
            event.stopPropagation();
            change(addLine);
            setActiveLine(layout.lines.length);
          }}
        >
          + Add another line
        </button>
      )}
    </div>
  );
}

export function TrashCan({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash', data: { kind: 'trash' } });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-2xl border-[3px] border-ink-800 px-6 py-3 text-lg font-black shadow-chunky transition-all',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0',
        isOver ? 'scale-110 bg-brick-red text-white' : 'bg-white',
      )}
    >
      🗑️ Drop here to remove
    </div>
  );
}

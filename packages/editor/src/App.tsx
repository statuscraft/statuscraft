import { useEffect, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getWidget } from '@statuscraft/core';
import { CATEGORY_COLORS } from './lib/colors';
import { addBrick, findBrick, moveBrick, newBrick, removeBrick } from './lib/layout-ops';
import { removeMod } from './lib/mods-ops';
import { hasBeenWelcomed, selectLayout, useEditor } from './store';
import { Baseplate, TrashCan } from './components/Baseplate';
import { Brick } from './components/Brick';
import { ProjectDialog, ShareDialog } from './components/Dialogs';
import { HowItWorks } from './components/HowItWorks';
import { Inspector } from './components/Inspector';
import { ModsWorkspace } from './components/mods/ModsWorkspace';
import { Pip } from './components/Pip';
import { Preview } from './components/Preview';
import { ProfilesDialog } from './components/ProfilesDialog';
import { StarterKits } from './components/StarterKits';
import { Toast } from './components/Toast';
import { Toolbox } from './components/Toolbox';
import { TopBar } from './components/TopBar';

// Prefer a brick under the pointer, then a line; dropping anywhere else does nothing.
// Keyboard dragging has no pointer, so it falls back to the closest spot.
const collision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const hits = pointerWithin(args);
  return hits.length ? [hits.find((hit) => !String(hit.id).startsWith('line:')) ?? hits[0]!] : [];
};

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="dialog"]')) return;
      const state = useEditor.getState();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && state.product === 'mods' && state.selectedModId) {
        const id = state.selectedModId;
        state.changeMods((mods) => removeMod(mods, id));
        state.selectMod(undefined);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && state.product === 'statusline' && state.selectedId) {
        const id = state.selectedId;
        state.change((layout) => removeBrick(layout, id));
        state.select(undefined);
      } else if (event.key === 'Escape') {
        state.select(undefined);
        state.selectMod(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const mode = useEditor((s) => s.mode);
  const product = useEditor((s) => s.product);
  const load = useEditor((s) => s.load);
  const change = useEditor((s) => s.change);
  const select = useEditor((s) => s.select);
  const setActiveLine = useEditor((s) => s.setActiveLine);
  const openDialog = useEditor((s) => s.openDialog);
  const [dragging, setDragging] = useState<{ type: string; fromToolbox: boolean } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useKeyboardShortcuts();

  useEffect(() => {
    void load().then(() => {
      const state = useEditor.getState();
      if (!hasBeenWelcomed() && !(state.server?.configExists && !state.server.importedFrom)) openDialog('kits');
    });
  }, [load, openDialog]);

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { kind: string; type?: string } | undefined;
    if (data?.kind === 'new' && data.type) return setDragging({ type: data.type, fromToolbox: true });
    const found = findBrick(selectLayout(useEditor.getState()), String(event.active.id));
    if (found) setDragging({ type: found.widget.type, fromToolbox: false });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const layout = selectLayout(useEditor.getState());
    const data = active.data.current as { kind: string; type?: string } | undefined;
    const overId = String(over.id);

    if (overId === 'trash') {
      if (data?.kind === 'brick') change((l) => removeBrick(l, String(active.id)));
      return;
    }

    let line: number;
    let index: number;
    if (overId.startsWith('line:')) {
      line = Number(overId.slice(5));
      index = layout.lines[line]?.length ?? 0;
    } else {
      const target = findBrick(layout, overId);
      if (!target) return;
      line = target.line;
      index = target.index;
    }

    if (data?.kind === 'new' && data.type) {
      const brick = newBrick(data.type, layout);
      change((l) => addBrick(l, line, brick, index));
      select(brick.id);
    } else if (String(active.id) !== overId) {
      change((l) => moveBrick(l, String(active.id), line, index));
    }
    setActiveLine(line);
  };

  if (mode === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Pip size={96} className="animate-hop" />
        <p className="font-black">Opening the brick box…</p>
      </div>
    );
  }

  const draggedWidget = dragging ? getWidget(dragging.type) : undefined;

  if (product === 'mods') {
    return (
      <>
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col">
          <TopBar />
          <ModsWorkspace />
          <Footer />
        </div>
        <Toast />
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col">
        <TopBar />
        <main className="grid flex-1 gap-4 px-4 pb-6 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
            <Toolbox />
          </div>
          <div className="min-w-0 space-y-4">
            <Baseplate />
            <Preview />
            <HowItWorks />
          </div>
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
            <Inspector />
          </div>
        </main>
        <Footer />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedWidget && (
          <Brick
            dragging
            color={CATEGORY_COLORS[draggedWidget.category] ?? '#78909C'}
            emoji={draggedWidget.emoji}
            name={draggedWidget.name}
          />
        )}
      </DragOverlay>
      <TrashCan visible={Boolean(dragging && !dragging.fromToolbox)} />

      <StarterKits />
      <ShareDialog />
      <ProjectDialog />
      <ProfilesDialog />
      <Toast />
    </DndContext>
  );
}

function Footer() {
  return (
    <footer className="px-4 pb-4 text-center text-xs font-semibold text-ink-400">
      StatusCraft is free and open source. Made with bricks and ❤️ for Claude Code.
    </footer>
  );
}

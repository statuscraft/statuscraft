import { useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { getMod, MOD_SLOTS, type ModDefinition } from '@statuscraft/core';
import { addMod } from '../../lib/mods-ops';
import { useEditor } from '../../store';
import { Brick } from '../Brick';
import { ModInspector } from './ModInspector';
import { DragSlotContext, ModTerminal } from './ModTerminal';
import { ModToolbox } from './ModToolbox';

export function ModsWorkspace() {
  const changeMods = useEditor((s) => s.changeMods);
  const selectMod = useEditor((s) => s.selectMod);
  const showToast = useEditor((s) => s.showToast);
  const [dragging, setDragging] = useState<ModDefinition | undefined>();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { kind: string; type?: string } | undefined;
    setDragging(data?.kind === 'mod-new' && data.type ? getMod(data.type) : undefined);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(undefined);
    const data = active.data.current as { kind: string; type?: string } | undefined;
    if (!over || data?.kind !== 'mod-new' || !data.type) return;
    const definition = getMod(data.type);
    if (!definition) return;
    let id: string | undefined;
    changeMods((config) => {
      const result = addMod(config, data.type!);
      id = result.id;
      return result.config;
    });
    selectMod(id);
    // Dropped on the wrong spot: it still goes where it belongs, and Pip says where
    const target = (over.data.current as { slot?: string } | undefined)?.slot;
    if (target && target !== definition.slot) {
      const slot = MOD_SLOTS.find((s) => s.id === definition.slot)!;
      showToast(`${definition.name} lives in “${slot.name}”, so I put it there.`, 'content');
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(undefined)}>
      <DragSlotContext.Provider value={dragging?.slot}>
        <main className="grid flex-1 gap-4 px-4 pb-6 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
            <ModToolbox />
          </div>
          <div className="min-w-0 space-y-4">
            <ModTerminal />
          </div>
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
            <ModInspector />
          </div>
        </main>
      </DragSlotContext.Provider>
      <DragOverlay dropAnimation={null}>{dragging && <Brick dragging color={dragging.color} emoji={dragging.emoji} name={dragging.name} />}</DragOverlay>
    </DndContext>
  );
}

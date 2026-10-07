import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { canAddMod, MOD_SLOTS, MODS, type ModDefinition } from '@statuscraft/core';
import { addMod } from '../../lib/mods-ops';
import { useEditor } from '../../store';
import { Brick } from '../Brick';

function ToolboxMod({ mod }: { mod: ModDefinition }) {
  const available = useEditor((s) => canAddMod(s.mods, mod.type));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mod-new:${mod.type}`,
    data: { kind: 'mod-new', type: mod.type },
    disabled: !available,
  });
  const changeMods = useEditor((s) => s.changeMods);
  const selectMod = useEditor((s) => s.selectMod);

  const add = () => {
    if (!available) return;
    let id: string | undefined;
    changeMods((config) => {
      const result = addMod(config, mod.type);
      id = result.id;
      return result.config;
    });
    selectMod(id);
  };

  return (
    <div className="relative" title={available ? mod.description : `${mod.name} is already placed. You can use it once.`}>
      <Brick
        ref={setNodeRef}
        color={mod.color}
        emoji={mod.emoji}
        name={mod.name}
        compact
        className={isDragging ? 'opacity-40' : available ? 'cursor-grab' : 'cursor-not-allowed opacity-40 grayscale'}
        onClick={add}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        {...attributes}
        {...listeners}
      />
      {!available && (
        <span className="absolute -right-1 -top-1 rounded-full border-2 border-ink-800 bg-white px-1.5 text-[10px] font-black">placed</span>
      )}
    </div>
  );
}

export function ModToolbox() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOD_SLOTS.map((slot) => ({
      ...slot,
      mods: MODS.filter((m) => m.slot === slot.id && (!q || `${m.name} ${m.description} ${m.type}`.toLowerCase().includes(q))),
    })).filter((group) => group.mods.length > 0);
  }, [query]);

  return (
    <aside className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b-[3px] border-ink-800 bg-brick-purple px-4 py-3 text-white">
        <h2 className="text-lg font-black">🧩 Mod box</h2>
        <p className="text-sm font-semibold opacity-90">Drag a mod onto the terminal, or click it to add it.</p>
      </div>
      <div className="p-3">
        <input className="input" placeholder="🔍 Find a mod…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Find a mod" />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <section key={group.id}>
            <h3 className="field-label" title={group.description}>
              {group.emoji} {group.name}
            </h3>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {group.mods.map((mod) => (
                <ToolboxMod key={mod.type} mod={mod} />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="px-1 text-sm text-ink-400">No mod matches “{query}”.</p>}
      </div>
    </aside>
  );
}

import { useMemo } from 'react';
import { createScenarioContext, PRESETS, renderStatusLines, type Preset } from '@statuscraft/core';
import { usePalette } from '../lib/preview';
import { markWelcomed, useEditor } from '../store';
import { PipSays } from './Pip';
import { TerminalLine } from './TerminalLine';
import { Modal } from './ui';

function KitCard({ preset, onPick }: { preset: Preset; onPick: () => void }) {
  const palette = usePalette();
  const lines = useMemo(
    () =>
      renderStatusLines(preset.layout, createScenarioContext('busy', { terminalWidth: 96 }))
        .map((r) => r.output)
        .filter((o) => o.replace(/\x1b\[[0-9;]*[mK]/g, '').trim()),
    [preset],
  );
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col rounded-2xl border-[3px] border-ink-800 bg-white p-3 text-left shadow-chunky transition-transform hover:-translate-y-1 hover:-rotate-1"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-black">
          {preset.emoji} {preset.name}
        </span>
        {preset.needsNerdFont && (
          <span className="rounded-full bg-brick-purple/15 px-2 py-0.5 text-[11px] font-bold text-brick-purple" title="Uses powerline arrows, which need a Nerd Font">
            Nerd Font
          </span>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-600">{preset.description}</p>
      <div className="mt-auto overflow-hidden rounded-xl px-3 py-2" style={{ background: palette.background }}>
        {lines.map((line, i) => (
          <TerminalLine key={i} ansi={line} palette={palette} />
        ))}
      </div>
    </button>
  );
}

export function StarterKits() {
  const open = useEditor((s) => s.dialog === 'kits');
  const openDialog = useEditor((s) => s.openDialog);
  const change = useEditor((s) => s.change);
  const showToast = useEditor((s) => s.showToast);
  const close = () => {
    markWelcomed();
    openDialog(undefined);
  };

  return (
    <Modal open={open} onClose={close} title="Pick a starter kit" wide>
      <div className="mb-5">
        <PipSays>
          <p className="font-bold">Hi! I’m Pip. 👋</p>
          <p>Pick a kit to start from. You can move, swap and recolor every brick afterwards.</p>
        </PipSays>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PRESETS.map((preset) => (
          <KitCard
            key={preset.id}
            preset={preset}
            onPick={() => {
              change(() => structuredClone(preset.layout));
              close();
              showToast(`${preset.emoji} ${preset.name} is on your baseplate. Press “Apply” when you like it!`);
            }}
          />
        ))}
      </div>
    </Modal>
  );
}

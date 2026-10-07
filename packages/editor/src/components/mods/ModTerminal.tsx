import { createContext, useContext, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import {
  alertsCrossed,
  bandLines,
  doneAlert,
  enabledMods,
  footerText,
  getMod,
  guardCheck,
  hintText,
  MOD_SLOTS,
  modString,
  promptShortcuts,
  quickCommands,
  renderStatusLines,
  spinnerSuffix,
  spinnerWord,
  toolTimerText,
  type ModInstance,
  type ModSlot,
} from '@statuscraft/core';
import { readableTextOn } from '../../lib/colors';
import { useModContext } from '../../lib/mod-preview';
import { removeMod } from '../../lib/mods-ops';
import { previewMood, usePalette } from '../../lib/preview';
import { selectLayout, useEditor } from '../../store';
import { Pip } from '../Pip';
import { PreviewSettings, ScenarioPicker } from '../Preview';
import { TerminalLine } from '../TerminalLine';

// The slot of the mod being dragged, so its drop zone can light up
export const DragSlotContext = createContext<ModSlot | undefined>(undefined);

const CLAUDE_ORANGE = '#D97757';

export const GUARD_SAMPLES = [
  { tool: 'Bash', input: { command: 'rm -rf build/' }, label: 'rm -rf build/' },
  { tool: 'Bash', input: { command: 'git push --force origin main' }, label: 'git push --force origin main' },
  { tool: 'Bash', input: { command: 'npm test' }, label: 'npm test' },
  { tool: 'Edit', input: { file_path: '/home/you/code/my-app/.env' }, label: 'Edit .env' },
  { tool: 'Edit', input: { file_path: '/home/you/code/my-app/src/settings.tsx' }, label: 'Edit src/settings.tsx' },
] as const;

const TOOL_SAMPLES = [
  { call: 'Read(src/settings.tsx)', result: 'Read 84 lines', ms: 300 },
  { call: 'Bash(npm test)', result: '12 passed', ms: 4_200 },
];

function alertSummary(mod: ModInstance): string {
  if (mod.type === 'done-alert') return `after answers over ${modString(mod, 'after')}s`;
  return `at ${modString(mod, 'at')}%`;
}

function ModChip({ mod }: { mod: ModInstance }) {
  const definition = getMod(mod.type);
  const selected = useEditor((s) => s.selectedModId === mod.id);
  const selectMod = useEditor((s) => s.selectMod);
  const changeMods = useEditor((s) => s.changeMods);
  if (!definition) return null;
  const label = mod.type === 'quick-command' ? `/${modString(mod, 'name')}` : definition.name;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        selectMod(mod.id);
      }}
      onKeyDown={(event) => event.key === 'Enter' && selectMod(mod.id)}
      className={clsx(
        'group inline-flex cursor-pointer items-center gap-1 rounded-full border-2 px-2 py-0.5 font-sans text-[11px] font-extrabold leading-tight shadow-sm',
        selected ? 'border-white ring-2 ring-white/70' : 'border-black/30',
        mod.enabled === false && 'opacity-50 line-through',
      )}
      style={{ background: definition.color, color: readableTextOn(definition.color) }}
      title={definition.description}
    >
      <span aria-hidden>{definition.emoji}</span>
      {label}
      <button
        type="button"
        aria-label={`Remove ${definition.name}`}
        className="ml-0.5 hidden rounded-full px-1 leading-none hover:bg-black/20 group-hover:inline"
        onClick={(event) => {
          event.stopPropagation();
          changeMods((config) => removeMod(config, mod.id));
          if (selected) selectMod(undefined);
        }}
      >
        ×
      </button>
    </span>
  );
}

function Zone({ slot, children, className, dark = true }: { slot: ModSlot; children: React.ReactNode; className?: string; dark?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot}`, data: { kind: 'slot', slot } });
  const dragging = useContext(DragSlotContext);
  const placed = useEditor((s) => s.mods.mods.filter((m) => getMod(m.type)?.slot === slot));
  const info = MOD_SLOTS.find((s) => s.id === slot)!;
  const accepts = dragging === slot;
  return (
    <div
      ref={setNodeRef}
      data-slot={slot}
      className={clsx(
        'relative rounded-md transition-all',
        dragging && !accepts && 'opacity-40',
        accepts && 'outline-dashed outline-2 outline-offset-2',
        accepts && (isOver ? 'bg-[#43A047]/25 outline-[#66BB6A]' : 'bg-[#43A047]/10 outline-[#66BB6A]/80'),
        !dragging && placed.length === 0 && (dark ? 'outline-dashed outline-1 outline-white/15' : 'outline-dashed outline-1 outline-ink-800/15'),
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {children}
          {placed.length === 0 && (
            <div className={clsx('px-2 py-1 font-sans text-[11px] font-bold', dark ? 'text-white/35' : 'text-ink-400')}>
              {accepts ? `Drop it here: ${info.name}` : `${info.emoji} ${info.name} · drop a mod here`}
            </div>
          )}
        </div>
        {placed.length > 0 && (
          <div className="flex max-w-[40%] shrink-0 flex-wrap justify-end gap-1 py-0.5">
            {placed.map((mod) => (
              <ModChip key={mod.id} mod={mod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BehindTheScenes({ slot, children }: { slot: ModSlot; children: React.ReactNode }) {
  const info = MOD_SLOTS.find((s) => s.id === slot)!;
  return (
    <Zone slot={slot} dark={false} className="min-h-[92px] bg-cream-100 p-3 pt-4">
      <p className="mb-1 text-xs font-black uppercase tracking-wider text-ink-400">
        {info.emoji} {info.name}
      </p>
      {children}
    </Zone>
  );
}

export function ModTerminal() {
  const mods = useEditor((s) => s.mods);
  const layout = useEditor(selectLayout);
  const width = useEditor((s) => s.preview.width);
  const selectMod = useEditor((s) => s.selectMod);
  const palette = usePalette();
  const mctx = useModContext();

  const band = useMemo(() => bandLines(mods, mctx), [mods, mctx]);
  const status = useMemo(
    () => renderStatusLines(layout, mctx.widgets).map((r) => r.output).filter((o) => o.replace(/\x1b\[[0-9;]*[mK]/g, '').trim()),
    [layout, mctx],
  );
  const suffix = spinnerSuffix(mods, mctx);
  const word = spinnerWord(mods, mctx.state.turns) ?? 'Thinking';
  const footer = footerText(mods, mctx);
  const hint = hintText(mods, mctx);
  const done = doneAlert(mods, mctx.state.lastTurn);
  const alerts = [...alertsCrossed(mods, undefined, mctx.widgets), ...(done ? [done] : [])];
  const shortcuts = promptShortcuts(mods);
  const guards = enabledMods(mods, 'guard');
  const commands = quickCommands(mods);
  const alertMods = enabledMods(mods, 'alert');
  const dim = { color: palette.foreground, opacity: 0.55 };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink-800 bg-brick-purple px-4 py-3 text-white">
        <div>
          <h2 className="text-lg font-black">🖥️ Claude Code, with your mods</h2>
          <p className="text-sm font-semibold opacity-90">Every dashed box is a spot a mod can fill. Click a mod tag to change it.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <Pip mood={previewMood(mctx.widgets)} size={30} />
          <span>Pip feels {previewMood(mctx.widgets)}</span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ScenarioPicker />

        <div className="terminal relative" style={{ background: palette.background }} onClick={() => selectMod(undefined)}>
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            <span className="ml-2 font-mono text-xs" style={{ color: palette.foreground, opacity: 0.6 }}>
              claude — {width} columns
            </span>
          </div>

          {alerts.length > 0 && (
            <div className="absolute right-3 top-12 z-20 max-w-[60%] space-y-1">
              {alerts.map((alert) => (
                <div key={alert} className="animate-pop rounded-lg border px-3 py-1.5 font-mono text-[12px] shadow-lg" style={{ background: palette.background, color: palette.foreground, borderColor: CLAUDE_ORANGE }}>
                  {alert}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5 overflow-x-auto px-4 py-3 font-mono text-[13px]" style={{ color: palette.foreground }}>
            <div className="w-fit rounded px-1" style={{ background: 'rgba(127,127,127,0.18)' }}>
              <span style={dim}>&gt;</span> add a dark mode toggle to the settings page
            </div>
            <div>
              <span style={{ color: palette.foreground }}>●</span> Done. The toggle lives in Settings → Appearance and remembers your choice.
            </div>
            <Zone slot="footer" className="ml-4">
              {footer && (
                <div className="terminal-line" style={dim}>
                  ⎿ {footer}
                </div>
              )}
            </Zone>
            <div className="w-fit rounded px-1" style={{ background: 'rgba(127,127,127,0.18)' }}>
              <span style={dim}>&gt;</span> now add tests for it
            </div>
            <Zone slot="tools">
              {TOOL_SAMPLES.map((sample) => {
                const timer = toolTimerText(mods, sample.ms);
                return (
                  <div key={sample.call}>
                    <div className="terminal-line">
                      <span style={{ color: palette.green }}>⏺</span> <b>{sample.call}</b>
                      {timer && <span style={dim}> {timer}</span>}
                    </div>
                    <div className="terminal-line" style={dim}>
                      {'  '}⎿ {sample.result}
                    </div>
                  </div>
                );
              })}
            </Zone>
            <Zone slot="spinner">
              <div className="terminal-line">
                <span style={{ color: CLAUDE_ORANGE }}>✻ {word}…</span>
                <span style={dim}> (esc to interrupt)</span>
                {suffix && <span style={{ color: CLAUDE_ORANGE }}>{suffix}</span>}
              </div>
            </Zone>

            <Zone slot="band" className="mt-2">
              {band.length > 0 && (
                <div style={{ width: `${width}ch` }}>
                  {band.map((runs, i) => (
                    <TerminalLine key={i} runs={runs} palette={palette} />
                  ))}
                </div>
              )}
            </Zone>

            <div className="rounded-md border px-3 py-1.5" style={{ borderColor: 'rgba(127,127,127,0.5)', width: `${width}ch`, maxWidth: '100%' }}>
              <span style={dim}>&gt;</span> <span style={{ ...dim, opacity: 0.4 }}>Try “add a dark mode toggle”</span>
            </div>
            <Zone slot="hint">
              <div className="terminal-line px-1" style={dim}>
                {hint ?? '? for shortcuts'}
              </div>
            </Zone>
            <div style={{ width: `${width}ch` }} title="Your status line, from the Status line tab">
              {status.map((line, i) => (
                <TerminalLine key={i} ansi={line} palette={palette} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="field-label">Behind the scenes</p>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <BehindTheScenes slot="alert">
              {alertMods.length > 0 ? (
                <ul className="space-y-0.5 text-sm">
                  {alertMods.map((mod) => (
                    <li key={mod.id}>
                      {getMod(mod.type)?.emoji} {getMod(mod.type)?.name}: pops up {alertSummary(mod)}
                    </li>
                  ))}
                  <li className="text-xs text-ink-400">{alerts.length ? 'It would pop up in this session (see the terminal).' : 'Nothing to say in this session.'}</li>
                </ul>
              ) : null}
            </BehindTheScenes>
            <BehindTheScenes slot="guard">
              {guards.length > 0 ? (
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {GUARD_SAMPLES.map((sample) => {
                    const verdict = guardCheck(mods, sample.tool, sample.input);
                    return (
                      <li key={sample.label} title={verdict?.reason ?? 'Runs as usual'}>
                        {verdict ? '🛡️ asks' : '✓ runs'} <span className="text-ink-600">{sample.label}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </BehindTheScenes>
            <BehindTheScenes slot="prompt">
              {shortcuts.length > 0 ? (
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {shortcuts.map((shortcut) => (
                    <li key={shortcut.name} className="truncate" title={shortcut.text}>
                      <b>;{shortcut.name}</b> <span className="text-ink-600">→ {shortcut.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </BehindTheScenes>
            <BehindTheScenes slot="command">
              {commands.length > 0 ? (
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {commands.map((command) => (
                    <li key={command.name}>
                      <b>/{command.name}</b> <span className="text-ink-600">runs {command.command}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </BehindTheScenes>
          </div>
        </div>

        <PreviewSettings />
      </div>
    </section>
  );
}

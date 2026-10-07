import { useMemo } from 'react';
import { renderStatusLines, SCENARIO_LABELS, SCENARIOS } from '@statuscraft/core';
import { previewMood, usePalette, usePreviewContext } from '../lib/preview';
import { terminals } from '../lib/terminal-themes';
import { selectLayout, useEditor } from '../store';
import { Pip } from './Pip';
import { TerminalLine } from './TerminalLine';
import { Segmented } from './ui';

export function Preview() {
  const layout = useEditor(selectLayout);
  const preview = useEditor((s) => s.preview);
  const ctx = usePreviewContext();
  const palette = usePalette();
  const lines = useMemo(
    () => renderStatusLines(layout, ctx).map((r) => r.output).filter((output) => output.replace(/\x1b\[[0-9;]*[mK]/g, '').trim()),
    [layout, ctx],
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink-800 bg-brick-green px-4 py-3 text-white">
        <h2 className="text-lg font-black">👀 Live preview</h2>
        <div className="flex items-center gap-2 text-sm font-bold">
          <Pip mood={previewMood(ctx)} size={30} />
          <span>Pip feels {previewMood(ctx)}</span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ScenarioPicker />

        <div className="terminal" style={{ background: palette.background }}>
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            <span className="ml-2 font-mono text-xs" style={{ color: palette.foreground, opacity: 0.6 }}>
              claude — {preview.width} columns
            </span>
          </div>
          <div className="overflow-x-auto px-4 py-3" style={{ color: palette.foreground }}>
            <div className="mb-2 font-mono text-[13px] opacity-60">● Done. The login form now validates emails.</div>
            <div className="mb-1 rounded-md border px-3 py-1.5 font-mono text-[13px]" style={{ borderColor: 'rgba(127,127,127,0.5)', width: `${preview.width}ch`, maxWidth: '100%' }}>
              <span className="opacity-60">&gt;</span> <span className="opacity-40">Try “add a dark mode toggle”</span>
            </div>
            <div style={{ width: `${preview.width}ch` }}>
              {lines.length > 0 ? (
                lines.map((line, i) => <TerminalLine key={i} ansi={line} palette={palette} />)
              ) : (
                <div className="terminal-line opacity-50">(nothing to show in this session: add some bricks)</div>
              )}
            </div>
          </div>
        </div>

        <PreviewSettings />
      </div>
    </section>
  );
}

export function ScenarioPicker() {
  const preview = useEditor((s) => s.preview);
  const setPreview = useEditor((s) => s.setPreview);
  const live = useEditor((s) => s.live);
  const scenarioOptions = [
    ...SCENARIOS.map((s) => ({ value: s as string, label: `${SCENARIO_LABELS[s].emoji} ${SCENARIO_LABELS[s].label}`, title: SCENARIO_LABELS[s].description })),
    ...(live ? [{ value: 'live', label: '📡 My last session', title: 'The data Claude Code sent last time' }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="field-label mb-0 mr-1">Try a session</span>
      <Segmented value={preview.scenario} options={scenarioOptions} onChange={(scenario) => setPreview({ scenario: scenario as typeof preview.scenario })} />
    </div>
  );
}

export function PreviewSettings() {
  const preview = useEditor((s) => s.preview);
  const setPreview = useEditor((s) => s.setPreview);
  const app = terminals[preview.terminal] ?? terminals['iterm2']!;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className="field-label">Width: {preview.width} columns</span>
        <input
          type="range"
          min={50}
          max={200}
          value={preview.width}
          onChange={(event) => setPreview({ width: Number(event.target.value) })}
          className="w-full accent-[#43A047]"
        />
      </label>
      <label className="block">
        <span className="field-label">Terminal</span>
        <select
          className="input"
          value={preview.terminal}
          onChange={(event) => setPreview({ terminal: event.target.value, theme: terminals[event.target.value]?.defaultTheme ?? 'default' })}
        >
          {Object.entries(terminals).map(([id, terminal]) => (
            <option key={id} value={id}>
              {terminal.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Theme</span>
        <select className="input" value={preview.theme} onChange={(event) => setPreview({ theme: event.target.value })}>
          {Object.entries(app.themes).map(([id, theme]) => (
            <option key={id} value={id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

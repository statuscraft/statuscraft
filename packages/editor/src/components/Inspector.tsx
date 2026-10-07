import clsx from 'clsx';
import {
  getPowerlineThemes,
  getWidget,
  POWERLINE_SEPARATORS,
  POWERLINE_THEMES,
  readBoolean,
  readNumber,
  readString,
  writeOption,
  type PowerlineSeparatorStyle,
  type Settings,
  type Threshold,
  type WidgetConfig,
  type WidgetOption,
} from '@statuscraft/core';
import { configColorToCss, FOREGROUND_NAMES, toBackgroundName } from '../lib/colors';
import { clearBrickColors, findBrick, removeBrick, updateBrick } from '../lib/layout-ops';
import { brickColor, usePalette } from '../lib/preview';
import { selectLayout, useEditor } from '../store';
import { Brick } from './Brick';
import { Pip } from './Pip';
import { Section, Segmented, Toggle, ToyButton } from './ui';

function ColorStuds({
  value,
  onChange,
  background,
  allowNone,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  background?: boolean;
  allowNone?: boolean;
}) {
  const palette = usePalette();
  const names = FOREGROUND_NAMES.map((name) => (background ? toBackgroundName(name) : name));
  const custom = value?.startsWith('hex:') ? `#${value.slice(4)}` : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowNone && (
        <button
          type="button"
          title="No color"
          onClick={() => onChange(undefined)}
          className={clsx('color-stud bg-[repeating-linear-gradient(45deg,#fff_0_4px,#eee_4px_8px)]', !value && 'color-stud-on')}
        />
      )}
      {names.map((name) => (
        <button
          type="button"
          key={name}
          title={name}
          onClick={() => onChange(name)}
          className={clsx('color-stud', value === name && 'color-stud-on')}
          style={{ background: configColorToCss(name, palette) }}
        />
      ))}
      <label
        title="Any color"
        className={clsx('color-stud relative cursor-pointer overflow-hidden', custom && 'color-stud-on')}
        style={{ background: custom ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
      >
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={custom ?? '#ff8800'}
          onChange={(event) => onChange(`hex:${event.target.value.slice(1).toUpperCase()}`)}
        />
      </label>
    </div>
  );
}

function OptionField({ widget, option }: { widget: WidgetConfig; option: WidgetOption }) {
  const change = useEditor((s) => s.change);
  const set = (value: string | number | boolean) =>
    change((layout) => updateBrick(layout, widget.id, (w) => writeOption(w, option.key, value)), `${widget.id}:${option.key}`);

  switch (option.kind) {
    case 'toggle':
      return <Toggle label={option.label} checked={readBoolean(widget, option.key, option.default)} onChange={set} />;
    case 'select':
      return (
        <Section title={option.label} className="mb-3">
          <select className="input" value={readString(widget, option.key, option.default)} onChange={(event) => set(event.target.value)}>
            {option.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </Section>
      );
    case 'number':
      return (
        <Section title={option.label} className="mb-3">
          <input
            type="number"
            className="input"
            min={option.min}
            max={option.max}
            value={readNumber(widget, option.key, option.default)}
            onChange={(event) => set(Number(event.target.value))}
          />
        </Section>
      );
    case 'text':
      return (
        <Section title={option.label} className="mb-3">
          <input
            className="input font-mono"
            placeholder={option.placeholder}
            value={readString(widget, option.key, option.default)}
            onChange={(event) => set(event.target.value)}
          />
        </Section>
      );
  }
}

function ThresholdEditor({ widget }: { widget: WidgetConfig }) {
  const change = useEditor((s) => s.change);
  const definition = getWidget(widget.type)!;
  const thresholds = widget.thresholds ?? [];
  const on = thresholds.length > 0;
  const setThresholds = (next: readonly Threshold[] | undefined) =>
    change((layout) => updateBrick(layout, widget.id, (w) => ({ ...w, thresholds: next })), `${widget.id}:thresholds`);
  const at = (tone: Threshold['tone']) => thresholds.find((t) => t.tone === tone)?.at ?? definition.thresholds!.defaults.find((t) => t.tone === tone)?.at ?? 0;
  const setAt = (tone: Threshold['tone'], value: number) =>
    setThresholds([
      { at: tone === 'warn' ? value : at('warn'), tone: 'warn' },
      { at: tone === 'danger' ? value : at('danger'), tone: 'danger' },
    ]);

  return (
    <div className="rounded-xl bg-cream-100 p-3">
      <Toggle
        label="Warning colors"
        hint={definition.thresholds!.hint}
        checked={on}
        onChange={(value) => setThresholds(value ? definition.thresholds!.defaults.map((t) => ({ ...t })) : undefined)}
      />
      {on && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label>
            <span className="field-label">🟡 Yellow from</span>
            <input type="number" className="input" value={at('warn')} onChange={(event) => setAt('warn', Number(event.target.value))} />
          </label>
          <label>
            <span className="field-label">🔴 Red from</span>
            <input type="number" className="input" value={at('danger')} onChange={(event) => setAt('danger', Number(event.target.value))} />
          </label>
        </div>
      )}
    </div>
  );
}

function BrickSettings({ widget, position }: { widget: WidgetConfig; position: number }) {
  const layout = useEditor(selectLayout);
  const change = useEditor((s) => s.change);
  const select = useEditor((s) => s.select);
  const palette = usePalette();
  const definition = getWidget(widget.type);
  const update = (patch: Partial<WidgetConfig>, key?: string) =>
    change((l) => updateBrick(l, widget.id, (w) => ({ ...w, ...patch })), key);
  const isLayoutBrick = widget.type === 'separator' || widget.type === 'flex-separator';

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Brick color={brickColor(widget, position, layout, palette)} emoji={definition?.emoji ?? '❓'} name={definition?.name ?? widget.type} />
      </div>
      <p className="mb-4 text-sm text-ink-600">{definition?.description ?? 'This brick comes from a newer StatusCraft version.'}</p>
      {definition?.needs?.includes('companion') && (
        <p className="mb-4 rounded-xl bg-brick-yellow/30 p-3 text-sm font-semibold">
          This brick needs the StatusCraft plugin for Claude Code. See the README for the two commands that install it.
        </p>
      )}

      {!isLayoutBrick && (
        <>
          <Section title={layout.powerline.enabled ? 'Text color' : 'Color'}>
            <ColorStuds value={widget.color} onChange={(color) => update({ color })} allowNone={layout.powerline.enabled} />
          </Section>
          {layout.powerline.enabled && (
            <Section title="Brick color">
              <ColorStuds value={widget.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} background allowNone />
              <p className="mt-1 text-xs text-ink-400">Leave empty to use the theme’s colors.</p>
            </Section>
          )}
          <Toggle label="Bold" checked={widget.bold ?? false} onChange={(bold) => update({ bold })} />
          {definition?.label && (
            <Toggle
              label={`Show the “${definition.label}” label`}
              checked={!widget.rawValue}
              onChange={(show) => update({ rawValue: !show })}
            />
          )}
          {definition?.thresholds && (
            <div className="my-3">
              <ThresholdEditor widget={widget} />
            </div>
          )}
        </>
      )}

      {definition?.options && definition.options.length > 0 && (
        <div className="mt-3">
          {definition.options.map((option) => (
            <OptionField key={option.key} widget={widget} option={option} />
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <ToyButton tone="red" onClick={() => (change((l) => removeBrick(l, widget.id)), select(undefined))}>
          🗑️ Remove
        </ToyButton>
        <ToyButton onClick={() => select(undefined)}>Done</ToyButton>
      </div>
    </div>
  );
}

const SEPARATOR_CHOICES = [' │ ', ' | ', ' · ', ' • ', ' / ', '  ', ' ▸ '];

function ThemeSwatch({ name }: { name: string }) {
  const palette = usePalette();
  const colors = POWERLINE_THEMES[name]?.[3]?.bg ?? ['bgBlue', 'bgGreen', 'bgYellow'];
  return (
    <span className="flex">
      {colors.slice(0, 5).map((color, i) => (
        <span key={i} className="h-4 w-4 first:rounded-l last:rounded-r" style={{ background: configColorToCss(color, palette) }} />
      ))}
    </span>
  );
}

function LookPanel() {
  const layout = useEditor(selectLayout);
  const change = useEditor((s) => s.change);
  const setLook = (patch: Partial<Settings>, key?: string) => change((l) => ({ ...l, ...patch }), key);
  const setPowerline = (patch: Partial<Settings['powerline']>) =>
    change((l) => ({ ...l, powerline: { ...l.powerline, ...patch } }));
  const separatorStyle = (Object.entries(POWERLINE_SEPARATORS).find(([, glyphs]) => glyphs.left === layout.powerline.separators[0])?.[0] ??
    'arrow') as PowerlineSeparatorStyle;
  const rounded = layout.powerline.startCaps.length > 0;

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Pip mood="content" size={44} />
        <p className="text-sm font-semibold text-ink-600">Click a brick to change it. Here you set the look of the whole line.</p>
      </div>

      <Section title="Style">
        <div className="grid grid-cols-2 gap-2">
          {[
            { on: false, title: 'Plain text', sample: 'Opus │ main', note: 'Works everywhere' },
            { on: true, title: 'Powerline', sample: '▶ arrows ▶', note: 'Needs a Nerd Font' },
          ].map((choice) => (
            <button
              key={choice.title}
              type="button"
              onClick={() => change((l) => {
                const next = { ...l, powerline: { ...l.powerline, enabled: choice.on, theme: l.powerline.theme ?? 'bricks' } };
                return choice.on && (next.powerline.theme ?? 'custom') !== 'custom' ? clearBrickColors(next) : next;
              })}
              className={clsx('rounded-xl border-[3px] p-3 text-left transition-colors', layout.powerline.enabled === choice.on ? 'border-ink-800 bg-brick-yellow' : 'border-ink-800/20 bg-white hover:border-ink-800/50')}
            >
              <span className="block font-black">{choice.title}</span>
              <span className="block font-mono text-xs">{choice.sample}</span>
              <span className="block text-xs text-ink-400">{choice.note}</span>
            </button>
          ))}
        </div>
      </Section>

      {layout.powerline.enabled ? (
        <>
          <Section title="Theme">
            <div className="grid grid-cols-2 gap-2">
              {getPowerlineThemes().map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => change((l) => {
                    const next = { ...l, powerline: { ...l.powerline, theme: name } };
                    return name === 'custom' ? next : clearBrickColors(next);
                  })}
                  className={clsx('flex items-center justify-between gap-2 rounded-xl border-[3px] px-3 py-2 text-sm font-bold', (layout.powerline.theme ?? 'custom') === name ? 'border-ink-800 bg-brick-yellow' : 'border-ink-800/20 bg-white')}
                >
                  <span>{POWERLINE_THEMES[name]?.name ?? name}</span>
                  {name !== 'custom' ? <ThemeSwatch name={name} /> : <span className="text-xs text-ink-400">your colors</span>}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Brick edges">
            <Segmented<PowerlineSeparatorStyle>
              value={separatorStyle}
              options={(['arrow', 'round', 'slash', 'flame', 'pixel'] as const).map((style) => ({ value: style, label: style }))}
              onChange={(style) => setPowerline({ separators: [POWERLINE_SEPARATORS[style].left] })}
            />
          </Section>
          <Toggle
            label="Rounded ends"
            checked={rounded}
            onChange={(on) => setPowerline(on ? { startCaps: ['\uE0B6'], endCaps: ['\uE0B4'] } : { startCaps: [], endCaps: [] })}
          />
        </>
      ) : (
        <Section title="Between bricks">
          <Segmented
            value={layout.defaultSeparator ?? ' │ '}
            options={SEPARATOR_CHOICES.map((choice) => ({ value: choice, label: <span className="font-mono">{choice.trim() || '␣␣'}</span> }))}
            onChange={(defaultSeparator) => setLook({ defaultSeparator })}
          />
        </Section>
      )}

      <Section title="Colors">
        <Segmented
          value={layout.colorLevel}
          options={[
            { value: 3, label: 'Millions', title: 'True color: most modern terminals' },
            { value: 2, label: '256', title: 'Works almost everywhere' },
            { value: 1, label: '16', title: 'Your terminal theme’s colors' },
            { value: 0, label: 'None', title: 'Plain text' },
          ]}
          onChange={(colorLevel) => setLook({ colorLevel })}
        />
      </Section>

      <Section title="Width">
        <Segmented
          value={layout.flexMode}
          options={[
            { value: 'full-minus-40', label: 'Leave room for notices', title: 'Claude Code shows notices on the right of this row' },
            { value: 'full', label: 'Full width' },
          ]}
          onChange={(flexMode) => setLook({ flexMode })}
        />
      </Section>

      <Toggle label="Bold everything" checked={layout.globalBold} onChange={(globalBold) => setLook({ globalBold })} />
    </div>
  );
}

export function Inspector() {
  const layout = useEditor(selectLayout);
  const selectedId = useEditor((s) => s.selectedId);
  const found = selectedId ? findBrick(layout, selectedId) : undefined;

  return (
    <aside className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className={clsx('border-b-[3px] border-ink-800 px-4 py-3', found ? 'bg-brick-blue text-white' : 'bg-brick-yellow')}>
        <h2 className="text-lg font-black">{found ? '🔧 This brick' : '🎨 The look'}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {found ? <BrickSettings key={found.widget.id} widget={found.widget} position={found.index} /> : <LookPanel />}
      </div>
    </aside>
  );
}

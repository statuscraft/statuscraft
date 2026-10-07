import { useState } from 'react';
import clsx from 'clsx';
import { getMod, guardCheck, MOD_SLOTS, modBoolean, modNumber, modString, type ModInstance, type WidgetOption } from '@statuscraft/core';
import { findMod, moveMod, removeMod, setModOption, updateMod } from '../../lib/mods-ops';
import { selectModsDirty, useEditor } from '../../store';
import { Brick } from '../Brick';
import { Pip } from '../Pip';
import { Section, Toggle, ToyButton } from '../ui';

function ModOptionField({ mod, option }: { mod: ModInstance; option: WidgetOption }) {
  const changeMods = useEditor((s) => s.changeMods);
  const set = (value: string | number | boolean) => changeMods((config) => setModOption(config, mod.id, option.key, value), `${mod.id}:${option.key}`);

  switch (option.kind) {
    case 'toggle':
      return <Toggle label={option.label} checked={modBoolean(mod, option.key)} onChange={set} />;
    case 'select':
      return (
        <Section title={option.label} className="mb-3">
          <select className="input" value={modString(mod, option.key)} onChange={(event) => set(event.target.value)}>
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
          <input type="number" className="input" min={option.min} max={option.max} value={modNumber(mod, option.key)} onChange={(event) => set(Number(event.target.value))} />
        </Section>
      );
    case 'text':
      return (
        <Section title={option.label} className="mb-3">
          <input className="input font-mono" placeholder={option.placeholder} value={modString(mod, option.key)} onChange={(event) => set(event.target.value)} />
        </Section>
      );
  }
}

function GuardTester({ mod }: { mod: ModInstance }) {
  const files = mod.type === 'protected-files';
  const [command, setCommand] = useState(files ? 'config/.env.local' : 'rm -rf node_modules');
  const config = { version: 1 as const, mods: [{ ...mod, enabled: true }] };
  const verdict = files ? guardCheck(config, 'Edit', { file_path: command }) : guardCheck(config, 'Bash', { command });
  const title = files ? 'Try a file Claude wants to change' : 'Try a command';
  return (
    <Section title={title}>
      <input className="input font-mono" value={command} onChange={(event) => setCommand(event.target.value)} aria-label={title} />
      <p className={clsx('mt-2 rounded-xl px-3 py-2 text-sm font-bold', verdict ? 'bg-brick-orange/15 text-ink-800' : 'bg-brick-green/15 text-brick-green')}>
        {verdict ? `${verdict.reason} Claude Code asks you first.` : '✓ Runs as usual.'}
      </p>
    </Section>
  );
}

function ModSettings({ mod }: { mod: ModInstance }) {
  const definition = getMod(mod.type);
  const changeMods = useEditor((s) => s.changeMods);
  const selectMod = useEditor((s) => s.selectMod);
  if (!definition) return <p className="text-sm text-ink-400">This mod is not known to this version of StatusCraft.</p>;
  const slot = MOD_SLOTS.find((s) => s.id === definition.slot)!;

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <Brick color={definition.color} emoji={definition.emoji} name={definition.name} />
      </div>
      <p className="mb-1 text-sm text-ink-600">{definition.description}</p>
      <p className="mb-4 text-xs font-bold text-ink-400">
        Shows in: {slot.emoji} {slot.name}
      </p>

      <Toggle
        label="Switched on"
        hint="Keep it placed, but stop it for now"
        checked={mod.enabled !== false}
        onChange={(enabled) => changeMods((config) => updateMod(config, mod.id, (m) => ({ ...m, enabled })))}
      />
      <div className="mt-3">
        {definition.options?.map((option) => (
          <ModOptionField key={option.key} mod={mod} option={option} />
        ))}
      </div>
      {(mod.type === 'danger-guard' || mod.type === 'protected-files') && <GuardTester mod={mod} />}
      {mod.type === 'prompt-shortcuts' && (
        <p className="mb-4 rounded-xl bg-cream-100 p-3 text-xs text-ink-600">
          Type a shortcut like <b>;tests</b> anywhere in your prompt. When you send it, Claude Code shows and sends the full text instead.
        </p>
      )}
      {mod.type === 'quick-command' && (
        <p className="mb-4 rounded-xl bg-cream-100 p-3 text-xs text-ink-600">
          Type <b>/{modString(mod, 'name')}</b> in Claude Code. It runs on your computer at once, without asking Claude, and shows what the command printed.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <ToyButton onClick={() => changeMods((config) => moveMod(config, mod.id, -1))} title="Draw it before the mod above">
          ↑ Earlier
        </ToyButton>
        <ToyButton onClick={() => changeMods((config) => moveMod(config, mod.id, 1))} title="Draw it after the mod below">
          ↓ Later
        </ToyButton>
        <ToyButton
          tone="red"
          onClick={() => {
            changeMods((config) => removeMod(config, mod.id));
            selectMod(undefined);
          }}
        >
          🗑️ Remove
        </ToyButton>
      </div>
    </div>
  );
}

function ModsOverview() {
  const mode = useEditor((s) => s.mode);
  const mods = useEditor((s) => s.mods);
  const server = useEditor((s) => s.modsServer);
  const busy = useEditor((s) => s.busy);
  const dirty = useEditor(selectModsDirty);
  const uninstall = useEditor((s) => s.uninstallMods);
  const plugin = server?.plugin;

  let status: { mood: 'happy' | 'content' | 'worried'; text: string };
  if (mode === 'demo') status = { mood: 'content', text: 'This is the demo. Run npx statuscraft on your computer to switch mods on.' };
  else if (!plugin) status = { mood: 'content', text: 'Checking Claude Code…' };
  else if (!plugin.claude.found) status = { mood: 'worried', text: 'I could not find Claude Code on this computer.' };
  else if (!plugin.modsSupported) status = { mood: 'worried', text: `Mods need Claude Code 2.1.287 or newer. You have ${plugin.claude.version ?? 'an older one'}: run claude update.` };
  else if (plugin.disabledByHooksSetting) status = { mood: 'worried', text: '"disableAllHooks" is on in your Claude Code settings, so mods stay off.' };
  else if (plugin.installed && plugin.enabled) status = { mood: 'happy', text: `The StatusCraft mod is on (Claude Code ${plugin.claude.version}).${dirty ? ' Press Apply to send your changes.' : ''}` };
  else status = { mood: 'content', text: 'Press Apply and I will add the StatusCraft mod to Claude Code.' };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-cream-100 p-3">
        <Pip mood={status.mood} size={40} />
        <p className="text-sm font-bold">{status.text}</p>
      </div>
      {plugin?.error && <p className="rounded-xl bg-brick-red/10 p-3 text-xs text-ink-600">{plugin.error}</p>}

      <Section title="Your mods">
        {mods.mods.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing placed yet. Drag a mod from the mod box onto the terminal.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {MOD_SLOTS.map((slot) => {
              const placed = mods.mods.filter((m) => getMod(m.type)?.slot === slot.id);
              if (!placed.length) return null;
              return (
                <li key={slot.id}>
                  <b>
                    {slot.emoji} {slot.name}:
                  </b>{' '}
                  {placed.map((m) => (m.type === 'quick-command' ? `/${modString(m, 'name')}` : getMod(m.type)?.name)).join(', ')}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Good to know">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
          <li>Mods run inside Claude Code 2.1.287 or newer, in the terminal and the desktop app. The VS Code chat panel and claude -p run them but do not draw them.</li>
          <li>Your mods live in {server?.path ? <code className="break-all">{server.path}</code> : <code>~/.config/statuscraft/mods.json</code>}. Open sessions reload it within a couple of seconds.</li>
          <li>The Danger Guard only ever asks you. It never says yes for you.</li>
          <li>Quick commands run on your computer, as you, only when you type them.</li>
        </ul>
      </Section>

      {plugin?.installed && mode === 'connected' && (
        <button type="button" className="text-xs font-bold text-ink-400 underline hover:text-ink-800" disabled={busy} onClick={() => void uninstall()}>
          Remove the StatusCraft mod from Claude Code
        </button>
      )}
    </div>
  );
}

export function ModInspector() {
  const mods = useEditor((s) => s.mods);
  const selectedModId = useEditor((s) => s.selectedModId);
  const mod = findMod(mods, selectedModId);

  return (
    <aside className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className={clsx('border-b-[3px] border-ink-800 px-4 py-3', mod ? 'bg-brick-blue text-white' : 'bg-brick-yellow')}>
        <h2 className="text-lg font-black">{mod ? '🔧 This mod' : '🧩 Your mods'}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{mod ? <ModSettings key={mod.id} mod={mod} /> : <ModsOverview />}</div>
    </aside>
  );
}

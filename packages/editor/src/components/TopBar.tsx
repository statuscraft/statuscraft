import clsx from 'clsx';
import { selectIsDirty, selectModsDirty, useEditor } from '../store';
import { Pip } from './Pip';
import { ToyButton } from './ui';

export function TopBar() {
  const mode = useEditor((s) => s.mode);
  const server = useEditor((s) => s.server);
  const config = useEditor((s) => s.config);
  const profile = useEditor((s) => s.profile);
  const setProfile = useEditor((s) => s.setProfile);
  const openDialog = useEditor((s) => s.openDialog);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const apply = useEditor((s) => s.apply);
  const busy = useEditor((s) => s.busy);
  const product = useEditor((s) => s.product);
  const setProduct = useEditor((s) => s.setProduct);
  const applyMods = useEditor((s) => s.applyMods);
  const plugin = useEditor((s) => s.modsServer?.plugin);
  const statusDirty = useEditor(selectIsDirty);
  const modsDirty = useEditor(selectModsDirty);
  const installed = server?.install.ours ?? false;
  const modsOn = Boolean(plugin?.installed && plugin.enabled);
  const isMods = product === 'mods';
  const dirty = isMods ? modsDirty : statusDirty;

  return (
    <header className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="mr-2 flex items-center gap-2">
        <Pip size={46} className="hover:animate-wobble" />
        <div>
          <h1 className="text-2xl font-black leading-none tracking-tight">
            Status<span className="text-brick-red">Craft</span>
          </h1>
          <p className="text-xs font-bold text-ink-400">Build your Claude Code status line and mods from bricks</p>
        </div>
      </div>

      <div className="flex rounded-2xl border-[3px] border-ink-800 bg-white p-1 shadow-chunky" role="tablist" aria-label="What to build">
        {(
          [
            { id: 'statusline', label: '🧱 Status line', dirty: statusDirty },
            { id: 'mods', label: '🧩 Mods', dirty: modsDirty },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={product === tab.id}
            onClick={() => setProduct(tab.id)}
            className={clsx(
              'relative rounded-xl px-3 py-1.5 text-sm font-black transition-colors',
              product === tab.id ? (tab.id === 'mods' ? 'bg-brick-purple text-white' : 'bg-brick-red text-white') : 'text-ink-600 hover:bg-cream-100',
            )}
          >
            {tab.label}
            {tab.dirty && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-ink-800 bg-brick-orange" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <div className={clsx('flex items-center gap-2 rounded-2xl border-[3px] border-ink-800 bg-white px-2 py-1 shadow-chunky', isMods && 'hidden')}>
        <span className="pl-1 text-xs font-black uppercase tracking-wider text-ink-400">Profile</span>
        <select
          className="rounded-lg bg-transparent py-1 font-bold outline-none"
          value={profile}
          onChange={(event) => setProfile(event.target.value)}
          aria-label="Profile"
        >
          {Object.keys(config.profiles).map((name) => (
            <option key={name} value={name}>
              {name}
              {name === config.activeProfile ? ' (in use)' : ''}
            </option>
          ))}
        </select>
        <button type="button" className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-cream-100" onClick={() => openDialog('profiles')}>
          Manage
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className="chip" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button type="button" className="chip" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          ↷
        </button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {mode === 'connected' && !isMods && (
          <span
            className={clsx('rounded-full px-3 py-1 text-xs font-black', installed ? 'bg-brick-green/15 text-brick-green' : 'bg-brick-orange/15 text-brick-orange')}
            title={server?.install.command}
          >
            {installed ? '✓ Claude Code uses StatusCraft' : '● Not switched on yet'}
          </span>
        )}
        {mode === 'connected' && isMods && (
          <span
            className={clsx('rounded-full px-3 py-1 text-xs font-black', modsOn ? 'bg-brick-green/15 text-brick-green' : 'bg-brick-orange/15 text-brick-orange')}
            title={plugin?.id}
          >
            {modsOn ? '✓ StatusCraft mod is on' : '● Mod not switched on yet'}
          </span>
        )}
        {mode === 'demo' && <span className="rounded-full bg-brick-blue/15 px-3 py-1 text-xs font-black text-brick-blue">Demo: run npx statuscraft to install</span>}
        {!isMods && (
          <>
            <ToyButton tone="yellow" onClick={() => openDialog('kits')}>
              🧱 Starter kits
            </ToyButton>
            <ToyButton onClick={() => openDialog('share')}>🔗 Share</ToyButton>
            {mode === 'connected' && <ToyButton onClick={() => openDialog('project')}>📁 Project</ToyButton>}
          </>
        )}
        <ToyButton tone="green" onClick={() => void (isMods ? applyMods() : apply())} disabled={busy} className="relative">
          {busy ? 'Saving…' : (isMods ? modsOn : installed) ? '✔ Apply' : '🚀 Apply to Claude Code'}
          {dirty && <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full border-2 border-ink-800 bg-brick-red" title="Unsaved changes" />}
        </ToyButton>
      </div>
    </header>
  );
}

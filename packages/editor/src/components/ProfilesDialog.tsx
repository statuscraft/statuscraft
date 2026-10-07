import { useState } from 'react';
import type { Rule, StatusCraftConfig } from '@statuscraft/core';
import { useEditor } from '../store';
import { Modal, ToyButton } from './ui';

const NAME = /^[a-z0-9][a-z0-9-_]{0,31}$/i;

function ruleValue(config: StatusCraftConfig, profile: string, field: 'repo' | 'path'): string {
  return config.rules.find((rule) => rule.profile === profile && rule.match[field] !== undefined)?.match[field] ?? '';
}

function withRule(config: StatusCraftConfig, profile: string, field: 'repo' | 'path', value: string): StatusCraftConfig {
  const others = config.rules.filter((rule) => !(rule.profile === profile && rule.match[field] !== undefined));
  const rule: Rule = { match: { [field]: value.trim() }, profile };
  return { ...config, rules: value.trim() ? [...others, rule] : others };
}

export function ProfilesDialog() {
  const open = useEditor((s) => s.dialog === 'profiles');
  const openDialog = useEditor((s) => s.openDialog);
  const config = useEditor((s) => s.config);
  const current = useEditor((s) => s.profile);
  const setProfile = useEditor((s) => s.setProfile);
  const changeConfig = useEditor((s) => s.changeConfig);
  const [newName, setNewName] = useState('');
  const names = Object.keys(config.profiles);
  const nameProblem = newName && (!NAME.test(newName) ? 'Use letters, numbers, - and _' : names.includes(newName) ? 'That name is taken' : undefined);

  const create = () => {
    changeConfig((c) => ({ ...c, profiles: { ...c.profiles, [newName]: structuredClone(c.profiles[current]!) } }));
    setProfile(newName);
    setNewName('');
  };

  const [renaming, setRenaming] = useState<{ from: string; to: string }>();

  const rename = (from: string, rawTo: string) => {
    const to = rawTo.trim();
    setRenaming(undefined);
    if (!to || to === from || !NAME.test(to) || names.includes(to)) return;
    changeConfig((c) => {
      const profiles = Object.fromEntries(Object.entries(c.profiles).map(([name, layout]) => [name === from ? to : name, layout]));
      return {
        ...c,
        profiles,
        activeProfile: c.activeProfile === from ? to : c.activeProfile,
        rules: c.rules.map((rule) => (rule.profile === from ? { ...rule, profile: to } : rule)),
      };
    });
    if (current === from) setProfile(to);
  };

  const remove = (name: string) => {
    const fallback = names.find((n) => n !== name)!;
    changeConfig((c) => {
      const { [name]: _removed, ...profiles } = c.profiles;
      return {
        ...c,
        profiles,
        activeProfile: c.activeProfile === name ? fallback : c.activeProfile,
        rules: c.rules.filter((rule) => rule.profile !== name),
      };
    });
    if (current === name) setProfile(fallback);
  };

  return (
    <Modal open={open} onClose={() => openDialog(undefined)} title="🗂️ Profiles">
      <p className="mb-4 text-ink-600">
        Profiles are saved designs. Keep one for work and one for fun, and let StatusCraft pick the right one for each repo or folder.
      </p>
      <div className="space-y-3">
        {names.map((name) => (
          <div key={name} className="rounded-2xl border-[3px] border-ink-800/20 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {renaming?.from === name ? (
                <form className="flex gap-1" onSubmit={(event) => (event.preventDefault(), rename(name, renaming.to))}>
                  <input
                    autoFocus
                    className="input py-1"
                    value={renaming.to}
                    onChange={(event) => setRenaming({ from: name, to: event.target.value })}
                    aria-label={`New name for ${name}`}
                  />
                  <button type="submit" className="chip chip-on">Save</button>
                </form>
              ) : (
                <button type="button" className="text-lg font-black hover:underline" onClick={() => (setProfile(name), openDialog(undefined))}>
                  {name}
                </button>
              )}
              {name === config.activeProfile && <span className="rounded-full bg-brick-green/15 px-2 text-xs font-black text-brick-green">used by default</span>}
              {name === current && <span className="rounded-full bg-brick-blue/15 px-2 text-xs font-black text-brick-blue">editing</span>}
              <span className="ml-auto flex gap-1">
                {name !== config.activeProfile && (
                  <button type="button" className="chip" onClick={() => changeConfig((c) => ({ ...c, activeProfile: name }))}>
                    Use by default
                  </button>
                )}
                <button type="button" className="chip" onClick={() => setRenaming({ from: name, to: name })}>Rename</button>
                {names.length > 1 && <button type="button" className="chip" onClick={() => remove(name)}>Delete</button>}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label>
                <span className="field-label">Auto-use in repos</span>
                <input
                  className="input font-mono text-sm"
                  placeholder="acme/* or me/my-app"
                  value={ruleValue(config, name, 'repo')}
                  onChange={(event) => changeConfig((c) => withRule(c, name, 'repo', event.target.value), `rule:${name}:repo`)}
                />
              </label>
              <label>
                <span className="field-label">Auto-use in folders</span>
                <input
                  className="input font-mono text-sm"
                  placeholder="~/work"
                  value={ruleValue(config, name, 'path')}
                  onChange={(event) => changeConfig((c) => withRule(c, name, 'path', event.target.value), `rule:${name}:path`)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <span className="field-label">New profile (starts as a copy of “{current}”)</span>
        <div className="flex gap-2">
          <input className="input" placeholder="work" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <ToyButton tone="green" disabled={!newName || Boolean(nameProblem)} onClick={create}>
            Create
          </ToyButton>
        </div>
        {nameProblem && <p className="mt-1 text-sm font-bold text-brick-red">{nameProblem}</p>}
      </div>
    </Modal>
  );
}

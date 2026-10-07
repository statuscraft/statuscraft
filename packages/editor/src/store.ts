import { create } from 'zustand';
import {
  createDefaultConfig,
  createDefaultModsConfig,
  createDefaultSettings,
  isCommandTrusted,
  layoutCommandApprovals,
  quickCommands,
  type CommandApproval,
  type CommandTrust,
  parseConfig,
  parseModsConfig,
  type ModsConfig,
  type Mood,
  type Scenario,
  type Settings,
  type StatusCraftConfig,
} from '@statuscraft/core';
import { api, type LiveData, type ModsState, type ServerState } from './api';

export type Dialog = 'kits' | 'share' | 'project' | 'profiles';

// What the editor is building: the status line, or the mods that run inside Claude Code
export type Product = 'statusline' | 'mods';

// One undo step covers both products
interface Snapshot {
  config: StatusCraftConfig;
  mods: ModsConfig;
}

export interface PreviewOptions {
  scenario: Scenario | 'live';
  width: number;
  terminal: string;
  theme: string;
}

interface EditorState {
  mode: 'loading' | 'connected' | 'demo';
  product: Product;
  server?: ServerState;
  config: StatusCraftConfig;
  savedJson: string;
  mods: ModsConfig;
  savedModsJson: string;
  modsServer?: ModsState;
  profile: string;
  selectedId?: string;
  selectedModId?: string;
  activeLine: number;
  past: Snapshot[];
  future: Snapshot[];
  lastChange?: { key: string; at: number };
  preview: PreviewOptions;
  live?: LiveData;
  dialog?: Dialog;
  toast?: { id: number; text: string; mood: Mood };
  busy: boolean;

  load(): Promise<void>;
  // Edits with the same key within a second merge into one undo step (typing, sliders)
  change(update: (layout: Settings) => Settings, key?: string): void;
  changeConfig(update: (config: StatusCraftConfig) => StatusCraftConfig, key?: string): void;
  changeMods(update: (mods: ModsConfig) => ModsConfig, key?: string): void;
  setProduct(product: Product): void;
  select(id?: string): void;
  selectMod(id?: string): void;
  setActiveLine(line: number): void;
  undo(): void;
  redo(): void;
  setProfile(name: string): void;
  setPreview(patch: Partial<PreviewOptions>): void;
  loadLive(): Promise<void>;
  openDialog(dialog?: Dialog): void;
  showToast(text: string, mood?: Mood): void;
  apply(): Promise<void>;
  applyMods(): Promise<void>;
  refreshMods(): Promise<void>;
  uninstallMods(): Promise<void>;
  saveForProject(which: 'project' | 'local'): Promise<void>;
}

const STORAGE = {
  preview: 'statuscraft.preview',
  demo: 'statuscraft.demo-config',
  demoMods: 'statuscraft.demo-mods',
  welcomed: 'statuscraft.welcomed',
  product: 'statuscraft.product',
};
const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;

function storageGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function storageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); preferences are then not remembered
  }
}

export function hasBeenWelcomed(): boolean {
  return storageGet<boolean>(STORAGE.welcomed) === true;
}

export function markWelcomed(): void {
  storageSet(STORAGE.welcomed, true);
}

const DEFAULT_PREVIEW: PreviewOptions = { scenario: 'busy', width: 110, terminal: 'iterm2', theme: 'default' };

export function selectLayout(state: Pick<EditorState, 'config' | 'profile'>): Settings {
  return state.config.profiles[state.profile] ?? createDefaultSettings();
}

export function selectIsDirty(state: Pick<EditorState, 'config' | 'savedJson'>): boolean {
  return JSON.stringify(state.config) !== state.savedJson;
}

export function selectModsDirty(state: Pick<EditorState, 'mods' | 'savedModsJson'>): boolean {
  return JSON.stringify(state.mods) !== state.savedModsJson;
}

function modsMessage(plugin: ModsState['plugin']): string | undefined {
  if (!plugin.claude.found) return 'I could not find Claude Code on this computer. Install it, then press Apply again.';
  if (!plugin.modsSupported) return `Mods need Claude Code 2.1.287 or newer, and you have ${plugin.claude.version ?? 'an older one'}. Run "claude update", then press Apply again.`;
  return undefined;
}

function keptMessage(backup: string | undefined): string {
  return backup ? ` A backup of your previous file is saved at ${backup}.` : '';
}

function reviewCommands(approvals: CommandApproval[], trust: CommandTrust): CommandApproval[] {
  const pending = approvals.filter((item) => !isCommandTrusted(trust, item));
  if (!pending.length) return [];
  const commands = [...new Set(pending.map((item) => JSON.stringify(item.command)))].join('\n\n');
  const scope = pending.every((item) => item.scope === 'global') ? 'These commands can run in any project.' : 'Approval applies only to this project.';
  return window.confirm(`Allow these shell commands to run on your computer?\n\n${commands}\n\n${scope} They have your user permissions and run outside Claude Code’s tool approval checks. Changed commands require approval again.\n\nOK allows them. Cancel saves your design with unapproved commands disabled.`) ? pending : [];
}

let toastId = 0;

export const useEditor = create<EditorState>()((set, get) => ({
  mode: 'loading',
  product: storageGet<Product>(STORAGE.product) === 'mods' ? 'mods' : 'statusline',
  config: createDefaultConfig(),
  savedJson: JSON.stringify(createDefaultConfig()),
  mods: createDefaultModsConfig(),
  savedModsJson: JSON.stringify(createDefaultModsConfig()),
  profile: 'default',
  activeLine: 0,
  past: [],
  future: [],
  preview: { ...DEFAULT_PREVIEW, ...storageGet<Partial<PreviewOptions>>(STORAGE.preview) },
  busy: false,

  async load() {
    try {
      const server = await api.state();
      set({
        mode: 'connected',
        server,
        config: server.config,
        savedJson: server.configExists && !server.importedFrom ? JSON.stringify(server.config) : '',
        profile: server.config.activeProfile,
      });
      if (server.hasLastInput) void get().loadLive();
      if (server.configError) get().showToast(`Your config file has a problem, so you are seeing the default look: ${server.configError}`, 'worried');
      try {
        const modsServer = await api.mods();
        set({ modsServer, mods: modsServer.mods, savedModsJson: modsServer.exists ? JSON.stringify(modsServer.mods) : '' });
        if (modsServer.error) get().showToast(`Your mods file has a problem, so you are starting fresh: ${modsServer.error}`, 'worried');
      } catch {
        // An older server without mods: the Mods tab still works as a preview
      }
    } catch {
      const saved = parseConfig(storageGet(STORAGE.demo));
      const config = saved.ok ? saved.value : createDefaultConfig();
      const savedMods = parseModsConfig(storageGet(STORAGE.demoMods));
      const mods = savedMods.ok ? savedMods.value : createDefaultModsConfig();
      set({ mode: 'demo', config, savedJson: JSON.stringify(config), mods, savedModsJson: JSON.stringify(mods), profile: config.activeProfile });
    }
  },

  change(update, key) {
    get().changeConfig((config) => {
      const profile = get().profile;
      const layout = config.profiles[profile] ?? createDefaultSettings();
      return { ...config, profiles: { ...config.profiles, [profile]: update(layout) } };
    }, key);
  },

  changeConfig(update, key) {
    const { config, mods, past, lastChange, mode } = get();
    const next = update(config);
    if (next === config) return;
    const now = Date.now();
    const merge = key !== undefined && lastChange?.key === key && now - lastChange.at < COALESCE_MS;
    set({
      config: next,
      past: merge ? past : [...past.slice(-HISTORY_LIMIT + 1), { config, mods }],
      future: [],
      lastChange: key ? { key, at: now } : undefined,
    });
    if (mode === 'demo') storageSet(STORAGE.demo, next);
  },

  changeMods(update, key) {
    const { config, mods, past, lastChange, mode } = get();
    const next = update(mods);
    if (next === mods) return;
    const now = Date.now();
    const merge = key !== undefined && lastChange?.key === key && now - lastChange.at < COALESCE_MS;
    set({
      mods: next,
      past: merge ? past : [...past.slice(-HISTORY_LIMIT + 1), { config, mods }],
      future: [],
      lastChange: key ? { key, at: now } : undefined,
    });
    if (mode === 'demo') storageSet(STORAGE.demoMods, next);
  },

  setProduct(product) {
    set({ product });
    storageSet(STORAGE.product, product);
  },

  select(id) {
    set({ selectedId: id });
  },

  selectMod(id) {
    set({ selectedModId: id });
  },

  setActiveLine(line) {
    set({ activeLine: line });
  },

  undo() {
    const { past, future, config, mods } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    set({ ...previous, past: past.slice(0, -1), future: [{ config, mods }, ...future], lastChange: undefined });
  },

  redo() {
    const { past, future, config, mods } = get();
    const next = future[0];
    if (!next) return;
    set({ ...next, past: [...past, { config, mods }], future: future.slice(1), lastChange: undefined });
  },

  setProfile(name) {
    set({ profile: name, selectedId: undefined, activeLine: 0 });
  },

  setPreview(patch) {
    const preview = { ...get().preview, ...patch };
    set({ preview });
    storageSet(STORAGE.preview, preview);
  },

  async loadLive() {
    try {
      set({ live: await api.live() });
    } catch {
      set({ live: undefined });
    }
  },

  openDialog(dialog) {
    set({ dialog });
  },

  showToast(text, mood = 'happy') {
    const id = ++toastId;
    set({ toast: { id, text, mood } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: undefined });
    }, 5000);
  },

  async apply() {
    const { mode, profile, config } = get();
    if (mode !== 'connected') {
      set({ dialog: 'share' });
      return;
    }
    set({ busy: true });
    try {
      const next = { ...config, activeProfile: profile };
      const server = get().server;
      if (!server) throw new Error('Reload the editor before saving.');
      const approvals = reviewCommands(Object.values(next.profiles).flatMap((layout) => layoutCommandApprovals(layout)), server.commandTrust);
      const saved = await api.saveConfig(next, server.configRevision);
      if (approvals.length) await api.approveCommands(approvals);
      if (!server?.install.ours) await api.install();
      const fresh = await api.state();
      set({ config: next, savedJson: JSON.stringify(next), server: fresh });
      get().showToast(
        (server?.install.ours
          ? 'Saved! Claude Code picks it up on the next update.'
          : 'Done! Your new status line appears after Claude’s next answer.') + keptMessage(saved.backup),
        'happy',
      );
    } catch (error) {
      get().showToast(error instanceof Error ? error.message : String(error), 'worried');
    } finally {
      set({ busy: false });
    }
  },

  async refreshMods() {
    try {
      set({ modsServer: await api.mods() });
    } catch {
      // Keep what we had
    }
  },

  async applyMods() {
    const { mode, mods } = get();
    if (mode !== 'connected') {
      get().showToast('This is the demo. Run "npx statuscraft" on your computer to switch mods on in Claude Code.', 'content');
      return;
    }
    set({ busy: true });
    try {
      const before = get().modsServer;
      if (!before) throw new Error('Reload the editor before saving mods.');
      const approvals = reviewCommands(quickCommands(mods).map((command) => ({ kind: 'quick-command', scope: 'global', command: command.command })), before.commandTrust);
      const saved = await api.saveMods(mods, before.revision);
      if (approvals.length) await api.approveCommands(approvals);
      const kept = keptMessage(saved.backup);
      set({ savedModsJson: JSON.stringify(mods) });
      const current = await api.mods();
      const problem = modsMessage(current.plugin);
      if (problem) {
        set({ modsServer: current });
        get().showToast(`Saved your mods. ${problem}${kept}`, 'worried');
        return;
      }
      const wasInstalled = current.plugin.installed && current.plugin.enabled;
      if (!wasInstalled) await api.installMods();
      const fresh = wasInstalled ? current : await api.mods();
      set({ modsServer: fresh });
      if (fresh.plugin.disabledByHooksSetting) {
        get().showToast('Saved, but "disableAllHooks" is on in your Claude Code settings, so mods stay off.' + kept, 'worried');
      } else if (wasInstalled) {
        get().showToast('Saved! Open Claude Code sessions pick up your mods in a couple of seconds.' + kept, 'happy');
      } else {
        get().showToast('Done! Start a new Claude Code session, or run /reload-plugins, to load your mods.' + kept, 'happy');
      }
    } catch (error) {
      get().showToast(error instanceof Error ? error.message : String(error), 'worried');
    } finally {
      set({ busy: false });
    }
  },

  async uninstallMods() {
    set({ busy: true });
    try {
      const { removed } = await api.uninstallMods();
      await get().refreshMods();
      get().showToast(removed ? 'Removed the StatusCraft mod from Claude Code. Your mods are kept here.' : 'The StatusCraft mod was not installed.', 'content');
    } catch (error) {
      get().showToast(error instanceof Error ? error.message : String(error), 'worried');
    } finally {
      set({ busy: false });
    }
  },

  async saveForProject(which) {
    const layout = selectLayout(get());
    set({ busy: true });
    try {
      const server = get().server;
      if (!server) throw new Error('Reload the editor before saving.');
      const scope = `project:${server.project.dir}`;
      const approvals = reviewCommands(layoutCommandApprovals(layout, scope), server.commandTrust);
      const { file } = await api.saveProject(which, { layout }, which === 'project' ? server.project.projectRevision : server.project.localRevision);
      if (approvals.length) await api.approveCommands(approvals);
      set({ server: await api.state(), dialog: undefined });
      get().showToast(`Saved for this project in ${file}`, 'happy');
    } catch (error) {
      get().showToast(error instanceof Error ? error.message : String(error), 'worried');
    } finally {
      set({ busy: false });
    }
  },
}));

import type { CommandApproval, CommandTrust, GitInfo, ModsConfig, ProjectConfig, StatusCraftConfig, StatusInput } from '@statuscraft/core';

export interface ServerState {
  version: string;
  config: StatusCraftConfig;
  configPath: string;
  configExists: boolean;
  configRevision: string | null;
  commandTrust: CommandTrust;
  configError?: string;
  importedFrom?: string;
  install: {
    configured: boolean;
    ours: boolean;
    command?: string;
    settingsFile: string;
    disabledByHooksSetting: boolean;
    error?: string;
  };
  project: { dir: string; project?: ProjectConfig; local?: ProjectConfig; errors: string[]; projectRevision: string | null; localRevision: string | null };
  hasLastInput: boolean;
}

export interface PluginState {
  claude: { found: boolean; path?: string; version?: string };
  // Claude Code 2.1.287 or newer
  modsSupported: boolean;
  installed: boolean;
  enabled: boolean;
  id?: string;
  source?: 'local' | 'marketplace';
  disabledByHooksSetting: boolean;
  error?: string;
}

export interface ModsState {
  mods: ModsConfig;
  revision: string | null;
  commandTrust: CommandTrust;
  path: string;
  exists: boolean;
  error?: string;
  plugin: PluginState;
}

export interface LiveData {
  input: StatusInput;
  git?: GitInfo;
  home?: string;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-statuscraft': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))) as
    | { ok: true; data: T }
    | { ok: false; error: string };
  if (!payload.ok) throw new Error(payload.error);
  return payload.data;
}

// Without the local server (the hosted page) state() fails and the editor runs in demo mode.
export const api = {
  state: () => call<ServerState>('GET', '/api/state'),
  live: () => call<LiveData>('GET', '/api/live'),
  saveConfig: (config: StatusCraftConfig, expectedRevision: string | null) => call<{ saved: boolean; path: string; backup?: string }>('PUT', '/api/config', { config, expectedRevision }),
  install: () => call<{ installed: boolean; command: string }>('POST', '/api/install'),
  uninstall: () => call<{ restored: boolean; notOurs?: boolean }>('POST', '/api/uninstall'),
  mods: () => call<ModsState>('GET', '/api/mods'),
  saveMods: (mods: ModsConfig, expectedRevision: string | null) => call<{ saved: boolean; path: string; backup?: string }>('PUT', '/api/mods', { mods, expectedRevision }),
  installMods: () => call<{ installed: boolean; id: string; output: string }>('POST', '/api/mods/install'),
  uninstallMods: () => call<{ removed: boolean }>('POST', '/api/mods/uninstall'),
  approveCommands: (approvals: CommandApproval[]) => call<{ approved: boolean }>('POST', '/api/commands/trust', { approvals }),
  saveProject: (which: 'project' | 'local', data: ProjectConfig | null, expectedRevision: string | null) =>
    call<{ file: string }>('PUT', '/api/project', { which, data, expectedRevision }),
};

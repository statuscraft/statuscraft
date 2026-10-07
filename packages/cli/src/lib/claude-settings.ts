import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readJson, removeFile, writeJson, fileExists } from './files';
import { paths } from './paths';

export interface StatusLineSetting {
  type: 'command';
  command: string;
  padding?: number;
  refreshInterval?: number;
}

export interface InstallState {
  readonly configured: boolean;
  readonly ours: boolean;
  readonly command?: string;
  readonly settingsFile: string;
  readonly disabledByHooksSetting: boolean;
  readonly error?: string;
}

const MARKER = 'statuscraft';

function readSettings(): { settings: Record<string, unknown>; error?: string } {
  const { value, error } = readJson(paths.claudeSettingsFile());
  if (error) return { settings: {}, error };
  if (value === undefined) return { settings: {} };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { settings: {}, error: `${paths.claudeSettingsFile()} does not hold a JSON object` };
  }
  return { settings: value as Record<string, unknown> };
}

export function getInstallState(): InstallState {
  const { settings, error } = readSettings();
  const statusLine = settings['statusLine'] as Partial<StatusLineSetting> | undefined;
  const command = typeof statusLine?.command === 'string' ? statusLine.command : undefined;
  return {
    configured: Boolean(command),
    ours: Boolean(command?.includes(MARKER)),
    command,
    settingsFile: paths.claudeSettingsFile(),
    disabledByHooksSetting: settings['disableAllHooks'] === true,
    error,
  };
}

export function install(options: { refreshInterval?: number } = {}): { command: string; settingsFile: string } {
  const { settings, error } = readSettings();
  if (error) throw new Error(`${error}. Fix that file first, then try again.`);

  const previous = settings['statusLine'] as Partial<StatusLineSetting> | undefined;
  if (previous?.command && !previous.command.includes(MARKER)) {
    writeJson(paths.previousStatusLineFile(), previous);
  }

  const command = installRenderer();
  const statusLine: StatusLineSetting = { type: 'command', command, padding: 0 };
  if (options.refreshInterval) statusLine.refreshInterval = options.refreshInterval;

  backupOnce(paths.claudeSettingsFile());
  writeJson(paths.claudeSettingsFile(), { ...settings, statusLine });
  return { command, settingsFile: paths.claudeSettingsFile() };
}

export function uninstall(): { restored: boolean; notOurs?: boolean } {
  const { settings, error } = readSettings();
  if (error) throw new Error(error);
  // The user may have switched to another status line since: that one is not ours to remove
  const current = settings['statusLine'] as Partial<StatusLineSetting> | undefined;
  if (!current?.command?.includes(MARKER)) {
    removeFile(paths.previousStatusLineFile());
    return { restored: false, notOurs: true };
  }
  const previous = readJson(paths.previousStatusLineFile()).value;
  const next = { ...settings };
  if (previous && typeof previous === 'object') {
    next['statusLine'] = previous;
  } else {
    delete next['statusLine'];
  }
  writeJson(paths.claudeSettingsFile(), next);
  removeFile(paths.previousStatusLineFile());
  return { restored: Boolean(previous) };
}

function backupOnce(file: string): void {
  const backup = `${file}.before-statuscraft`;
  if (fileExists(file) && !fileExists(backup)) fs.copyFileSync(file, backup);
}

// The renderer is copied next to the config so the status line survives the npx cache being cleared.
function installRenderer(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'statuscraft-render.mjs');
  const target = paths.renderScript();

  if (fileExists(bundled)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bundled, target);
    return `${quote(nodeBinary())} ${quote(target)}`;
  }

  // Running from source: call the TypeScript entry with Bun
  const source = path.resolve(here, '..', 'render-entry.ts');
  const sourceAlt = path.resolve(here, 'render-entry.ts');
  const entry = fileExists(sourceAlt) ? sourceAlt : source;
  return `${quote(process.execPath)} ${quote(entry)} # statuscraft dev`;
}

// An absolute path keeps the status line working when Claude Code runs with a different PATH.
export function nodeBinary(): string {
  if (process.release?.name === 'node' && !('Bun' in globalThis)) return process.execPath;
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const found = execFileSync(finder, ['node'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/)[0]?.trim();
    if (found) return found;
  } catch {
    // Fall back to the running binary
  }
  return process.execPath;
}

function quote(value: string): string {
  const normalized = process.platform === 'win32' ? value.replace(/\\/g, '/') : value;
  return /[\s"'$`\\]/.test(normalized) ? `"${normalized.replace(/(["\\$`])/g, '\\$1')}"` : normalized;
}

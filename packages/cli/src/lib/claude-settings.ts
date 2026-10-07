import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { backupFile, backupOnce, readJson, removeFile, withFileLock, writeJson, writeText, fileExists } from './files';
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

// Match the renderer we actually install, not a word in an unrelated command/path.
function isOurCommand(command: unknown): boolean {
  if (typeof command !== 'string') return false;
  const suffix = ` ${quote(paths.renderScript())}`;
  if (!command.endsWith(suffix)) return command === devCommand();
  const launcher = command.slice(0, -suffix.length);
  if (!/^(?:[^\s"'`$;&|<>]+|"(?:\\.|[^"\\])*")$/.test(launcher)) return false;
  const binary = launcher.startsWith('"') ? launcher.slice(1, -1).replace(/\\(["\\$`])/g, '$1') : launcher;
  return (path.isAbsolute(binary) || path.win32.isAbsolute(binary)) && /^(node|node\.exe)$/i.test(path.win32.basename(binary));
}

function devCommand(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = path.resolve(here, '..', 'render-entry.ts');
  const sourceAlt = path.resolve(here, 'render-entry.ts');
  const entry = fileExists(sourceAlt) ? sourceAlt : source;
  return `${quote(process.execPath)} ${quote(entry)} # statuscraft dev`;
}

function readSettings(): { settings: Record<string, unknown>; error?: string; raw?: string } {
  const { value, error, raw } = readJson(paths.claudeSettingsFile());
  if (error) return { settings: {}, error };
  if (value === undefined) return { settings: {} };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { settings: {}, error: `${paths.claudeSettingsFile()} does not hold a JSON object` };
  }
  const settings = value as Record<string, unknown>;
  const statusLine = settings['statusLine'];
  if (statusLine !== undefined && statusLine !== null && (typeof statusLine !== 'object' || Array.isArray(statusLine) || (statusLine as Partial<StatusLineSetting>).type !== 'command' || typeof (statusLine as Partial<StatusLineSetting>).command !== 'string')) {
    return { settings: {}, error: `${paths.claudeSettingsFile()} has an invalid statusLine. Fix it before installing or uninstalling.` };
  }
  return { settings, raw };
}

export function getInstallState(): InstallState {
  const { settings, error } = readSettings();
  const statusLine = settings['statusLine'] as Partial<StatusLineSetting> | undefined;
  const command = typeof statusLine?.command === 'string' ? statusLine.command : undefined;
  return {
    configured: Boolean(command),
    ours: isOurCommand(command),
    command,
    settingsFile: paths.claudeSettingsFile(),
    disabledByHooksSetting: settings['disableAllHooks'] === true,
    error,
  };
}

// Run before creating our own configuration or asking Claude's plugin CLI to change
// its settings. A failed read/backup stops setup before either configuration changes.
export function prepareClaudeSettings(): string | undefined {
  return withFileLock(paths.claudeSettingsFile(), () => {
    const { error } = readSettings();
    if (error) throw new Error(`${error}. Fix that file first, then try again.`);
    backupOnce(paths.claudeSettingsFile());
    return backupFile(paths.claudeSettingsFile());
  });
}

export function install(options: { refreshInterval?: number } = {}): { command: string; settingsFile: string; backup?: string } {
  return withFileLock(paths.claudeSettingsFile(), () => {
    const { settings, error, raw } = readSettings();
    if (error) throw new Error(`${error}. Fix that file first, then try again.`);
    backupOnce(paths.claudeSettingsFile());
    // Back up Claude's settings before writing renderer/config files as well.
    const backup = backupFile(paths.claudeSettingsFile());
    const previous = settings['statusLine'];
    if (!isOurCommand((previous as Partial<StatusLineSetting> | undefined)?.command)) {
      withFileLock(paths.previousStatusLineFile(), () => writeJson(paths.previousStatusLineFile(), previous ?? null, { backup: true }));
    } else {
      const saved = readJson(paths.previousStatusLineFile());
      if (saved.error) throw new Error(`Cannot preserve your previous status line: ${saved.error}`);
    }
    const command = installRenderer();
    const statusLine: StatusLineSetting = { type: 'command', command, padding: 0 };
    if (options.refreshInterval) statusLine.refreshInterval = options.refreshInterval;
    writeJson(paths.claudeSettingsFile(), { ...settings, statusLine }, { expected: raw });
    return { command, settingsFile: paths.claudeSettingsFile(), ...(backup ? { backup } : {}) };
  });
}

export function uninstall(): { restored: boolean; notOurs?: boolean; backup?: string } {
  return withFileLock(paths.claudeSettingsFile(), () => {
    const { settings, error, raw } = readSettings();
    if (error) throw new Error(error);
    const current = settings['statusLine'] as Partial<StatusLineSetting> | undefined;
    if (!isOurCommand(current?.command)) {
      // Keep the recovery record too: a temporary switch must not destroy it.
      return { restored: false, notOurs: true };
    }
    const saved = readJson(paths.previousStatusLineFile());
    if (saved.error) throw new Error(`Cannot restore your previous status line: ${saved.error}. Nothing was changed.`);
    const previous = saved.value;
    if (previous !== undefined && previous !== null && (typeof previous !== 'object' || Array.isArray(previous) || (previous as Partial<StatusLineSetting>).type !== 'command' || typeof (previous as Partial<StatusLineSetting>).command !== 'string')) {
      throw new Error(`Invalid previous status line in ${paths.previousStatusLineFile()}. Nothing was changed.`);
    }
    const next = { ...settings };
    if (previous) next['statusLine'] = previous;
    else delete next['statusLine'];
    const result = writeJson(paths.claudeSettingsFile(), next, { expected: raw, backup: true });
    removeFile(paths.previousStatusLineFile());
    return { restored: Boolean(previous), ...result };
  });
}

// The renderer is copied next to the config so the status line survives the npx cache being cleared.
function installRenderer(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'statuscraft-render.mjs');
  const target = paths.renderScript();

  if (fileExists(bundled)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeText(target, fs.readFileSync(bundled, 'utf8'), { backup: true });
    return `${quote(nodeBinary())} ${quote(target)}`;
  }

  return devCommand();
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
  return /[\s"'$`\\;&|<>()]/.test(normalized) ? `"${normalized.replace(/(["\\$`])/g, '\\$1')}"` : normalized;
}

import {
  createDefaultConfig,
  createDefaultModsConfig,
  parseConfig,
  parseModsConfig,
  parseProjectConfig,
  SCHEMA_URL,
  type ModsConfig,
  type ProjectConfig,
  type StatusCraftConfig,
} from '@statuscraft/core';
import { backupFile, ConfigConflictError, fileExists, readJson, readText, removeFile, withFileLock, writeJson } from './files';
import { prepareClaudeSettings } from './claude-settings';
import { paths } from './paths';

export interface LoadedConfig {
  readonly config: StatusCraftConfig;
  readonly path: string;
  readonly exists: boolean;
  readonly importedFrom?: string;
  readonly revision: string | null;
  readonly error?: string;
}

export function loadConfig(): LoadedConfig {
  const file = paths.configFile();
  const { value, error, raw } = readJson(file);
  if (error) return { config: createDefaultConfig(), path: file, exists: true, revision: raw ?? null, error };

  if (value !== undefined) {
    const parsed = parseConfig(value);
    return parsed.ok
      ? { config: parsed.value, path: file, exists: true, revision: raw ?? null }
      : { config: createDefaultConfig(), path: file, exists: true, revision: raw ?? null, error: parsed.error };
  }

  const legacyFile = paths.legacyConfigFile();
  const legacy = readJson(legacyFile);
  if (legacy.error) return { config: createDefaultConfig(), path: file, exists: false, revision: null, error: legacy.error };
  if (legacy.value !== undefined) {
    const parsed = parseConfig(legacy.value);
    if (parsed.ok) return { config: parsed.value, path: file, exists: false, revision: null, importedFrom: legacyFile };
    return { config: createDefaultConfig(), path: file, exists: false, revision: null, error: `${legacyFile}: ${parsed.error}` };
  }

  return { config: createDefaultConfig(), path: file, exists: false, revision: null };
}

export function saveConfig(config: StatusCraftConfig, expected?: string | null): { backup?: string } {
  const checked = parseConfig(config);
  if (!checked.ok) throw new Error(`Refusing to save an invalid config: ${checked.error}`);
  return withFileLock(paths.configFile(), () => {
    if (!fileExists(paths.configFile())) prepareClaudeSettings();
    const current = readText(paths.configFile());
    if (expected !== undefined && current !== (expected ?? undefined)) throw new ConfigConflictError('Your config changed since it was loaded. Reload before saving.');
    // Preserve imported legacy settings before first creating our configuration.
    if (current === undefined && loadConfig().importedFrom) backupFile(paths.legacyConfigFile(), paths.legacyBackupBase());
    return writeJson(paths.configFile(), { $schema: SCHEMA_URL, ...checked.value }, { backup: true, expected: current });
  });
}

export interface LoadedMods {
  readonly mods: ModsConfig;
  readonly revision: string | null;
  readonly path: string;
  readonly exists: boolean;
  readonly error?: string;
}

export function loadMods(): LoadedMods {
  const file = paths.modsFile();
  const { value, error, raw } = readJson(file);
  if (error) return { mods: createDefaultModsConfig(), path: file, revision: raw ?? null, exists: true, error };
  if (value === undefined) return { mods: createDefaultModsConfig(), path: file, revision: raw ?? null, exists: false };
  const parsed = parseModsConfig(value);
  return parsed.ok
    ? { mods: parsed.value, path: file, revision: raw ?? null, exists: true }
    : { mods: createDefaultModsConfig(), path: file, revision: raw ?? null, exists: true, error: `${file}: ${parsed.error}` };
}

export function saveMods(mods: ModsConfig, expected?: string | null): { path: string; backup?: string } {
  const checked = parseModsConfig(mods);
  if (!checked.ok) throw new Error(`Refusing to save invalid mods: ${checked.error}`);
  return withFileLock(paths.modsFile(), () => {
    if (!fileExists(paths.modsFile())) prepareClaudeSettings();
    const current = readText(paths.modsFile());
    if (expected !== undefined && current !== (expected ?? undefined)) throw new ConfigConflictError('Your mods changed since they were loaded. Reload before saving.');
    return { path: paths.modsFile(), ...writeJson(paths.modsFile(), checked.value, { backup: true, expected: current }) };
  });
}

export interface LoadedProject {
  readonly dir: string;
  readonly project?: ProjectConfig;
  readonly local?: ProjectConfig;
  readonly errors: string[];
  readonly projectRevision: string | null;
  readonly localRevision: string | null;
}

export function loadProject(dir: string): LoadedProject {
  const errors: string[] = [];
  const revisions = new Map<string, string | null>();
  const read = (file: string): ProjectConfig | undefined => {
    const { value, error, raw } = readJson(file);
    revisions.set(file, raw ?? null);
    if (error) errors.push(error);
    if (value === undefined) return undefined;
    const parsed = parseProjectConfig(value);
    if (!parsed.ok) {
      errors.push(`${file}: ${parsed.error}`);
      return undefined;
    }
    return parsed.value;
  };
  const project = read(paths.projectFile(dir));
  const local = read(paths.localProjectFile(dir));
  return { dir, project, local, errors, projectRevision: revisions.get(paths.projectFile(dir)) ?? null, localRevision: revisions.get(paths.localProjectFile(dir)) ?? null };
}

export function saveProjectFile(dir: string, which: 'project' | 'local', data: ProjectConfig | null, expected?: string | null): string {
  const file = which === 'project' ? paths.projectFile(dir) : paths.localProjectFile(dir);
  return withFileLock(file, () => {
    const current = readText(file);
    if (expected !== undefined && current !== (expected ?? undefined)) throw new ConfigConflictError('This project config changed since it was loaded. Reload before saving.');
    if (data === null) {
      backupFile(file);
      removeFile(file);
      return file;
    }
    const parsed = parseProjectConfig(data);
    if (!parsed.ok) throw new Error(parsed.error);
    writeJson(file, { $schema: SCHEMA_URL, ...parsed.value }, { backup: true, expected: current });
    return file;
  });
}

export interface SessionData {
  readonly profile?: string;
  readonly turnStartedAt?: number;
  readonly lastTurnMs?: number;
  readonly turns?: number;
  readonly toolCalls?: number;
  readonly activeTool?: string;
}

export function loadSession(sessionId: string | undefined): SessionData | undefined {
  if (!sessionId) return undefined;
  const { value } = readJson(paths.sessionFile(sessionId));
  return typeof value === 'object' && value !== null ? (value as SessionData) : undefined;
}

export function configExists(): boolean {
  return fileExists(paths.configFile());
}

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
import * as fs from 'node:fs';
import { fileExists, readJson, removeFile, writeJson } from './files';
import { paths } from './paths';

export interface LoadedConfig {
  readonly config: StatusCraftConfig;
  readonly path: string;
  readonly exists: boolean;
  readonly importedFrom?: string;
  readonly error?: string;
}

export function loadConfig(): LoadedConfig {
  const file = paths.configFile();
  const { value, error } = readJson(file);
  if (error) return { config: createDefaultConfig(), path: file, exists: true, error };

  if (value !== undefined) {
    const parsed = parseConfig(value);
    return parsed.ok
      ? { config: parsed.value, path: file, exists: true }
      : { config: createDefaultConfig(), path: file, exists: true, error: parsed.error };
  }

  const legacyFile = paths.legacyConfigFile();
  const legacy = readJson(legacyFile);
  if (legacy.value !== undefined) {
    const parsed = parseConfig(legacy.value);
    if (parsed.ok) return { config: parsed.value, path: file, exists: false, importedFrom: legacyFile };
  }

  return { config: createDefaultConfig(), path: file, exists: false };
}

// A file we cannot read is still the user's work: copy it aside before writing over it
function keepBrokenFile(file: string, isValid: (value: unknown) => boolean): string | undefined {
  const { value, error } = readJson(file);
  if (!error && (value === undefined || isValid(value))) return undefined;
  const backup = `${file}.broken-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup);
  return backup;
}

export function saveConfig(config: StatusCraftConfig): { backup?: string } {
  const checked = parseConfig(config);
  if (!checked.ok) throw new Error(`Refusing to save an invalid config: ${checked.error}`);
  const backup = keepBrokenFile(paths.configFile(), (value) => parseConfig(value).ok);
  writeJson(paths.configFile(), { $schema: SCHEMA_URL, ...checked.value });
  return backup ? { backup } : {};
}

export interface LoadedMods {
  readonly mods: ModsConfig;
  readonly path: string;
  readonly exists: boolean;
  readonly error?: string;
}

export function loadMods(): LoadedMods {
  const file = paths.modsFile();
  const { value, error } = readJson(file);
  if (error) return { mods: createDefaultModsConfig(), path: file, exists: true, error };
  if (value === undefined) return { mods: createDefaultModsConfig(), path: file, exists: false };
  const parsed = parseModsConfig(value);
  return parsed.ok
    ? { mods: parsed.value, path: file, exists: true }
    : { mods: createDefaultModsConfig(), path: file, exists: true, error: `${file}: ${parsed.error}` };
}

export function saveMods(mods: ModsConfig): { path: string; backup?: string } {
  const checked = parseModsConfig(mods);
  if (!checked.ok) throw new Error(`Refusing to save invalid mods: ${checked.error}`);
  const backup = keepBrokenFile(paths.modsFile(), (value) => parseModsConfig(value).ok);
  writeJson(paths.modsFile(), checked.value);
  return backup ? { path: paths.modsFile(), backup } : { path: paths.modsFile() };
}

export interface LoadedProject {
  readonly dir: string;
  readonly project?: ProjectConfig;
  readonly local?: ProjectConfig;
  readonly errors: string[];
}

export function loadProject(dir: string): LoadedProject {
  const errors: string[] = [];
  const read = (file: string): ProjectConfig | undefined => {
    const { value, error } = readJson(file);
    if (error) errors.push(error);
    if (value === undefined) return undefined;
    const parsed = parseProjectConfig(value);
    if (!parsed.ok) {
      errors.push(`${file}: ${parsed.error}`);
      return undefined;
    }
    return parsed.value;
  };
  return { dir, project: read(paths.projectFile(dir)), local: read(paths.localProjectFile(dir)), errors };
}

export function saveProjectFile(dir: string, which: 'project' | 'local', data: ProjectConfig | null): string {
  const file = which === 'project' ? paths.projectFile(dir) : paths.localProjectFile(dir);
  if (data === null) {
    removeFile(file);
    return file;
  }
  const parsed = parseProjectConfig(data);
  if (!parsed.ok) throw new Error(parsed.error);
  writeJson(file, { $schema: SCHEMA_URL, ...parsed.value });
  return file;
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

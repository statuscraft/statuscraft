import { CURRENT_SETTINGS_VERSION, type Settings } from '../types/settings';
import { SettingsSchema } from '../types/schemas';
import { migrateConfig } from './migrations';
import {
  ConfigSchema,
  CONFIG_VERSION,
  DEFAULT_PROFILE,
  ProjectConfigSchema,
  SCHEMA_URL,
  type ProjectConfig,
  type StatusCraftConfig,
} from './model';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseLayout(raw: unknown): ParseResult<Settings> {
  const migrated = migrateConfig(structuredClone(raw), CURRENT_SETTINGS_VERSION);
  const result = SettingsSchema.safeParse(migrated);
  return result.success
    ? { ok: true, value: result.data as Settings }
    : { ok: false, error: result.error.issues.map((i) => `${i.path.join('.') || 'layout'}: ${i.message}`).join('; ') };
}

export function parseConfig(raw: unknown): ParseResult<StatusCraftConfig> {
  if (isRecord(raw) && Array.isArray(raw['lines'])) {
    const layout = parseLayout(raw);
    if (!layout.ok) return layout;
    return {
      ok: true,
      value: { $schema: SCHEMA_URL, version: CONFIG_VERSION, activeProfile: DEFAULT_PROFILE, profiles: { [DEFAULT_PROFILE]: layout.value }, rules: [] },
    };
  }

  if (isRecord(raw) && isRecord(raw['profiles'])) {
    const profiles: Record<string, unknown> = {};
    for (const [name, layout] of Object.entries(raw['profiles'])) {
      profiles[name] = migrateConfig(structuredClone(layout), CURRENT_SETTINGS_VERSION);
    }
    raw = { ...raw, profiles };
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`).join('; ') };
  }
  const config = result.data as StatusCraftConfig;
  if (Object.keys(config.profiles).length === 0) return { ok: false, error: 'profiles: at least one profile is required' };
  return { ok: true, value: config };
}

export function parseProjectConfig(raw: unknown): ParseResult<ProjectConfig> {
  if (isRecord(raw) && isRecord(raw['layout'])) {
    raw = { ...raw, layout: migrateConfig(structuredClone(raw['layout']), CURRENT_SETTINGS_VERSION) };
  }
  const result = ProjectConfigSchema.safeParse(raw);
  return result.success
    ? { ok: true, value: result.data as ProjectConfig }
    : { ok: false, error: result.error.issues.map((i) => `${i.path.join('.') || 'project'}: ${i.message}`).join('; ') };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { z } from 'zod';
import { SettingsSchema } from '../types/schemas';
import { createDefaultSettings, type Settings } from '../types/settings';

export const CONFIG_VERSION = 4;
export const DEFAULT_PROFILE = 'default';

// Every field that is set must match. Globs support `*`.
export const RuleMatchSchema = z.object({
  repo: z.string().optional(),
  path: z.string().optional(),
  model: z.string().optional(),
  agent: z.string().optional(),
});

export const RuleSchema = z.object({
  match: RuleMatchSchema,
  profile: z.string(),
});

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(CONFIG_VERSION).default(CONFIG_VERSION),
  activeProfile: z.string().default(DEFAULT_PROFILE),
  profiles: z.record(z.string(), SettingsSchema),
  rules: z.array(RuleSchema).default([]),
});

// .claude/statuscraft.json (shared) or .claude/statuscraft.local.json: a profile name or a full layout.
export const ProjectConfigSchema = z.object({
  $schema: z.string().optional(),
  profile: z.string().optional(),
  layout: SettingsSchema.optional(),
});

export type RuleMatch = z.infer<typeof RuleMatchSchema>;
export type Rule = z.infer<typeof RuleSchema>;

export interface ProjectConfig {
  readonly $schema?: string;
  readonly profile?: string;
  readonly layout?: Settings;
}

export interface StatusCraftConfig {
  readonly $schema?: string;
  readonly version: typeof CONFIG_VERSION;
  readonly activeProfile: string;
  readonly profiles: Readonly<Record<string, Settings>>;
  readonly rules: readonly Rule[];
}

export const SCHEMA_URL = 'https://unpkg.com/statuscraft/schema.json';

export function createDefaultConfig(layout: Settings = createDefaultSettings()): StatusCraftConfig {
  return {
    $schema: SCHEMA_URL,
    version: CONFIG_VERSION,
    activeProfile: DEFAULT_PROFILE,
    profiles: { [DEFAULT_PROFILE]: layout },
    rules: [],
  };
}

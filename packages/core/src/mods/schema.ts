import { z } from 'zod';

// ~/.config/statuscraft/mods.json: the mods you placed in the editor. The StatusCraft
// Claude Code mod reads this file and does what each entry says.
export const MODS_VERSION = 1;

export const ModOptionValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const ModInstanceSchema = z.object({
  id: z.string().min(1),
  // Saved in config files: never rename an existing type
  type: z.string().min(1),
  enabled: z.boolean().default(true),
  options: z.record(z.string(), ModOptionValueSchema).default({}),
});

export const ModsConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(MODS_VERSION).default(MODS_VERSION),
  mods: z.array(ModInstanceSchema).default([]),
});

export type ModOptionValue = z.infer<typeof ModOptionValueSchema>;
export type ModInstance = z.infer<typeof ModInstanceSchema>;
export type ModsConfig = z.infer<typeof ModsConfigSchema>;

export function createDefaultModsConfig(): ModsConfig {
  return { version: MODS_VERSION, mods: [] };
}

export function parseModsConfig(raw: unknown): { ok: true; value: ModsConfig } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: createDefaultModsConfig() };
  const result = ModsConfigSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  return { ok: false, error: issue ? `${issue.path.join('.') || 'mods'}: ${issue.message}` : 'Invalid mods file' };
}

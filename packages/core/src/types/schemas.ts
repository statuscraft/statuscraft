import { z } from 'zod';
import { CURRENT_SETTINGS_VERSION } from './settings';

export const ThresholdSchema = z.object({
  at: z.number(),
  tone: z.enum(['warn', 'danger']),
});

// The widget, powerline and settings fields follow ccstatusline's format
// (MIT, Copyright (c) 2025 Matthew Breedlove): see LICENSE
export const WidgetConfigSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  bold: z.boolean().optional(),
  rawValue: z.boolean().optional(),
  merge: z.union([z.boolean(), z.literal('no-padding')]).optional(),
  thresholds: z.array(ThresholdSchema).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  character: z.string().optional(),
  customText: z.string().optional(),
  commandPath: z.string().max(8192).optional(),
  maxWidth: z.number().optional(),
  timeout: z.number().int().min(100).max(5000).optional(),
  preserveColors: z.boolean().optional(),
});

export const PowerlineConfigSchema = z.object({
  enabled: z.boolean().default(false),
  separators: z.array(z.string()).default(['\uE0B0']),
  separatorInvertBackground: z.array(z.boolean()).default([false]),
  startCaps: z.array(z.string()).default([]),
  endCaps: z.array(z.string()).default([]),
  theme: z.string().optional(),
  autoAlign: z.boolean().default(false),
});

export const SettingsSchema = z.object({
  version: z.number().default(CURRENT_SETTINGS_VERSION),
  lines: z.array(z.array(WidgetConfigSchema).max(100)).min(1).max(3),
  terminalApp: z.string().optional(),
  terminalTheme: z.string().optional(),
  flexMode: z.enum(['full', 'full-minus-40', 'full-until-compact']).default('full-minus-40'),
  compactThreshold: z.number().min(1).max(99).default(60),
  colorLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(2),
  defaultSeparator: z.string().optional(),
  defaultPadding: z.string().optional(),
  inheritSeparatorColors: z.boolean().default(false),
  overrideBackgroundColor: z.string().optional(),
  overrideForegroundColor: z.string().optional(),
  globalBold: z.boolean().default(false),
  powerline: PowerlineConfigSchema.default({}),
});

export type SettingsInput = z.input<typeof SettingsSchema>;
export type SettingsOutput = z.output<typeof SettingsSchema>;

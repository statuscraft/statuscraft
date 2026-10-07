import { SettingsSchema } from '../types/schemas';
import type { Settings } from '../types/settings';
import { parseLayout, type ParseResult } from './load';

// A share code is `sc1.` + base64url(JSON) of a layout, without ids and schema defaults.
const PREFIX = 'sc1.';

const SCHEMA_DEFAULTS = SettingsSchema.parse({ lines: [[]] });

function withoutDefaults(values: object, defaults: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(value) !== JSON.stringify((defaults as Record<string, unknown>)[key])) result[key] = value;
  }
  return result;
}

export function encodeShareCode(layout: Settings): string {
  const { terminalApp: _app, terminalTheme: _theme, ...portable } = layout;
  const compact: Record<string, unknown> = withoutDefaults(portable, SCHEMA_DEFAULTS);
  compact['powerline'] = withoutDefaults(portable.powerline, SCHEMA_DEFAULTS.powerline);
  if (Object.keys(compact['powerline'] as object).length === 0) delete compact['powerline'];
  compact['lines'] = portable.lines.map((line) => line.map(({ id: _id, ...widget }) => widget));
  return PREFIX + toBase64Url(JSON.stringify(compact));
}

export function decodeShareCode(code: string): ParseResult<Settings> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, error: 'Share codes start with "sc1."' };
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)));
  } catch {
    return { ok: false, error: 'This share code is damaged. Copy it again.' };
  }
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { lines?: unknown }).lines)) {
    const withIds = raw as { lines: unknown[][] };
    withIds.lines = withIds.lines.map((line, l) =>
      Array.isArray(line) ? line.map((widget, w) => ({ id: `${l}-${w}`, ...(widget as object) })) : line,
    );
  }
  return parseLayout(raw);
}

export function isShareCode(text: string): boolean {
  return text.trim().startsWith(PREFIX);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

import type { StatusInput } from './types';

export function parseStatusInput(json: string): StatusInput | null {
  try {
    const data: unknown = JSON.parse(json);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null;
    }
    return data as StatusInput;
  } catch {
    return null;
  }
}

export function currentDir(input: StatusInput): string | undefined {
  return input.workspace?.current_dir ?? input.cwd;
}

export function projectDir(input: StatusInput): string | undefined {
  return input.workspace?.project_dir ?? currentDir(input);
}

export function contextWindowSize(input: StatusInput): number {
  return input.context_window?.context_window_size ?? 200_000;
}

export function contextTokens(input: StatusInput): number | undefined {
  const window = input.context_window;
  if (!window) return undefined;
  if (window.total_input_tokens !== undefined) return window.total_input_tokens;
  const usage = window.current_usage;
  if (!usage) return undefined;
  return (usage.input_tokens ?? 0)
    + (usage.cache_creation_input_tokens ?? 0)
    + (usage.cache_read_input_tokens ?? 0);
}

export function contextPercent(input: StatusInput): number | undefined {
  const direct = input.context_window?.used_percentage;
  if (typeof direct === 'number') return direct;
  const tokens = contextTokens(input);
  if (tokens === undefined) return undefined;
  return (tokens / contextWindowSize(input)) * 100;
}

// How close the session is to a wall: the fuller of the context and the 5-hour limit, in percent
export function sessionPressure(input: StatusInput): number | undefined {
  const values = [contextPercent(input), input.rate_limits?.five_hour?.used_percentage].filter(
    (v): v is number => typeof v === 'number',
  );
  return values.length ? Math.max(...values) : undefined;
}

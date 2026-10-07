// The JSON Claude Code sends to a status line command:
// https://code.claude.com/docs/en/statusline#available-data
// Every field is optional; many only appear after the first API response.
export interface StatusInput {
  readonly session_id?: string;
  readonly session_name?: string;
  readonly prompt_id?: string;
  readonly transcript_path?: string;
  readonly cwd?: string;
  readonly version?: string;
  readonly model?: {
    readonly id?: string;
    readonly display_name?: string;
  };
  readonly workspace?: {
    readonly current_dir?: string;
    readonly project_dir?: string;
    readonly added_dirs?: readonly string[];
    readonly git_worktree?: string;
    readonly repo?: {
      readonly host?: string;
      readonly owner?: string;
      readonly name?: string;
    };
  };
  readonly output_style?: { readonly name?: string };
  readonly cost?: {
    readonly total_cost_usd?: number;
    readonly total_duration_ms?: number;
    readonly total_api_duration_ms?: number;
    readonly total_lines_added?: number;
    readonly total_lines_removed?: number;
  };
  readonly context_window?: {
    readonly total_input_tokens?: number;
    readonly total_output_tokens?: number;
    readonly context_window_size?: number;
    readonly used_percentage?: number | null;
    readonly remaining_percentage?: number | null;
    readonly current_usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly cache_creation_input_tokens?: number;
      readonly cache_read_input_tokens?: number;
    } | null;
  };
  readonly exceeds_200k_tokens?: boolean;
  readonly prompt_cache?: {
    readonly warm?: boolean;
    readonly caching_observed?: boolean;
    readonly ttl?: string;
    readonly expires_at?: number | null;
    readonly requests?: number;
    readonly misses?: number;
    readonly hit_ratio?: number | null;
  };
  readonly fast_mode?: boolean;
  readonly effort?: { readonly level?: string };
  readonly thinking?: { readonly enabled?: boolean };
  readonly rate_limits?: {
    readonly five_hour?: RateLimitWindow;
    readonly seven_day?: RateLimitWindow;
    readonly spend_limit?: RateLimitWindow & {
      readonly used_usd?: number;
      readonly limit_usd?: number;
      readonly period?: string;
    };
  };
  readonly vim?: { readonly mode?: string };
  readonly agent?: { readonly name?: string };
  readonly pr?: {
    readonly number?: number;
    readonly url?: string;
    readonly review_state?: string;
    readonly kind?: string;
  };
  readonly worktree?: {
    readonly name?: string;
    readonly path?: string;
    readonly branch?: string;
    readonly original_cwd?: string;
    readonly original_branch?: string;
  };
}

export interface RateLimitWindow {
  readonly used_percentage?: number;
  // Unix epoch seconds
  readonly resets_at?: number;
}

export interface GitInfo {
  readonly branch?: string;
  readonly sha?: string;
  readonly added: number;
  readonly deleted: number;
  readonly changedFiles: number;
  readonly untracked: number;
  readonly ahead: number;
  readonly behind: number;
}

export interface CompanionData {
  readonly turnStartedAt?: number;
  readonly lastTurnMs?: number;
  readonly turns?: number;
  readonly toolCalls?: number;
  readonly activeTool?: string;
}

export interface WidgetContext {
  readonly input: StatusInput;
  readonly git?: GitInfo;
  readonly companion?: CompanionData;
  readonly commands: Readonly<Record<string, string | null>>;
  readonly now: number;
  readonly terminalWidth: number;
  readonly home?: string;
  readonly isPreview: boolean;
}

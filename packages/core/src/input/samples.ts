import type { CompanionData, GitInfo, StatusInput, WidgetContext } from './types';

export const SCENARIOS = ['calm', 'busy', 'danger', 'fresh'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Record<Scenario, { label: string; emoji: string; description: string }> = {
  calm: { label: 'Calm', emoji: '😌', description: 'A relaxed session with plenty of room left' },
  busy: { label: 'Busy', emoji: '🏃', description: 'Halfway through a big task with uncommitted work' },
  danger: { label: 'Danger', emoji: '😱', description: 'Context nearly full and rate limits running out' },
  fresh: { label: 'Fresh', emoji: '🌱', description: 'A brand new session before the first answer' },
};

const HOUR = 3600;

interface ScenarioData {
  readonly input: StatusInput;
  readonly git: GitInfo;
  readonly companion: CompanionData;
}

function base(nowSeconds: number): StatusInput {
  return {
    session_id: '3f2a9c1e-5b7d-4e8a-9c21-6d0f4b8a7e13',
    session_name: 'refactor-auth',
    transcript_path: '/home/you/.claude/projects/my-app/3f2a9c1e.jsonl',
    cwd: '/home/you/code/my-app/src',
    version: '2.1.289',
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: {
      current_dir: '/home/you/code/my-app/src',
      project_dir: '/home/you/code/my-app',
      added_dirs: [],
      repo: { host: 'github.com', owner: 'acme', name: 'my-app' },
    },
    output_style: { name: 'default' },
    effort: { level: 'high' },
    thinking: { enabled: true },
    fast_mode: false,
    vim: { mode: 'INSERT' },
    rate_limits: {
      five_hour: { used_percentage: 12, resets_at: nowSeconds + 4 * HOUR },
      seven_day: { used_percentage: 21, resets_at: nowSeconds + 5 * 24 * HOUR },
    },
  };
}

function scenarioData(scenario: Scenario, now: number): ScenarioData {
  const nowSeconds = Math.floor(now / 1000);
  const common = base(nowSeconds);

  switch (scenario) {
    case 'calm':
      return {
        input: {
          ...common,
          cost: { total_cost_usd: 0.42, total_duration_ms: 18 * 60_000, total_api_duration_ms: 95_000, total_lines_added: 24, total_lines_removed: 6 },
          context_window: {
            total_input_tokens: 36_000, total_output_tokens: 1_800, context_window_size: 200_000,
            used_percentage: 18, remaining_percentage: 82,
            current_usage: { input_tokens: 2_000, output_tokens: 1_800, cache_creation_input_tokens: 4_000, cache_read_input_tokens: 30_000 },
          },
          prompt_cache: { warm: true, caching_observed: true, ttl: '5m', expires_at: nowSeconds + 240, requests: 9, misses: 0, hit_ratio: 0.88 },
        },
        git: { branch: 'main', added: 0, deleted: 0, changedFiles: 0, untracked: 0, ahead: 0, behind: 0 },
        companion: { turns: 4, toolCalls: 11, lastTurnMs: 42_000 },
      };
    case 'busy':
      return {
        input: {
          ...common,
          cost: { total_cost_usd: 3.87, total_duration_ms: 95 * 60_000, total_api_duration_ms: 1_260_000, total_lines_added: 412, total_lines_removed: 97 },
          context_window: {
            total_input_tokens: 112_000, total_output_tokens: 6_400, context_window_size: 200_000,
            used_percentage: 56, remaining_percentage: 44,
            current_usage: { input_tokens: 6_000, output_tokens: 6_400, cache_creation_input_tokens: 9_000, cache_read_input_tokens: 97_000 },
          },
          prompt_cache: { warm: true, caching_observed: true, ttl: '1h', expires_at: nowSeconds + 2_400, requests: 48, misses: 2, hit_ratio: 0.91 },
          rate_limits: {
            five_hour: { used_percentage: 47, resets_at: nowSeconds + 2 * HOUR + 1_200 },
            seven_day: { used_percentage: 38, resets_at: nowSeconds + 3 * 24 * HOUR },
          },
          pr: { number: 1234, url: 'https://github.com/acme/my-app/pull/1234', review_state: 'pending' },
        },
        git: { branch: 'feature/login', added: 128, deleted: 31, changedFiles: 7, untracked: 2, ahead: 3, behind: 0 },
        companion: { turns: 23, toolCalls: 141, lastTurnMs: 214_000, turnStartedAt: now - 75_000, activeTool: 'Bash' },
      };
    case 'danger':
      return {
        input: {
          ...common,
          model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
          effort: { level: 'max' },
          cost: { total_cost_usd: 14.92, total_duration_ms: 4 * 60 * 60_000, total_api_duration_ms: 5_400_000, total_lines_added: 1_877, total_lines_removed: 940 },
          context_window: {
            total_input_tokens: 186_000, total_output_tokens: 12_000, context_window_size: 200_000,
            used_percentage: 93, remaining_percentage: 7,
            current_usage: { input_tokens: 21_000, output_tokens: 12_000, cache_creation_input_tokens: 40_000, cache_read_input_tokens: 125_000 },
          },
          exceeds_200k_tokens: false,
          prompt_cache: { warm: false, caching_observed: true, ttl: '5m', expires_at: null, requests: 160, misses: 14, hit_ratio: 0.61 },
          rate_limits: {
            five_hour: { used_percentage: 94, resets_at: nowSeconds + 1_380 },
            seven_day: { used_percentage: 81, resets_at: nowSeconds + 20 * HOUR },
          },
          pr: { number: 1234, url: 'https://github.com/acme/my-app/pull/1234', review_state: 'changes_requested' },
          worktree: { name: 'hotfix', path: '/home/you/code/my-app/.claude/worktrees/hotfix', branch: 'worktree-hotfix' },
        },
        git: { branch: 'hotfix/payments', added: 640, deleted: 212, changedFiles: 23, untracked: 5, ahead: 9, behind: 4 },
        companion: { turns: 88, toolCalls: 702, lastTurnMs: 610_000, turnStartedAt: now - 412_000, activeTool: 'Edit' },
      };
    case 'fresh':
      return {
        input: {
          ...common,
          session_name: undefined,
          rate_limits: undefined,
          cost: { total_cost_usd: 0, total_duration_ms: 5_000, total_api_duration_ms: 0, total_lines_added: 0, total_lines_removed: 0 },
          context_window: {
            total_input_tokens: 0, total_output_tokens: 0, context_window_size: 200_000,
            used_percentage: null, remaining_percentage: null, current_usage: null,
          },
        },
        git: { branch: 'main', added: 0, deleted: 0, changedFiles: 0, untracked: 0, ahead: 0, behind: 0 },
        companion: { turns: 0, toolCalls: 0 },
      };
  }
}

export function createScenarioContext(
  scenario: Scenario = 'busy',
  options: { now?: number; terminalWidth?: number } = {},
): WidgetContext {
  const now = options.now ?? Date.now();
  const data = scenarioData(scenario, now);
  return {
    input: data.input,
    git: data.git,
    companion: data.companion,
    commands: {},
    now,
    terminalWidth: options.terminalWidth ?? 120,
    home: '/home/you',
    isPreview: true,
  };
}

export function createInputContext(
  input: StatusInput,
  options: { now?: number; terminalWidth?: number; home?: string } = {},
): WidgetContext {
  return {
    input,
    commands: {},
    now: options.now ?? Date.now(),
    terminalWidth: options.terminalWidth ?? 120,
    home: options.home,
    isPreview: true,
  };
}

// What each mod shows, as pure functions of the data. The StatusCraft Claude Code mod calls
// these with live data, and the editor calls them with a preview scenario, so both draw the same.
import { parseAnsiRuns, type TextRun } from '../ansi/runs';
import type { StatusCraftConfig } from '../config/model';
import { contextPercent, sessionPressure } from '../input/parse';
import type { WidgetContext } from '../input/types';
import { faceFor } from '../mascot';
import { renderStatusLines } from '../renderer/render';
import { formatCost, formatCountdown, formatDuration, formatTokens, progressBar } from '../widgets/format';
import { enabledMods, modBoolean, modNumber, modString } from './catalog';
import type { ModInstance, ModsConfig } from './schema';

export interface TurnSummary {
  readonly durationMs: number;
  readonly toolCalls: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

// What the mod remembers while a session runs
export interface ModState {
  readonly turns: number;
  readonly toolCalls: number;
  // Tool calls in the answer being written (or the last one)
  readonly turnToolCalls: number;
  readonly turnStartedAt?: number;
  // The tool running right now, if any
  readonly activeTool?: string;
  readonly lastTurn?: TurnSummary;
  // Context % after each answer, oldest first
  readonly contextHistory: readonly number[];
}

export interface ModContext {
  readonly widgets: WidgetContext;
  readonly state: ModState;
  // Needed by the Live Status Line to find its profile
  readonly config?: StatusCraftConfig;
  readonly columns: number;
}

export const HISTORY_LENGTH = 20;

export function createModState(): ModState {
  return { turns: 0, toolCalls: 0, turnToolCalls: 0, contextHistory: [] };
}

export function pushContextHistory(history: readonly number[], percent: number | undefined): readonly number[] {
  if (percent === undefined) return history;
  return [...history, Math.round(percent)].slice(-HISTORY_LENGTH);
}

// A believable state for the editor preview, from a scenario's companion data
export function previewModState(ctx: WidgetContext): ModState {
  const companion = ctx.companion ?? {};
  const percent = contextPercent(ctx.input) ?? 0;
  const turns = companion.turns ?? 0;
  const steps = Math.min(turns, 12);
  const contextHistory = Array.from({ length: steps }, (_, i) => Math.round((percent * (i + 1)) / steps));
  const usage = ctx.input.context_window?.current_usage;
  return {
    turns,
    toolCalls: companion.toolCalls ?? 0,
    turnToolCalls: Math.min(companion.toolCalls ?? 0, turns > 0 ? 7 : 0),
    turnStartedAt: companion.turnStartedAt,
    activeTool: companion.activeTool,
    lastTurn:
      turns > 0
        ? {
            durationMs: companion.lastTurnMs ?? 0,
            toolCalls: Math.min(companion.toolCalls ?? 0, 7),
            inputTokens: usage ? (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) : undefined,
            outputTokens: usage?.output_tokens ?? undefined,
          }
        : undefined,
    contextHistory,
  };
}

// --- Text helpers -----------------------------------------------------------------------

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function projectName(ctx: WidgetContext): string | undefined {
  const dir = ctx.input.workspace?.project_dir ?? ctx.input.workspace?.current_dir ?? ctx.input.cwd;
  return dir?.split(/[\\/]/).filter(Boolean).pop();
}


export function fillTemplate(text: string, mctx: ModContext): string {
  const ctx = mctx.widgets;
  const percent = contextPercent(ctx.input);
  const limit = ctx.input.rate_limits?.five_hour?.used_percentage;
  const values: Record<string, string | undefined> = {
    model: ctx.input.model?.display_name ?? ctx.input.model?.id,
    context: percent === undefined ? undefined : `${Math.round(percent)}%`,
    branch: ctx.git?.branch ?? ctx.git?.sha ?? ctx.input.worktree?.branch,
    cost: ctx.input.cost?.total_cost_usd === undefined ? undefined : formatCost(ctx.input.cost.total_cost_usd),
    project: projectName(ctx),
    tools: String(mctx.state.toolCalls),
    turns: String(mctx.state.turns),
    limit: limit === undefined ? undefined : `${Math.round(limit)}%`,
  };
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? (values[key] ?? '–') : match));
}

// --- Spinner ----------------------------------------------------------------------------

export function spinnerSuffix(config: ModsConfig, mctx: ModContext): string {
  const parts: string[] = [];
  const { state, widgets } = mctx;
  for (const mod of enabledMods(config, 'spinner')) {
    switch (mod.type) {
      case 'spinner-tools': {
        const n = modString(mod, 'scope') === 'session' ? state.toolCalls : state.turnToolCalls;
        parts.push(`🔧 ${plural(n, 'tool')}`);
        break;
      }
      case 'spinner-active-tool':
        if (state.activeTool) parts.push(`▶ ${state.activeTool}`);
        break;
      case 'spinner-timer':
        if (state.turnStartedAt !== undefined) parts.push(`⏱ ${formatDuration(widgets.now - state.turnStartedAt)}`);
        break;
      case 'spinner-pip':
        parts.push(faceFor(sessionPressure(widgets.input) ?? 0, modString(mod, 'style', 'kaomoji')));
        break;
    }
  }
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

export function spinnerWord(config: ModsConfig, seed: number): string | undefined {
  const mod = enabledMods(config, 'spinner').find((m) => m.type === 'spinner-words');
  if (!mod) return undefined;
  const words = modString(mod, 'words')
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return undefined;
  return words[Math.abs(Math.floor(seed)) % words.length];
}

// --- Under each answer ------------------------------------------------------------------

export function footerText(config: ModsConfig, mctx: ModContext): string | undefined {
  const mod = enabledMods(config, 'footer').find((m) => m.type === 'turn-summary');
  const turn = mctx.state.lastTurn;
  if (!mod || !turn) return undefined;
  const parts: string[] = [];
  if (modBoolean(mod, 'time')) parts.push(`⏱ ${formatDuration(turn.durationMs)}`);
  if (modBoolean(mod, 'tools')) parts.push(`🔧 ${plural(turn.toolCalls, 'tool')}`);
  if (modBoolean(mod, 'tokens') && (turn.inputTokens !== undefined || turn.outputTokens !== undefined)) {
    parts.push(`↑${formatTokens(turn.inputTokens ?? 0)} ↓${formatTokens(turn.outputTokens ?? 0)} tokens`);
  }
  const percent = contextPercent(mctx.widgets.input);
  if (modBoolean(mod, 'context') && percent !== undefined) parts.push(`🧠 ${Math.round(percent)}% context`);
  return parts.length ? parts.join(' · ') : undefined;
}

// --- Prompt hint ------------------------------------------------------------------------

export function hintText(config: ModsConfig, mctx: ModContext): string | undefined {
  const mod = enabledMods(config, 'hint').find((m) => m.type === 'prompt-hint');
  if (!mod) return undefined;
  const text = fillTemplate(modString(mod, 'text'), mctx).trim();
  return text || undefined;
}

// --- Above the prompt -------------------------------------------------------------------

const COLOR_CODES: Record<string, number | undefined> = { default: undefined, gray: 8, red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6 };
const SPARK = '▁▂▃▄▅▆▇█';

function toneCode(percent: number): number {
  if (percent >= 90) return 1;
  if (percent >= 70) return 3;
  return 2;
}

function liveStatusLines(mod: ModInstance, mctx: ModContext): TextRun[][] {
  const config = mctx.config;
  if (!config) return [];
  const wanted = modString(mod, 'profile').trim();
  const layout = config.profiles[wanted] ?? config.profiles[config.activeProfile] ?? Object.values(config.profiles)[0];
  if (!layout) return [];
  return renderStatusLines(layout, mctx.widgets, mctx.columns)
    .map((result) => parseAnsiRuns(result.output))
    .filter((runs) => runs.some((run) => run.text.trim()));
}

function contextMeterLine(mod: ModInstance, mctx: ModContext): TextRun[] {
  const percent = contextPercent(mctx.widgets.input);
  const label = modString(mod, 'label', 'Context');
  const runs: TextRun[] = [];
  if (label) runs.push({ text: `${label} `, dim: true });
  if (percent === undefined) {
    runs.push({ text: 'waiting for the first answer…', dim: true });
    return runs;
  }
  const width = Math.max(8, Math.min(60, Math.round(modNumber(mod, 'width', 24))));
  const tone = `ansi256(${toneCode(percent)})`;
  runs.push({ text: progressBar(percent, width, 'blocks'), fg: tone });
  runs.push({ text: ` ${Math.round(percent)}%`, fg: tone, bold: true });
  const history = mctx.state.contextHistory;
  if (modBoolean(mod, 'sparkline') && history.length > 1) {
    const spark = history.map((v) => SPARK[Math.min(SPARK.length - 1, Math.floor((Math.max(0, Math.min(100, v)) / 100) * SPARK.length))]).join('');
    runs.push({ text: `  ${spark}`, fg: 'ansi256(8)' });
    runs.push({ text: ` last ${plural(history.length, 'answer')}`, dim: true });
  }
  return runs;
}

function bandTextLine(mod: ModInstance, mctx: ModContext): TextRun[] {
  const text = fillTemplate(modString(mod, 'text'), mctx);
  if (!text.trim()) return [];
  const code = COLOR_CODES[modString(mod, 'color', 'default')];
  return [{ text, fg: code === undefined ? undefined : `ansi256(${code})`, bold: modBoolean(mod, 'bold') || undefined }];
}

function hoursText(hours: number): string {
  return formatDuration(Math.max(60_000, hours * 3_600_000)).replace(/ \d+s$/, '');
}

function burnRateLine(mod: ModInstance, mctx: ModContext): TextRun[] {
  const { input, now } = mctx.widgets;
  const runs: TextRun[] = [];
  const cost = input.cost?.total_cost_usd;
  const ms = input.cost?.total_duration_ms;
  if (modBoolean(mod, 'cost') && cost !== undefined && ms !== undefined && ms >= 60_000) {
    runs.push({ text: `💸 ${formatCost(cost / (ms / 3_600_000))}/h` });
  }
  const window = input.rate_limits?.five_hour;
  if (modBoolean(mod, 'limit') && window?.used_percentage !== undefined && window.resets_at) {
    const used = window.used_percentage;
    const untilReset = (window.resets_at * 1000 - now) / 3_600_000;
    const elapsed = Math.max(0.05, 5 - untilReset);
    const runsOutIn = used > 0 ? (100 - used) / (used / elapsed) : Infinity;
    if (runs.length) runs.push({ text: ' · ', dim: true });
    if (runsOutIn < untilReset) runs.push({ text: `⚠ at this pace your 5h limit runs out in ~${hoursText(runsOutIn)}`, fg: 'ansi256(3)', bold: true });
    else runs.push({ text: `🔋 5h limit lasts until it resets in ${formatCountdown(window.resets_at, now)}`, fg: 'ansi256(2)' });
  }
  return runs;
}

function limitBarsLine(mod: ModInstance, mctx: ModContext): TextRun[] {
  const { input, now } = mctx.widgets;
  const width = Math.max(4, Math.min(30, Math.round(modNumber(mod, 'width', 10))));
  const runs: TextRun[] = [];
  for (const [label, window] of [['5h', input.rate_limits?.five_hour], ['7d', input.rate_limits?.seven_day]] as const) {
    if (window?.used_percentage === undefined) continue;
    const tone = `ansi256(${toneCode(window.used_percentage)})`;
    if (runs.length) runs.push({ text: '   ' });
    runs.push({ text: `${label} `, dim: true });
    runs.push({ text: progressBar(window.used_percentage, width, 'blocks'), fg: tone });
    runs.push({ text: ` ${Math.round(window.used_percentage)}%`, fg: tone, bold: true });
    if (window.resets_at) runs.push({ text: ` ↻${formatCountdown(window.resets_at, now)}`, dim: true });
  }
  return runs;
}

export function bandLines(config: ModsConfig, mctx: ModContext): TextRun[][] {
  const lines: TextRun[][] = [];
  for (const mod of enabledMods(config, 'band')) {
    switch (mod.type) {
      case 'burn-rate':
        lines.push(burnRateLine(mod, mctx));
        break;
      case 'limit-bars':
        lines.push(limitBarsLine(mod, mctx));
        break;
      case 'live-statusline':
        lines.push(...liveStatusLines(mod, mctx));
        break;
      case 'context-meter':
        lines.push(contextMeterLine(mod, mctx));
        break;
      case 'band-text':
        lines.push(bandTextLine(mod, mctx));
        break;
    }
  }
  return lines.filter((line) => line.length > 0);
}

// Seconds between redraws of the band, or undefined when nothing in it changes by itself
export function bandRefreshSeconds(config: ModsConfig): number | undefined {
  const live = enabledMods(config, 'band').filter((m) => m.type === 'live-statusline');
  if (!live.length) return undefined;
  return Math.max(1, Math.min(60, Math.min(...live.map((m) => modNumber(m, 'refresh', 1)))));
}

// --- Alerts -----------------------------------------------------------------------------

// Alerts for values that crossed their threshold between two readings
export function alertsCrossed(config: ModsConfig, before: WidgetContext | undefined, after: WidgetContext): string[] {
  const alerts: string[] = [];
  for (const mod of enabledMods(config, 'alert')) {
    const at = modNumber(mod, 'at', 80);
    if (mod.type === 'context-alert') {
      const was = before ? contextPercent(before.input) : undefined;
      const now = contextPercent(after.input);
      if (now !== undefined && now >= at && (was === undefined || was < at)) {
        alerts.push(`🔔 Context is ${Math.round(now)}% full. Run /compact soon to keep going smoothly.`);
      }
    } else if (mod.type === 'limit-alert') {
      const was = before?.input.rate_limits?.five_hour?.used_percentage;
      const window = after.input.rate_limits?.five_hour;
      const now = window?.used_percentage;
      if (now !== undefined && now >= at && (was === undefined || was < at)) {
        const reset = window?.resets_at ? `, resets in ${formatCountdown(window.resets_at, after.now)}` : '';
        alerts.push(`⏳ Your 5-hour limit is at ${Math.round(now)}%${reset}.`);
      }
    }
  }
  return alerts;
}

export function doneAlert(config: ModsConfig, turn: TurnSummary | undefined): string | undefined {
  const mod = enabledMods(config, 'alert').find((m) => m.type === 'done-alert');
  if (!mod || !turn || turn.durationMs < modNumber(mod, 'after', 60) * 1000) return undefined;
  return `✅ Claude finished after ${formatDuration(turn.durationMs)}.`;
}

// --- Tool call rows ---------------------------------------------------------------------

function seconds(ms: number): string {
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : formatDuration(ms);
}

// What the Tool Timer adds to a finished tool call's row, or undefined to leave it alone
export function toolTimerText(config: ModsConfig, durationMs: number | undefined): string | undefined {
  const mod = enabledMods(config, 'tools').find((m) => m.type === 'tool-timer');
  if (!mod || durationMs === undefined || durationMs < modNumber(mod, 'over', 2) * 1000) return undefined;
  return `⏱ ${seconds(durationMs)}`;
}

// --- Safety guards ----------------------------------------------------------------------

// The words of each simple command, read loosely: quotes are dropped so "sh -c 'rm -rf x'" and
// "sudo rm -rf x" are still seen. A guard may ask once too often, but never once too few.
function commandWords(command: string): string[][] {
  return command
    .replace(/["']/g, '')
    .split(/[;&|\n()`]/)
    .map((part) => part.split(/\s+/).filter(Boolean).map((word) => word.replace(/^\\/, '')))
    .filter((words) => words.length > 0);
}

// "/bin/rm" and "rm" are the same program
function isProgram(word: string, name: string): boolean {
  return word.split('/').pop() === name;
}

// A group of short options like -rf or -xdf that includes one of the letters
function hasShortFlag(word: string, letters: RegExp): boolean {
  return /^-[A-Za-z]+$/.test(word) && letters.test(word.slice(1));
}

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);

// The git subcommand, past global options like -C <dir>, and the words after it
function gitCommand(words: readonly string[]): { name: string; args: string[] } | undefined {
  const start = words.findIndex((word) => isProgram(word, 'git'));
  if (start < 0) return undefined;
  for (let i = start + 1; i < words.length; i++) {
    const word = words[i]!;
    if (GIT_OPTIONS_WITH_VALUE.has(word)) i++;
    else if (!word.startsWith('-')) return { name: word, args: words.slice(i + 1) };
  }
  return undefined;
}

function deletesFolder(words: readonly string[]): boolean {
  return words.some(
    (word, i) => isProgram(word, 'rm') && words.slice(i + 1).some((arg) => arg === '--recursive' || hasShortFlag(arg, /[rR]/)),
  );
}

function forcePushes(words: readonly string[]): boolean {
  const git = gitCommand(words);
  return (
    git?.name === 'push' &&
    git.args.some((arg) => arg === '--force' || arg.startsWith('--force-with-lease') || hasShortFlag(arg, /f/) || /^\+./.test(arg))
  );
}

function discardsWork(words: readonly string[]): boolean {
  const git = gitCommand(words);
  if (git?.name === 'reset') return git.args.includes('--hard');
  if (git?.name === 'clean') return git.args.some((arg) => arg === '--force' || hasShortFlag(arg, /f/));
  return false;
}

const GUARD_RULES = [
  { key: 'deletes', test: deletesFolder, reason: 'deletes a folder and everything in it' },
  { key: 'forcePush', test: forcePushes, reason: 'force pushes, which can overwrite work on the remote' },
  { key: 'discard', test: discardsWork, reason: 'throws away uncommitted work' },
] as const;

export interface GuardVerdict {
  readonly decision: 'ask';
  readonly reason: string;
}

export const FILE_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'] as const;

function globToRegExp(glob: string): RegExp {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
  return new RegExp(`^${body}$`, 'i');
}

// Which pattern protects this path: "name" matches a file anywhere, "dir/" a folder anywhere
export function protectedBy(path: string, patterns: string): string | undefined {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  const name = parts[parts.length - 1] ?? '';
  for (const raw of patterns.split(',')) {
    const pattern = raw.trim();
    if (!pattern) continue;
    if (pattern.endsWith('/')) {
      const folder = globToRegExp(pattern.slice(0, -1));
      if (parts.slice(0, -1).some((part) => folder.test(part))) return pattern;
    } else if (globToRegExp(pattern).test(name)) {
      return pattern;
    }
  }
  return undefined;
}

function fileGuard(config: ModsConfig, tool: string, input: Readonly<Record<string, unknown>>): GuardVerdict | undefined {
  if (!(FILE_TOOLS as readonly string[]).includes(tool)) return undefined;
  const path = input['file_path'] ?? input['notebook_path'];
  if (typeof path !== 'string') return undefined;
  for (const mod of enabledMods(config, 'guard')) {
    if (mod.type !== 'protected-files') continue;
    const hit = protectedBy(path, modString(mod, 'files'));
    if (hit) return { decision: 'ask', reason: `🔐 Protected Files: ${path} matches “${hit}”.` };
  }
  return undefined;
}

// Only ever asks: a guard never approves a tool call on your behalf
export function guardCheck(config: ModsConfig, tool: string, input: Readonly<Record<string, unknown>>): GuardVerdict | undefined {
  if (tool !== 'Bash') return fileGuard(config, tool, input);
  if (typeof input['command'] !== 'string') return undefined;
  const command = input['command'];
  const commands = commandWords(command);
  for (const mod of enabledMods(config, 'guard')) {
    if (mod.type !== 'danger-guard') continue;
    for (const rule of GUARD_RULES) {
      if (modBoolean(mod, rule.key) && commands.some(rule.test)) return { decision: 'ask', reason: `🛡️ Danger Guard: this command ${rule.reason}.` };
    }
    const words = modString(mod, 'words')
      .split(',')
      .map((word) => word.trim())
      .filter(Boolean);
    const hit = words.find((word) => command.toLowerCase().includes(word.toLowerCase()));
    if (hit) return { decision: 'ask', reason: `🛡️ Danger Guard: this command contains “${hit}”.` };
  }
  return undefined;
}

// --- Prompt shortcuts -----------------------------------------------------------------

export interface PromptShortcut {
  readonly name: string;
  readonly text: string;
}

export function promptShortcuts(config: ModsConfig): PromptShortcut[] {
  const mod = enabledMods(config, 'prompt').find((m) => m.type === 'prompt-shortcuts');
  if (!mod) return [];
  const seen = new Set<string>();
  const shortcuts: PromptShortcut[] = [];
  for (const entry of modString(mod, 'shortcuts').split('|')) {
    const match = entry.match(/^\s*;?([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/);
    if (!match || seen.has(match[1]!.toLowerCase())) continue;
    seen.add(match[1]!.toLowerCase());
    shortcuts.push({ name: match[1]!, text: match[2]! });
  }
  return shortcuts;
}

// The prompt with every ;name grown into its text, or undefined when nothing matched
export function expandShortcuts(config: ModsConfig, text: string): string | undefined {
  const shortcuts = new Map(promptShortcuts(config).map((s) => [s.name.toLowerCase(), s.text]));
  if (!shortcuts.size) return undefined;
  let changed = false;
  const expanded = text.replace(/(^|\s);([A-Za-z0-9_-]+)(?=$|[\s.,!?:])/g, (match, before: string, name: string) => {
    const replacement = shortcuts.get(name.toLowerCase());
    if (replacement === undefined) return match;
    changed = true;
    return before + replacement;
  });
  return changed ? expanded : undefined;
}

// --- Slash commands ---------------------------------------------------------------------

export interface QuickCommand {
  readonly name: string;
  readonly command: string;
  readonly description: string;
}

export const COMMAND_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export function quickCommands(config: ModsConfig): QuickCommand[] {
  const seen = new Set<string>(['statuscraft']);
  const commands: QuickCommand[] = [];
  for (const mod of enabledMods(config, 'command')) {
    if (mod.type !== 'quick-command') continue;
    const name = modString(mod, 'name').trim().replace(/^\//, '');
    const command = modString(mod, 'command').trim();
    if (!COMMAND_NAME.test(name) || !command || seen.has(name)) continue;
    seen.add(name);
    commands.push({ name, command, description: modString(mod, 'description').trim() || `Runs: ${command}` });
  }
  return commands;
}

// --- Claude Code elements ---------------------------------------------------------------

export interface ModElement {
  readonly type: 'Box' | 'Text';
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly (ModElement | string)[];
}

function runToText(run: TextRun): ModElement {
  const props: Record<string, unknown> = {};
  if (run.fg) props['color'] = run.fg;
  if (run.bg) props['backgroundColor'] = run.bg;
  if (run.bold) props['bold'] = true;
  if (run.dim) props['dimColor'] = true;
  if (run.italic) props['italic'] = true;
  if (run.underline) props['underline'] = true;
  return { type: 'Text', props, children: [run.text] };
}

// One row per line, one Text per run; Claude Code's Text takes colors as props, not escape codes
export function runsToElements(lines: readonly (readonly TextRun[])[]): ModElement {
  return {
    type: 'Box',
    props: { flexDirection: 'column' },
    children: lines.map((runs) => ({
      type: 'Box',
      props: { flexDirection: 'row' },
      children: runs.filter((run) => run.text.length > 0).map(runToText),
    })),
  };
}

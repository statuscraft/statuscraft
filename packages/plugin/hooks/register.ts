/**
 * Companion mod for the StatusCraft status line. The CLI draws the line; this mod adds
 * what a status line command cannot see (turn timer, tool count, per-session profile)
 * and shares it through ~/.cache/statuscraft/sessions/<session id>.json.
 *
 * It also runs the mods you place in the StatusCraft editor, which saves them to
 * ~/.config/statuscraft/mods.json: a band above the prompt, spinner extras, a line under
 * each answer, tool call timings, the prompt hint, pop-up alerts, safety guards, prompt
 * shortcuts and quick /commands. The
 * file is checked every two seconds, so the editor's Apply takes effect in a running session.
 *
 * Claude Code reads every on(...) and $.noun.method(...) from this file's source, so they
 * are spelled out literally, and helpers that take $ are top-level functions.
 */
import type { EngineInterface, Register, RenderNode } from 'claude-code'
import {
  alertsCrossed,
  bandLines,
  bandRefreshSeconds,
  collectNeeds,
  contextPercent,
  createModState,
  doneAlert,
  enabledMods,
  expandShortcuts,
  footerText,
  GIT_DIFF_ARGS,
  GIT_STATUS_ARGS,
  guardCheck,
  hintText,
  CommandTrustSchema,
  isCommandTrusted,
  modString,
  parseConfig,
  parseGitStatus,
  parseModsConfig,
  parseShortstat,
  pushContextHistory,
  quickCommands,
  runsToElements,
  spinnerSuffix,
  spinnerWord,
  toolTimerText,
} from './vendor/core.js'
import { CLI_VERSION } from './vendor/version.js'
import type {
  GitInfo,
  ModContext,
  ModElement,
  ModsConfig,
  ModState,
  QuickCommand,
  StatusCraftConfig,
  StatusInput,
  TextRun,
  WidgetContext,
} from './vendor/core.js'

// --- What the mod keeps ----------------------------------------------------------------

// The companion file the status line reads (keep its shape: the CLI parses it)
interface SessionData {
  profile?: string
  turnStartedAt?: number
  lastTurnMs?: number
  turns: number
  toolCalls: number
  activeTool?: string
}

interface Timer {
  cancel: () => void
}

// What $.session.usage() and session.measure report
interface Usage {
  context?: { tokens?: number; window?: number; percent?: number }
  rateLimits?: readonly { kind: string; percentUsed: number; resetsAt?: string | number }[]
  cost?: { usd: number }
  startedAt?: string | number
}

interface Live {
  usage?: Usage
  model?: string
  cwd?: string
  root?: string
  id?: string
  version?: string
  home?: string
}

interface GitCache {
  at: number
  cwd: string
  full: boolean
  info?: GitInfo
}

type GitNeed = 'none' | 'branch' | 'full'

const EMPTY_MODS: ModsConfig = { version: 1, mods: [] }
const POLL_MS = 2_000
const GIT_CACHE_MS = 10_000
const COMMAND_TIMEOUT_MS = 30_000
const MAX_COMMAND_OUTPUT = 4_000
const MAX_DURATIONS = 500

let data: SessionData = { turns: 0, toolCalls: 0 }
let state: ModState = createModState()
let mods: ModsConfig = EMPTY_MODS
let config: StatusCraftConfig | undefined
// mtimeMs of each file when last read: 0 when missing, -1 before the first look
const stamps = { mods: -1, config: -1, lastInput: -1 }
let live: Live = {}
let lastInput: StatusInput = {}
let gitCache: GitCache | undefined
let alertBaseline: WidgetContext | undefined
let liveSignature = ''
// Bumped whenever anything a drawing reads changes; the band's tree is cached on it
let version = 0
let tick = 0
let bandCache: { key: string; lines: TextRun[][] } | undefined
let pollTimer: Timer | undefined
let refreshTimer: Timer | undefined
let turnTimer: Timer | undefined
let polling = false
const quick = new Map<string, QuickCommand>()
const registered = new Set<string>()
// Main-loop tool calls running now (tool_use_id -> tool), newest last, for the spinner
const running = new Map<string, string>()
// How long each finished tool call took, by tool_use_id, for the Tool Timer
const durations = new Map<string, number>()
// When this module saw the session start: the last resort for the session's duration
let sessionStartedAt: number | undefined

const HELP = [
  'StatusCraft: build your status line from bricks.',
  '',
  '  /statuscraft setup            switch Claude Code over to StatusCraft',
  '  /statuscraft profile          list your profiles',
  '  /statuscraft profile <name>   use a profile in this session only',
  '  /statuscraft profile reset    go back to the usual profile',
  '  /statuscraft doctor           check why something does not show',
  '',
  'To design your status line and mods, run this in a terminal:  npx statuscraft',
].join('\n')

// --- Paths (rules mirror packages/cli/src/lib/paths.ts) --------------------------------

async function homeDir($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? '.'
}

async function cacheDir($: EngineInterface): Promise<string> {
  const override = await $.env.get('STATUSCRAFT_CACHE_DIR')
  if (override) return override
  const xdg = await $.env.get('XDG_CACHE_HOME')
  return `${xdg || `${await homeDir($)}/.cache`}/statuscraft`
}

async function configDir($: EngineInterface): Promise<string> {
  const override = await $.env.get('STATUSCRAFT_CONFIG_DIR')
  if (override) return override
  const xdg = await $.env.get('XDG_CONFIG_HOME')
  return `${xdg || `${await homeDir($)}/.config`}/statuscraft`
}

async function configFile($: EngineInterface): Promise<string> {
  return `${await configDir($)}/config.json`
}

async function modsFile($: EngineInterface): Promise<string> {
  return `${await configDir($)}/mods.json`
}

async function lastInputFile($: EngineInterface): Promise<string> {
  return `${await cacheDir($)}/last-input.json`
}

async function sessionFile($: EngineInterface): Promise<string> {
  const id = (await $.session.id()).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  return `${await cacheDir($)}/sessions/${id}.json`
}

// --- Small helpers ---------------------------------------------------------------------

// A mods API call that may fail (or be withheld by another mod) yields undefined instead
async function attempt<T>(call: Promise<T>): Promise<T | undefined> {
  try {
    return await call
  } catch {
    return undefined
  }
}

async function nowMs($: EngineInterface): Promise<number> {
  try {
    return await $.clock.now()
  } catch {
    return Date.now()
  }
}

async function readJson($: EngineInterface, path: string): Promise<unknown> {
  try {
    return JSON.parse(await $.fs.read(path)) as unknown
  } catch {
    return undefined
  }
}

async function mtime($: EngineInterface, path: string): Promise<number> {
  try {
    const stat = await $.fs.stat(path)
    return stat.kind === 'file' ? stat.mtimeMs || 1 : 0
  } catch {
    return 0
  }
}

function anyMods(): boolean {
  return enabledMods(mods).length > 0
}

// Mods that work from the event alone and need no live figures
const LOCAL_MODS = new Set(['danger-guard', 'protected-files', 'quick-command', 'prompt-shortcuts', 'tool-timer', 'done-alert'])

// Mods that show live figures
function wantsLive(): boolean {
  return enabledMods(mods).some((mod) => !LOCAL_MODS.has(mod.type))
}

function hasMod(type: string): boolean {
  return enabledMods(mods).some((mod) => mod.type === type)
}

function bump(): void {
  version++
}

function activeTool(): string | undefined {
  return [...running.values()].pop()
}

function remember(id: string, ms: number): void {
  durations.delete(id)
  durations.set(id, ms)
  // Oldest first: drop what no row on screen is likely to ask for
  while (durations.size > MAX_DURATIONS) durations.delete(durations.keys().next().value as string)
}

// Drops undefined fields, so a figure the mod lacks never hides the one the status line had
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

function plainText(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
}

function toSeconds(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const ms = typeof value === 'number' ? (value > 1e12 ? value : value * 1000) : Date.parse(value)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined
}

function toMs(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const ms = typeof value === 'number' ? (value > 1e12 ? value : value * 1000) : Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

// --- The companion file (as before) -----------------------------------------------------

async function save($: EngineInterface): Promise<void> {
  try {
    await $.fs.write(await sessionFile($), JSON.stringify(data))
  } catch {
    // The status line shows less; the session is unaffected
  }
}

async function load($: EngineInterface): Promise<void> {
  try {
    const saved = JSON.parse(await $.fs.read(await sessionFile($))) as Partial<SessionData>
    data = { turns: 0, toolCalls: 0, ...saved }
  } catch {
    data = { turns: 0, toolCalls: 0 }
  }
  state = { ...createModState(), turns: data.turns, toolCalls: data.toolCalls }
  alertBaseline = undefined
  bump()
}

async function profileNames($: EngineInterface): Promise<string[]> {
  try {
    const parsed = JSON.parse(await $.fs.read(await configFile($))) as { profiles?: Record<string, unknown> }
    return Object.keys(parsed.profiles ?? {})
  } catch {
    return []
  }
}

async function profileCommand($: EngineInterface, name: string): Promise<string> {
  const names = await profileNames($)
  if (!name) {
    if (names.length === 0) return 'No StatusCraft profiles yet. Run `npx statuscraft` in a terminal to make one.'
    const current = data.profile ? `This session uses "${data.profile}".` : 'This session uses your usual profile.'
    return `${current}\nProfiles: ${names.join(', ')}`
  }
  if (name === 'reset' || name === 'default-profile') {
    data = { ...data, profile: undefined }
    await save($)
    bump()
    $.ui.invalidate('ui.render')
    return 'Back to your usual profile. The status line updates after the next answer.'
  }
  if (!names.includes(name)) return `No profile called "${name}". You have: ${names.join(', ') || 'none yet'}`
  data = { ...data, profile: name }
  await save($)
  bump()
  $.ui.invalidate('ui.render')
  return `This session now uses the "${name}" profile. The status line updates after the next answer.`
}

async function runCli($: EngineInterface, args: string[]): Promise<string> {
  try {
    const result = await $.process.run(['npx', '-y', `statuscraft@${CLI_VERSION}`, ...args], { timeoutMs: 180_000 })
    const text = plainText(result.stdout + result.stderr).trim()
    return result.exitCode === 0 ? text : `StatusCraft exited with code ${result.exitCode}:\n${text}`
  } catch (error) {
    return `Could not run npx (is Node.js installed?): ${error instanceof Error ? error.message : String(error)}`
  }
}

async function statuscraftCommand($: EngineInterface, args: string): Promise<string> {
  const [action = '', ...rest] = args.trim().split(/\s+/)
  switch (action) {
    case 'profile':
    case 'profiles':
      return profileCommand($, rest.join(' '))
    case 'setup':
    case 'init':
      return runCli($, ['init', '--yes'])
    case 'doctor':
      return runCli($, ['doctor'])
    default:
      return HELP
  }
}

async function nudgeIfNotInstalled($: EngineInterface): Promise<void> {
  if (await $.store.get('nudged')) return
  const claudeDir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await homeDir($)}/.claude`
  let settings = ''
  try {
    settings = await $.fs.read(`${claudeDir}/settings.json`)
  } catch {
    // No settings file yet
  }
  if (!settings.includes('statuscraft')) {
    $.ui.toast('StatusCraft is here! Type /statuscraft setup to switch your status line on.')
    await $.store.set('nudged', true)
  }
}

// --- mods.json and config.json ---------------------------------------------------------

// Reads the two files when they changed (or always, with force). Missing or invalid: no mods.
async function loadFiles($: EngineInterface, force = false): Promise<boolean> {
  const [modsPath, configPath] = [await modsFile($), await configFile($)]
  const [modsStamp, configStamp] = [await mtime($, modsPath), await mtime($, configPath)]
  let changed = false

  if (force || modsStamp !== stamps.mods) {
    stamps.mods = modsStamp
    const parsed = modsStamp ? parseModsConfig(await readJson($, modsPath)) : undefined
    mods = parsed?.ok ? parsed.value : EMPTY_MODS
    changed = true
  }
  if (force || configStamp !== stamps.config) {
    stamps.config = configStamp
    try {
      const parsed = configStamp ? parseConfig(await readJson($, configPath)) : undefined
      config = parsed?.ok ? parsed.value : undefined
    } catch {
      config = undefined
    }
    changed = true
  }

  if (changed) {
    bandCache = undefined
    gitCache = undefined
    bump()
    await registerQuickCommands($)
    scheduleRefresh($)
    $.ui.invalidate('ui.render')
    $.ui.invalidate('command.describe')
  }
  return changed
}

// Registering a name again replaces it, so a changed description shows at once. Only names
// Claude Code accepted are answered: a refused one (a built-in's) keeps its own behavior.
async function registerQuickCommands($: EngineInterface): Promise<void> {
  quick.clear()
  for (const command of quickCommands(mods)) {
    try {
      await $.command.register({ name: command.name, description: command.description, immediate: true })
      quick.set(command.name, command)
      registered.add(command.name)
    } catch (error) {
      $.ui.log(`StatusCraft: /${command.name} not added: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
    }
  }
}

// The band's own clock, for a Live Status Line whose clocks and timers tick
function scheduleRefresh($: EngineInterface): void {
  refreshTimer?.cancel()
  refreshTimer = undefined
  const seconds = bandRefreshSeconds(mods)
  if (seconds === undefined) return
  try {
    refreshTimer = $.clock.every(seconds * 1000, () => {
      tick++
      $.ui.invalidate('ui.render')
    })
  } catch {
    // No clock: the band redraws when its data changes
  }
}

function startPolling($: EngineInterface): void {
  pollTimer?.cancel()
  pollTimer = undefined
  try {
    pollTimer = $.clock.every(POLL_MS, () => {
      void pollTick($)
    })
  } catch {
    // No clock: mods.json is read at start, /clear and /resume only
  }
}

async function pollTick($: EngineInterface): Promise<void> {
  if (polling) return
  polling = true
  try {
    await loadFiles($)
    if (wantsLive()) await refreshLive($)
  } catch {
    // Try again at the next tick
  } finally {
    polling = false
  }
}

// --- Live data -------------------------------------------------------------------------

function sessionConfig(): StatusCraftConfig | undefined {
  // /statuscraft profile <name> applies to the band too
  if (config && data.profile && config.profiles[data.profile]) return { ...config, activeProfile: data.profile }
  return config
}

function gitNeed(): GitNeed {
  let need: GitNeed = 'none'
  for (const mod of enabledMods(mods)) {
    if ((mod.type === 'band-text' || mod.type === 'prompt-hint') && modString(mod, 'text').includes('{branch}')) need = 'branch'
    if (mod.type === 'live-statusline') {
      const current = sessionConfig()
      if (!current) continue
      const wanted = modString(mod, 'profile').trim()
      const layout = current.profiles[wanted] ?? current.profiles[current.activeProfile] ?? Object.values(current.profiles)[0]
      if (layout && collectNeeds(layout).needs.has('git')) return 'full'
    }
  }
  return need
}

async function refreshGit($: EngineInterface, cwd: string, need: GitNeed, now: number): Promise<void> {
  const full = need === 'full'
  if (gitCache && gitCache.cwd === cwd && (gitCache.full || !full) && now - gitCache.at < GIT_CACHE_MS) return
  let info: GitInfo | undefined
  try {
    if (full) {
      const status = await $.process.run(['git', ...GIT_STATUS_ARGS], { cwd, timeoutMs: 3_000 })
      if (status.exitCode === 0) {
        const diff = await $.process.run(['git', ...GIT_DIFF_ARGS], { cwd, timeoutMs: 3_000 })
        info = { ...parseGitStatus(status.stdout), ...parseShortstat(diff.exitCode === 0 ? diff.stdout : '') }
      }
    } else {
      const result = await $.process.run(['git', 'branch', '--show-current'], { cwd, timeoutMs: 3_000 })
      const branch = result.exitCode === 0 ? result.stdout.trim() : ''
      // No branch while rebasing or on a tag: name it by its commit instead
      const commit = branch ? undefined : await $.process.run(['git', 'rev-parse', '--short=7', 'HEAD'], { cwd, timeoutMs: 3_000 })
      const sha = commit?.exitCode === 0 ? commit.stdout.trim() : ''
      if (branch || sha) info = { branch: branch || undefined, sha: sha || undefined, added: 0, deleted: 0, changedFiles: 0, untracked: 0, ahead: 0, behind: 0 }
    }
  } catch {
    info = undefined
  }
  gitCache = { at: now, cwd, full, info }
}

// Reads what the band, spinner, hint and alerts show. Never called from a drawing.
async function refreshLive($: EngineInterface): Promise<void> {
  const now = await nowMs($)
  const versionInfo = await attempt($.session.version())
  live = {
    usage: (await attempt($.session.usage())) ?? live.usage,
    model: (await attempt($.session.model())) ?? live.model,
    cwd: (await attempt($.session.cwd())) ?? live.cwd,
    root: (await attempt($.session.root())) ?? live.root,
    id: (await attempt($.session.id())) ?? live.id,
    version: versionInfo?.version ?? live.version,
    home: live.home ?? (await attempt(homeDir($))),
  }

  // What the status line renderer saw last, for fields the mods API does not give
  const inputPath = await lastInputFile($)
  const inputStamp = await mtime($, inputPath)
  if (inputStamp !== stamps.lastInput) {
    stamps.lastInput = inputStamp
    const raw = inputStamp ? await readJson($, inputPath) : undefined
    lastInput = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as StatusInput) : {}
  }

  const need = gitNeed()
  if (need === 'none') gitCache = undefined
  else if (live.cwd) await refreshGit($, live.cwd, need, now)

  const signature = JSON.stringify([live, gitCache?.info, inputStamp])
  if (signature !== liveSignature) {
    liveSignature = signature
    bump()
    $.ui.invalidate('ui.render')
  }
}

function usageInput(usage: Usage | undefined, now: number): Partial<StatusInput> {
  if (!usage) return {}
  const input: { -readonly [K in keyof StatusInput]?: StatusInput[K] } = {}
  const context = usage.context
  if (context?.window) {
    const percent = context.percent ?? (context.tokens !== undefined ? (context.tokens / context.window) * 100 : undefined)
    input.context_window = defined({
      total_input_tokens: context.tokens,
      context_window_size: context.window,
      used_percentage: percent,
      remaining_percentage: percent === undefined ? undefined : Math.max(0, 100 - percent),
    })
  }
  const windows: Record<string, { used_percentage?: number; resets_at?: number }> = {}
  for (const limit of usage.rateLimits ?? []) {
    windows[limit.kind] = defined({ used_percentage: limit.percentUsed, resets_at: toSeconds(limit.resetsAt) })
  }
  if (Object.keys(windows).length) input.rate_limits = windows
  const started = toMs(usage.startedAt)
  input.cost = defined({ total_cost_usd: usage.cost?.usd, total_duration_ms: started === undefined ? undefined : Math.max(0, now - started) })
  return input
}

function buildInput(now: number): StatusInput {
  // The status line's last input only counts when it came from this session
  const base: StatusInput = lastInput.session_id && lastInput.session_id === live.id ? lastInput : {}
  const fromUsage = usageInput(live.usage, now)
  const model =
    live.model === undefined
      ? base.model
      : base.model && (base.model.id === live.model || base.model.display_name === live.model)
        ? base.model
        : { id: live.model, display_name: live.model }
  return {
    ...base,
    ...defined({ session_id: live.id, cwd: live.cwd, version: live.version }),
    model,
    workspace: { ...base.workspace, ...defined({ current_dir: live.cwd, project_dir: live.root }) },
    context_window: { ...base.context_window, ...fromUsage.context_window },
    rate_limits: { ...base.rate_limits, ...fromUsage.rate_limits },
    cost: withDuration({ ...base.cost, ...fromUsage.cost }, now),
  }
}

// Burn Rate needs the session's length: from Claude Code, else the status line, else this module
function withDuration(cost: NonNullable<StatusInput['cost']>, now: number): NonNullable<StatusInput['cost']> {
  if (cost.total_duration_ms !== undefined || sessionStartedAt === undefined) return cost
  return { ...cost, total_duration_ms: Math.max(0, now - sessionStartedAt) }
}

function buildWidgets(now: number, columns: number): WidgetContext {
  return {
    input: buildInput(now),
    git: gitCache?.info,
    companion: {
      turnStartedAt: state.turnStartedAt,
      lastTurnMs: state.lastTurn?.durationMs ?? data.lastTurnMs,
      turns: state.turns,
      toolCalls: state.toolCalls,
      activeTool: data.activeTool,
    },
    commands: {},
    now,
    terminalWidth: columns,
    home: live.home,
    isPreview: false,
  }
}

function modContext(now: number, columns: number): ModContext {
  return { widgets: buildWidgets(now, columns), state: { ...state, activeTool: activeTool() }, config: sessionConfig(), columns }
}

// --- Drawing helpers -------------------------------------------------------------------

type Factory = (props: Record<string, unknown>) => RenderNode

// Core describes the band as plain Box/Text data; Claude Code wants its own constructors
function toNode(node: ModElement | string, Box: Factory, Text: Factory): RenderNode {
  if (typeof node === 'string') return node
  const children = node.children.map((child) => toNode(child, Box, Text))
  return node.type === 'Box' ? Box({ ...node.props, children }) : Text({ ...node.props, children })
}

function bandFor(now: number, columns: number): TextRun[][] {
  const key = `${version}|${tick}|${columns}`
  if (bandCache?.key === key) return bandCache.lines
  let lines: TextRun[][] = []
  try {
    lines = bandLines(mods, modContext(now, columns))
  } catch {
    lines = []
  }
  bandCache = { key, lines }
  return lines
}

// --- Hooks -----------------------------------------------------------------------------

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await load($)
    await nudgeIfNotInstalled($)
    try {
      await $.command.register({
        name: 'statuscraft',
        description: 'StatusCraft status line: setup, profiles, doctor',
        argumentHint: '[setup | profile <name> | doctor]',
        immediate: true,
      })
    } catch {
      // The session goes on without the command
    }
    sessionStartedAt ??= await nowMs($)
    stamps.mods = stamps.config = stamps.lastInput = -1
    await loadFiles($, true)
    if (wantsLive()) await refreshLive($)
    startPolling($)
    return next(e)
  })

  // /clear, /resume and /branch start a new session file without a session.start
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await load($)
    turnTimer?.cancel()
    turnTimer = undefined
    running.clear()
    sessionStartedAt = await nowMs($)
    await loadFiles($, true)
    if (wantsLive()) await refreshLive($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await nowMs($)
    data = { ...data, turnStartedAt: now, activeTool: undefined }
    state = { ...state, turnStartedAt: now, turnToolCalls: 0 }
    await save($)
    if (anyMods()) {
      bump()
      $.ui.invalidate('ui.render')
    }
    turnTimer?.cancel()
    turnTimer = undefined
    // The turn timer next to the spinner ticks once a second
    if (hasMod('spinner-timer')) {
      try {
        turnTimer = $.clock.every(1000, () => {
          bump()
          $.ui.invalidate('ui.render')
        })
      } catch {
        // No clock: the timer moves when something else redraws the spinner
      }
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    data = { ...data, toolCalls: data.toolCalls + 1, activeTool: e.tool }
    state = { ...state, toolCalls: state.toolCalls + 1, turnToolCalls: state.turnToolCalls + 1 }
    await save($)
    if (!anyMods()) return next(e)

    // A subagent's calls run under the main loop's Task call, which the spinner already shows
    const id: string | undefined = e.tool_use_id
    const main = e.agentId === undefined
    if (main && id) running.set(id, e.tool)
    bump()
    $.ui.invalidate('ui.render')
    const started = await nowMs($)
    try {
      return await next(e)
    } finally {
      if (id) {
        remember(id, (await nowMs($)) - started)
        running.delete(id)
      }
      bump()
      $.ui.invalidate('ui.render')
    }
  })

  on('turn.complete', async ($, e, next) => {
    // Subagent turns are not counted
    if (e.agentId !== undefined) return next(e)
    turnTimer?.cancel()
    turnTimer = undefined
    const usage = e.usage
    data = { ...data, turns: data.turns + 1, lastTurnMs: e.durationMs, turnStartedAt: undefined, activeTool: undefined }
    state = {
      ...state,
      turns: state.turns + 1,
      turnStartedAt: undefined,
      lastTurn: {
        durationMs: e.durationMs,
        toolCalls: state.turnToolCalls,
        inputTokens: usage ? (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) : undefined,
        outputTokens: usage?.output_tokens,
      },
    }
    running.clear()
    await save($)
    // An answer you interrupted needs no "done" pop-up
    const done = e.isAborted ? undefined : doneAlert(mods, state.lastTurn)
    if (done) $.ui.toast(done, { timeoutMs: 8_000 })
    const result = await next(e)
    if (!wantsLive()) return result

    await refreshLive($)
    const now = await nowMs($)
    const percent = contextPercent(buildInput(now))
    state = { ...state, contextHistory: pushContextHistory(state.contextHistory, percent) }
    bump()
    $.ui.invalidate('ui.render')

    const footer = footerText(mods, modContext(now, 80))
    if (!footer) return result
    // next(e) resolves to { text: the answer }, and any other text is drawn under the answer as
    // one line. Keep a line another mod already put there, on the same row.
    const theirs = result?.text && result.text.trim() !== e.answer.trim() ? result.text : undefined
    return { ...result, text: theirs ? `${theirs} · ${footer}` : footer }
  })

  // Usage figures, pushed after each turn and when a limit moves: alerts and the band
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    live = { ...live, usage: { ...live.usage, context: e.context, rateLimits: e.rateLimits, cost: e.cost } }
    if (!wantsLive()) return result
    const after = buildWidgets(await nowMs($), 80)
    for (const text of alertsCrossed(mods, alertBaseline, after)) $.ui.toast(text, { timeoutMs: 8_000 })
    alertBaseline = after
    bump()
    $.ui.invalidate('ui.render')
    return result
  })

  // Danger Guard and Protected Files: only ever turn a decision into "ask"; never approve,
  // never lift a deny. The tool names are core's FILE_TOOLS plus Bash, written out for the loader.
  on('tool.check', { tool: ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'] }, async ($, e, next) => {
    const decided = await next(e)
    if (decided?.decision === 'deny' || enabledMods(mods, 'guard').length === 0) return decided
    const input = e.input && typeof e.input === 'object' ? (e.input as Record<string, unknown>) : {}
    const verdict = guardCheck(mods, e.tool, input)
    return verdict ? { decision: 'ask', reason: verdict.reason } : decided
  }).catch(async ($, e, next) => {
    // With a guard placed, a check that failed asks rather than waving the command through
    if (enabledMods(mods, 'guard').length === 0) return undefined
    try {
      const decided = await next(e)
      if (decided?.decision === 'deny') return decided
      return { decision: 'ask', reason: '🛡️ StatusCraft could not check this call against your guards, so it asks first.' }
    } catch {
      // If the underlying permission decision is unavailable, do not guess "allow".
      return { decision: 'deny', reason: '🛡️ StatusCraft could not verify the permission decision. Fix the guard or disable it before retrying.' }
    }
  })

  // Prompt Shortcuts: ;name grows into its prompt when you send it
  on('prompt.submit', async ($, e, next) => {
    if (enabledMods(mods, 'prompt').length === 0) return next(e)
    const expanded = expandShortcuts(mods, e.text)
    return expanded ? next({ ...e, text: expanded }) : next(e)
  })

  on('command.run', async ($, e, next) => {
    if (e.command === 'statuscraft') return { text: await statuscraftCommand($, e.args) }
    const command = quick.get(e.command)
    if (command) {
      const args = e.args.trim() ? e.args.trim().split(/\s+/) : []
      let cwd: string | undefined
      try {
        cwd = await $.session.cwd()
      } catch {
        cwd = undefined
      }
      try {
        // Re-read at execution time: changed/revoked approvals take effect immediately.
        const trust = CommandTrustSchema.safeParse(JSON.parse(await $.fs.read(`${await configDir($)}/trusted-commands.json`)))
        if (!trust.success || !isCommandTrusted(trust.data, { kind: 'quick-command', scope: 'global', command: command.command })) {
          return { text: `/${e.command} is disabled until its shell command is reviewed. Run \`npx statuscraft trust --mods\` in a terminal, or review it in the local editor.` }
        }
        const result = await $.process.run(['sh', '-c', command.command, command.name, ...args], { ...(cwd ? { cwd } : {}), timeoutMs: COMMAND_TIMEOUT_MS })
        let text = plainText(`${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`).trim()
        if (text.length > MAX_COMMAND_OUTPUT) text = `${text.slice(0, MAX_COMMAND_OUTPUT)}\n… (cut at ${MAX_COMMAND_OUTPUT} characters)`
        if (!text) text = '(no output)'
        return { text: result.exitCode === 0 ? text : `${text}\n(exited with code ${result.exitCode})` }
      } catch (error) {
        return { text: `Could not run /${e.command}. Check command approvals with \`npx statuscraft trust --mods\`: ${error instanceof Error ? error.message : String(error)}` }
      }
    }
    if (registered.has(e.command)) return { text: `/${e.command} is no longer in your StatusCraft mods. Run \`npx statuscraft\` to add it back.` }
    return next(e)
  })

  // Quick commands removed in the editor leave the / menu (there is no unregister)
  on('command.describe', async ($, e, next) => {
    const result = await next(e)
    return registered.has(e.command) && !quick.has(e.command) ? { ...result, isHidden: true } : result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props?.hasSurvey || enabledMods(mods, 'band').length === 0) return next(e)
    const columns = e.props?.bodyColumns ?? e.viewport?.columns ?? 80
    const lines = bandFor(await nowMs($), columns)
    if (lines.length === 0) return next(e)
    const maxRows = e.props?.maxRows
    const shown = typeof maxRows === 'number' && maxRows > 0 ? lines.slice(0, maxRows) : lines
    const { Box, Text } = $.ui.resolve(e)
    // Keep what other mods draw in the band, under ours
    const theirs = await next(e)
    return Box({ flexDirection: 'column', children: [toNode(runsToElements(shown), Box, Text), theirs] })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (enabledMods(mods, 'spinner').length === 0) return next(e)
    const mctx = modContext(await nowMs($), e.viewport?.columns ?? 80)
    const suffix = spinnerSuffix(mods, mctx)
    const word = spinnerWord(mods, state.turns)
    if (!suffix && !word) return next(e)
    const props = { ...e.props }
    // Claude Code's own suffix is the ellipsis that says the turn is going: keep it last
    if (suffix) props.suffix = `${suffix}${e.props?.suffix ?? '…'}`
    if (word && !e.props?.message) props.word = word
    return next({ ...e, props })
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    // While you type or Claude works, Claude Code's own hint (esc to interrupt, ...) stays
    if (e.props?.isDraft || e.props?.isWorking || enabledMods(mods, 'hint').length === 0) return next(e)
    const text = hintText(mods, modContext(await nowMs($), e.viewport?.columns ?? 80))
    return text ? next({ ...e, props: { ...e.props, hint: plainText(text) } }) : next(e)
  })

  // Tool Timer: a finished, slow call's row gets its time on the right; running rows are left alone
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props?.isRunning || enabledMods(mods, 'tools').length === 0) return next(e)
    const text = toolTimerText(mods, durations.get(e.props?.tool_use_id ?? e.requestId))
    if (!text) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const theirs = await next(e)
    return Box({ flexDirection: 'row', children: [theirs, Text({ dimColor: true, children: [` ${text}`] })] })
  })
}

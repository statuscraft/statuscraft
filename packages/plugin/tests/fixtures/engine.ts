// Stands in for Claude Code beneath the mod: files, clock, session figures and processes.
import { mock } from 'claude-code/testing'

export const HOME = '/home/you'
export const CONFIG_FILE = `${HOME}/.config/statuscraft/config.json`
export const MODS_FILE = `${HOME}/.config/statuscraft/mods.json`
export const SESSION_FILE = `${HOME}/.cache/statuscraft/sessions/abc-123.json`
export const START = 1_760_000_000_000

export const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const
const VIEWPORT = { columns: 100, rows: 30 }

export const BAND = {
  plugin: 'statuscraft',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: VIEWPORT,
  props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 80, scroll: { offset: 0, bodyRows: 8 }, view: {} },
  surface: 'terminal',
} as const

export const SPINNER = {
  plugin: 'statuscraft',
  component: 'Spinner',
  requestId: 'main',
  viewport: VIEWPORT,
  props: { word: 'Thinking', message: null, suffix: '…', mode: 'responding' },
  surface: 'terminal',
} as const

export const HINT = {
  plugin: 'statuscraft',
  component: 'PromptHint',
  requestId: 'prompt-hint',
  viewport: VIEWPORT,
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  surface: 'terminal',
} as const

// A finished tool call's row in the transcript
export function toolUse(id: string, tool = 'Bash', isRunning = false) {
  return {
    plugin: 'statuscraft',
    component: 'ToolUse',
    requestId: id,
    viewport: VIEWPORT,
    props: { tool_use_id: id, tool, input: { command: 'sleep 5' }, isRunning, isErrored: false, isInterrupted: false, output: isRunning ? undefined : { stdout: '' } },
    surface: 'terminal',
  } as const
}

export interface Usage {
  context?: { tokens?: number; window: number; percent?: number }
  rateLimits?: { kind: string; percentUsed: number; resetsAt?: string }[]
  startedAt?: string
  cost?: { usd: number }
}

export interface EngineOptions {
  files?: Record<string, string>
  usage?: Usage
  model?: string
  // What a process prints, by its argument list
  run?: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr: string }
  // What Claude Code's own permission check decides
  decision?: 'allow' | 'ask' | 'deny'
  checkError?: boolean
  // A line another mod beneath this one puts under the answer
  turnText?: string
  // How long a tool call runs, on the mock clock
  toolMs?: (tool: string) => number
}

export interface Engine {
  files: Map<string, string>
  write(path: string, text: string): void
  clock: ReturnType<typeof mock.clock>
  toasts: string[]
  registered: string[]
  runs: { argv: readonly string[]; init: Record<string, unknown> | undefined }[]
  // The props Claude Code would draw each site with, after the mod's hooks
  drawn: Record<string, Record<string, unknown>>
  calls: Record<string, number>
  // The tool_use_id Claude Code gave each call, in order
  toolIds: string[]
}

// The test kit's own `on`; events here are loosely typed stand-ins for Claude Code's
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type On = (event: string, hook: (...args: any[]) => unknown) => void

export function mods(...entries: { type: string; options?: Record<string, string | number | boolean> }[]): string {
  return JSON.stringify({ version: 1, mods: entries.map((entry, i) => ({ id: `${entry.type}-${i + 1}`, enabled: true, options: {}, ...entry })) })
}

export function stubEngine(on: On, options: EngineOptions = {}): Engine {
  const files = new Map(Object.entries(options.files ?? {}))
  const mtimes = new Map([...files.keys()].map((path) => [path, 1]))
  const calls: Record<string, number> = {}
  const count = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1
  }
  const engine: Engine = {
    files,
    write(path, text) {
      files.set(path, text)
      mtimes.set(path, (mtimes.get(path) ?? 0) + 1)
    },
    clock: mock.clock(on as never, { now: START }),
    toasts: [],
    registered: [],
    runs: [],
    drawn: {},
    calls,
    toolIds: [],
  }

  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('session.id', () => ({ value: 'abc-123' }))
  on('fs.write', ($, e) => {
    engine.write(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', ($, e) => (files.has(e.path) ? { value: files.get(e.path)! } : { deny: 'missing' }))
  on('fs.stat', ($, e) =>
    files.has(e.path) ? { value: { kind: 'file', size: files.get(e.path)!.length, mtimeMs: mtimes.get(e.path) ?? 1, isLink: false } } : { deny: 'missing' },
  )
  on('store.get', () => ({ value: true }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    engine.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => {
    count('ui.invalidate')
    return { value: undefined }
  })
  on('command.register', ($, e) => {
    engine.registered.push(e.name)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  // Like Claude Code: a main-loop answer comes back as the text, which draws nothing extra
  on('turn.complete', ($, e) => ({ text: options.turnText ?? e.answer }))
  on('tool.call', async ($, e) => {
    engine.toolIds.push(e.tool_use_id)
    const ms = options.toolMs?.(e.tool) ?? 0
    if (ms > 0) await engine.clock.sleep(ms)
    return { result: 'ok' }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.check', () => {
    if (options.checkError) throw new Error('permission decision unavailable')
    return { decision: options.decision ?? 'allow', reason: 'settings' }
  })
  on('command.run', ($, e) => ({ text: `Claude Code ran /${e.command}` }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => {
    count('session.usage')
    return { value: options.usage ?? { context: { window: 200_000 }, rateLimits: [] } }
  })
  on('session.model', () => ({ value: options.model ?? 'Opus' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.root', () => ({ value: '/work' }))
  on('session.version', () => ({ value: { version: '2.1.291', base: '2.1.291' } }))
  on('process.run', ($, e) => {
    engine.runs.push({ argv: e.argv, init: e.init })
    return { value: options.run?.(e.argv) ?? { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('ui.render', ($, e) => {
    engine.drawn[e.component] = e.props
    return { type: 'Text', props: {}, children: ['drawn by Claude Code'] }
  })
  return engine
}

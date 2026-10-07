import { expect, test } from 'claude-code/testing'
import { BAND, CONFIG_FILE, HINT, MODS_FILE, SESSION, SPINNER, START, mods, stubEngine } from './fixtures/engine'

const USAGE = {
  context: { tokens: 50_000, window: 200_000, percent: 25 },
  rateLimits: [],
  cost: { usd: 1.5 },
}

test('the band draws the lines of the mods placed above the prompt', async ($, on) => {
  stubEngine(on, {
    usage: USAGE,
    files: {
      [MODS_FILE]: mods(
        { type: 'band-text', options: { text: 'Hello {model} · {cost}', color: 'cyan', bold: true } },
        { type: 'context-meter', options: { label: 'Ctx', width: 10, sparkline: false } },
      ),
    },
  })

  await $.session.start(SESSION)
  const band = await $.ui.mount(BAND)

  const hello = await band.find({ type: 'Text', text: /^Hello Opus · \$1\.50?$/ })
  expect(hello).toBeDefined()
  expect(hello!.props).toMatchObject({ color: 'ansi256(6)', bold: true })
  expect(await band.find({ type: 'Text', text: /25%/ })).toBeDefined()
  // What other mods draw in the band stays, under these lines
  expect(await band.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
})

test('the band steps aside for a survey', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'band-text', options: { text: 'mine' } }) } })
  await $.session.start(SESSION)
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await band.find({ type: 'Text', text: 'mine' })).toBeUndefined()
})

test('a Live Status Line draws a profile from config.json in the band', async ($, on) => {
  stubEngine(on, {
    usage: USAGE,
    model: 'Opus 5.5',
    files: {
      [CONFIG_FILE]: JSON.stringify({ activeProfile: 'default', profiles: { default: { lines: [[{ id: 'm', type: 'model' }]] } } }),
      [MODS_FILE]: mods({ type: 'live-statusline' }),
    },
  })
  await $.session.start(SESSION)
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
})

test('the spinner shows tools, the turn timer and your own word', async ($, on) => {
  const engine = stubEngine(on, {
    files: {
      [MODS_FILE]: mods(
        { type: 'spinner-tools', options: { scope: 'turn' } },
        { type: 'spinner-timer' },
        { type: 'spinner-words', options: { words: 'Stacking, Snapping' } },
      ),
    },
  })

  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: 'a.md' })
  await engine.clock.advance(5_000)

  const spinner = await $.ui.mount(SPINNER)
  expect(engine.drawn['Spinner']).toMatchObject({ word: 'Stacking', suffix: ' · 🔧 2 tools · ⏱ 5s…', mode: 'responding' })
  await spinner.unmount()
})

test('the turn summary adds a line under each answer', async ($, on) => {
  stubEngine(on, { usage: USAGE, files: { [MODS_FILE]: mods({ type: 'turn-summary', options: { context: true } }) } })

  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.tool.call({ tool: 'Read', file_path: 'a.md' })
  const done = await $.turn.complete({
    turnId: 't1',
    answer: 'ok',
    durationMs: 12_000,
    isAborted: false,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1_000, cache_creation_input_tokens: 0, model: 'claude-test' },
  })

  expect(done.text).toBe('⏱ 12s · 🔧 3 tools · ↑1.1k ↓50 tokens · 🧠 25% context')
})

test('a subagent turn adds no summary line', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'turn-summary' }) } })
  await $.session.start(SESSION)
  const done = await $.turn.complete({ turnId: 't9', agentId: 'agent-1', answer: 'ok', durationMs: 500, isAborted: false, usage: null })
  expect(done.text).toBe('ok')
})

test('the turn summary never repeats the answer', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'turn-summary', options: { tokens: false, context: false } }) } })
  await $.session.start(SESSION)
  const done = await $.turn.complete({ turnId: 't1', answer: 'Line one.\n\nLine two with **markdown**.', durationMs: 3_000, isAborted: false, usage: null })
  expect(done.text).toBe('⏱ 3s · 🔧 0 tools')
})

test('the turn summary shares the row with another mod’s line', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'turn-summary', options: { tokens: false, context: false } }) }, turnText: 'other mod line' })
  await $.session.start(SESSION)
  const done = await $.turn.complete({ turnId: 't1', answer: 'Line one.', durationMs: 3_000, isAborted: false, usage: null })
  expect(done.text).toBe('other mod line · ⏱ 3s · 🔧 0 tools')
})

test('the Danger Guard asks before rm -rf and lets ls through', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'danger-guard' }) } })
  await $.session.start(SESSION)

  const risky = await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })
  expect(risky.decision).toBe('ask')
  expect(risky.reason).toContain('Danger Guard')

  const safe = await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  expect(safe.decision).toBe('allow')
})

test('the Danger Guard never lifts a deny', async ($, on) => {
  stubEngine(on, { decision: 'deny', files: { [MODS_FILE]: mods({ type: 'danger-guard' }) } })
  await $.session.start(SESSION)
  const denied = await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })
  expect(denied.decision).toBe('deny')
})

test('a quick command runs its shell command and shows the output', async ($, on) => {
  const engine = stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'quick-command', options: { name: 'hello', command: 'echo hi', description: 'Say hi' } }), '/home/you/.config/statuscraft/trusted-commands.json': JSON.stringify({ version: 1, approvals: [{ kind: 'quick-command', scope: 'global', command: 'echo hi' }] }) },
    run: (argv) => (argv[0] === 'sh' ? { exitCode: 0, stdout: 'hi\n', stderr: '' } : { exitCode: 1, stdout: '', stderr: '' }),
  })

  await $.session.start(SESSION)
  expect(engine.registered).toContain('hello')

  const answer = await $.command.run({ command: 'hello', args: '' })
  expect(answer.text).toBe('hi')
  const run = engine.runs.find((r) => r.argv[0] === 'sh')!
  expect(run.argv.slice(0, 3)).toEqual(['sh', '-c', 'echo hi'])
  expect(run.init).toMatchObject({ cwd: '/work', timeoutMs: 30_000 })

  // Other commands go on to Claude Code
  const other = await $.command.run({ command: 'help', args: '' })
  expect(other.text).toBe('Claude Code ran /help')
})

test('a failing quick command says how it exited', async ($, on) => {
  stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'quick-command', options: { name: 'boom', command: 'false' } }), '/home/you/.config/statuscraft/trusted-commands.json': JSON.stringify({ version: 1, approvals: [{ kind: 'quick-command', scope: 'global', command: 'false' }] }) },
    run: () => ({ exitCode: 2, stdout: '', stderr: 'nope' }),
  })
  await $.session.start(SESSION)
  const answer = await $.command.run({ command: 'boom', args: '' })
  expect(answer.text).toBe('nope\n(exited with code 2)')
})

test('mods saved while the session runs take effect within two seconds', async ($, on) => {
  const engine = stubEngine(on)

  await $.session.start(SESSION)
  expect(engine.registered).toEqual(['statuscraft'])

  engine.write(MODS_FILE, mods({ type: 'quick-command', options: { name: 'gs', command: 'git status --short' } }, { type: 'prompt-hint', options: { text: '🧠 {context}' } }))
  await engine.clock.advance(2_000)
  expect(engine.registered).toContain('gs')

  const hint = await $.ui.mount(HINT)
  expect(engine.drawn['PromptHint']).toMatchObject({ hint: '🧠 –' })
  await hint.unmount()

  // An invalid file is the same as no file: the hint goes back to Claude Code's own
  engine.write(MODS_FILE, '{ not json')
  await engine.clock.advance(2_000)
  const again = await $.ui.mount(HINT)
  expect(engine.drawn['PromptHint']).toEqual(HINT.props)
  await again.unmount()
  const gone = await $.command.run({ command: 'gs', args: '' })
  expect(gone.text).toContain('no longer in your StatusCraft mods')
})

test('the prompt hint leaves Claude Code its hint while you type', async ($, on) => {
  const engine = stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'prompt-hint', options: { text: 'custom' } }) } })
  await $.session.start(SESSION)
  const typing = { ...HINT, props: { ...HINT.props, isDraft: true } }
  const hint = await $.ui.mount(typing)
  expect(engine.drawn['PromptHint']).toEqual(typing.props)
  await hint.unmount()
})

test('alerts pop up once when context and the 5-hour limit cross their mark', async ($, on) => {
  const engine = stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'context-alert', options: { at: 80 } }, { type: 'limit-alert', options: { at: 80 } }) },
  })
  await $.session.start(SESSION)

  const resetsAt = new Date(START + 2 * 3_600_000 + 5 * 60_000).toISOString()
  await $.session.measure({ context: { tokens: 120_000, window: 200_000, percent: 60 }, rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }], changed: ['context', 'rateLimits'] })
  expect(engine.toasts).toEqual([])

  await $.session.measure({ context: { tokens: 170_000, window: 200_000, percent: 85 }, rateLimits: [{ kind: 'five_hour', percentUsed: 90, resetsAt }], changed: ['context', 'rateLimits'] })
  expect(engine.toasts).toEqual(['🔔 Context is 85% full. Run /compact soon to keep going smoothly.', '⏳ Your 5-hour limit is at 90%, resets in 2h05m.'])

  // Still above the mark: no second pop-up
  await $.session.measure({ context: { tokens: 180_000, window: 200_000, percent: 90 }, rateLimits: [{ kind: 'five_hour', percentUsed: 91, resetsAt }], changed: ['context'] })
  expect(engine.toasts.length).toBe(2)
})

test('a Live Status Line redraws on its own clock', async ($, on) => {
  const engine = stubEngine(on, {
    files: {
      [CONFIG_FILE]: JSON.stringify({ profiles: { default: { lines: [[{ id: 'm', type: 'model' }]] } } }),
      [MODS_FILE]: mods({ type: 'live-statusline', options: { refresh: 5 } }),
    },
  })
  await $.session.start(SESSION)
  const before = engine.calls['ui.invalidate'] ?? 0
  await engine.clock.advance(4_000)
  expect(engine.calls['ui.invalidate'] ?? 0).toBe(before)
  await engine.clock.advance(1_000)
  expect(engine.calls['ui.invalidate']).toBe(before + 1)
})

test('{branch} reads the git branch, at most every ten seconds', async ($, on) => {
  const engine = stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'band-text', options: { text: 'on {branch}' } }) },
    run: (argv) => (argv[0] === 'git' ? { exitCode: 0, stdout: 'feature/mods\n', stderr: '' } : { exitCode: 1, stdout: '', stderr: '' }),
  })
  await $.session.start(SESSION)
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: 'on feature/mods' })).toBeDefined()
  expect(engine.runs[0]).toMatchObject({ argv: ['git', 'branch', '--show-current'], init: { cwd: '/work' } })

  // Polls every 2 s, git at most every 10 s
  await engine.clock.advance(8_000)
  expect(engine.runs.length).toBe(1)
  await engine.clock.advance(2_000)
  expect(engine.runs.length).toBe(2)
})


test('quick commands need an exact approval and stop immediately after revocation', async ($, on) => {
  const trustFile = '/home/you/.config/statuscraft/trusted-commands.json'
  const engine = stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'quick-command', options: { name: 'hello', command: 'echo hi' } }) },
    run: () => ({ exitCode: 0, stdout: 'hi', stderr: '' }),
  })
  await $.session.start(SESSION)
  expect((await $.command.run({ command: 'hello', args: '' })).text).toContain('trust --mods')
  expect(engine.runs.filter((r) => r.argv[0] === 'sh')).toHaveLength(0)
  engine.write(trustFile, JSON.stringify({ version: 1, approvals: [{ kind: 'quick-command', scope: 'global', command: 'echo hi' }] }))
  expect((await $.command.run({ command: 'hello', args: '' })).text).toBe('hi')
  engine.write(trustFile, JSON.stringify({ version: 1, approvals: [] }))
  expect((await $.command.run({ command: 'hello', args: '' })).text).toContain('disabled')
  expect(engine.runs.filter((r) => r.argv[0] === 'sh')).toHaveLength(1)
  engine.write(trustFile, '{ broken')
  await $.command.run({ command: 'hello', args: '' })
  expect(engine.runs.filter((r) => r.argv[0] === 'sh')).toHaveLength(1)
})


test('an enabled guard refuses a call if the permission decision fails', async ($, on) => {
  stubEngine(on, { checkError: true, files: { [MODS_FILE]: mods({ type: 'danger-guard' }) } })
  await $.session.start(SESSION)
  const decision = await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  expect(decision.decision).toBe('deny')
})

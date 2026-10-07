import { expect, test } from 'claude-code/testing'
import { BAND, MODS_FILE, SESSION, SPINNER, START, mods, stubEngine, toolUse } from './fixtures/engine'

test('the spinner names the tool running now, and drops it when the tool is done', async ($, on) => {
  const engine = stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'spinner-active-tool' }) }, toolMs: () => 3_000 })
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })

  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await engine.clock.settle()
  const during = await $.ui.mount(SPINNER)
  expect(engine.drawn['Spinner']).toMatchObject({ suffix: ' · ▶ Bash…' })
  await during.unmount()

  await engine.clock.advance(3_000)
  await call
  const after = await $.ui.mount(SPINNER)
  // Nothing to add once no tool runs: Claude Code's own spinner
  expect(engine.drawn['Spinner']).toEqual(SPINNER.props)
  await after.unmount()
})

test('a subagent’s tool calls do not show as the active tool', async ($, on) => {
  const engine = stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'spinner-active-tool' }) }, toolMs: () => 1_000 })
  await $.session.start(SESSION)
  const call = $.tool.call({ tool: 'Read', file_path: 'a.md', agentId: 'agent-1' })
  await engine.clock.settle()
  const spinner = await $.ui.mount(SPINNER)
  expect(engine.drawn['Spinner']).toEqual(SPINNER.props)
  await spinner.unmount()
  await engine.clock.advance(1_000)
  await call
})

test('the Tool Timer puts the time on a slow row and leaves a fast one alone', async ($, on) => {
  const engine = stubEngine(on, {
    files: { [MODS_FILE]: mods({ type: 'tool-timer', options: { over: 2 } }) },
    toolMs: (tool) => (tool === 'Bash' ? 5_300 : 400),
  })
  await $.session.start(SESSION)

  const slow = $.tool.call({ tool: 'Bash', command: 'sleep 5' })
  await engine.clock.advance(5_300)
  await slow
  const fast = $.tool.call({ tool: 'Read', file_path: 'a.md' })
  await engine.clock.advance(400)
  await fast
  const [slowId, fastId] = engine.toolIds

  const slowRow = await $.ui.mount(toolUse(slowId!))
  const time = await slowRow.find({ type: 'Text', text: ' ⏱ 5.3s' })
  expect(time).toBeDefined()
  expect(time!.props).toMatchObject({ dimColor: true })
  // Claude Code's own row stays, beside the time
  expect(await slowRow.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  await slowRow.unmount()

  const fastRow = await $.ui.mount(toolUse(fastId!, 'Read'))
  expect(await fastRow.find({ type: 'Text', text: /⏱/ })).toBeUndefined()
  await fastRow.unmount()

  // A running row is never touched
  const runningRow = await $.ui.mount(toolUse(slowId!, 'Bash', true))
  expect(await runningRow.find({ type: 'Text', text: /⏱/ })).toBeUndefined()
  await runningRow.unmount()
})

test('Protected Files asks before Claude changes .env or .git/config, and lets src/app.ts through', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'protected-files' }) } })
  await $.session.start(SESSION)

  const env = await $.tool.check({ tool: 'Edit', input: { file_path: '/work/.env', old_string: 'a', new_string: 'b' } })
  expect(env.decision).toBe('ask')
  expect(env.reason).toContain('Protected Files')

  const git = await $.tool.check({ tool: 'Write', input: { file_path: '/work/.git/config', content: '' } })
  expect(git.decision).toBe('ask')

  const app = await $.tool.check({ tool: 'Edit', input: { file_path: '/work/src/app.ts', old_string: 'a', new_string: 'b' } })
  expect(app.decision).toBe('allow')
})

test('the Danger Guard still asks next to Protected Files', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'danger-guard' }, { type: 'protected-files' }) } })
  await $.session.start(SESSION)
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push --force origin main' } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git status' } })).decision).toBe('allow')
})

test('Protected Files never lifts a deny', async ($, on) => {
  stubEngine(on, { decision: 'deny', files: { [MODS_FILE]: mods({ type: 'protected-files' }) } })
  await $.session.start(SESSION)
  expect((await $.tool.check({ tool: 'Edit', input: { file_path: '/work/.env' } })).decision).toBe('deny')
})

test('a prompt shortcut grows into its prompt; other text stays as typed', async ($, on) => {
  stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'prompt-shortcuts' }) } })
  await $.session.start(SESSION)

  expect((await $.prompt.submit({ text: ';tests' })).text).toBe('Write tests for what you just changed, then run them')
  expect((await $.prompt.submit({ text: 'please ;review' })).text).toBe('please Review my uncommitted changes and list anything risky')
  expect((await $.prompt.submit({ text: 'a;tests' })).text).toBe('a;tests')
  expect((await $.prompt.submit({ text: ';nope' })).text).toBe(';nope')
})

test('the Done Alert pops up after a long answer, not a short one', async ($, on) => {
  const engine = stubEngine(on, { files: { [MODS_FILE]: mods({ type: 'done-alert', options: { after: 60 } }) } })
  await $.session.start(SESSION)

  await $.turn.complete({ turnId: 't1', answer: 'quick', durationMs: 5_000, isAborted: false, usage: null })
  expect(engine.toasts).toEqual([])

  await $.turn.complete({ turnId: 't2', answer: 'slow', durationMs: 90_000, isAborted: false, usage: null })
  expect(engine.toasts).toEqual(['✅ Claude finished after 1m 30s.'])

  // Not for an answer you interrupted
  await $.turn.complete({ turnId: 't3', answer: 'cut', durationMs: 120_000, isAborted: true, usage: null })
  expect(engine.toasts.length).toBe(1)
})

test('Burn Rate and Limit Bars draw in the band from the usage figures', async ($, on) => {
  stubEngine(on, {
    usage: {
      context: { tokens: 40_000, window: 200_000, percent: 20 },
      cost: { usd: 3 },
      startedAt: new Date(START - 3_600_000).toISOString(),
      rateLimits: [
        { kind: 'five_hour', percentUsed: 40, resetsAt: new Date(START + 2 * 3_600_000).toISOString() },
        { kind: 'seven_day', percentUsed: 10, resetsAt: new Date(START + 3 * 86_400_000).toISOString() },
      ],
    },
    files: { [MODS_FILE]: mods({ type: 'burn-rate' }, { type: 'limit-bars', options: { width: 10 } }) },
  })
  await $.session.start(SESSION)
  const band = await $.ui.mount(BAND)

  expect(await band.find({ type: 'Text', text: '💸 $3.00/h' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: '🔋 5h limit lasts until it resets in 2h00m' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: ' 40%' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: ' ↻2h00m' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: ' 10%' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: ' ↻3d0h' })).toBeDefined()
})

test('Burn Rate falls back to the time since the session started', async ($, on) => {
  const engine = stubEngine(on, {
    usage: { context: { window: 200_000 }, cost: { usd: 1 }, rateLimits: [] },
    files: { [MODS_FILE]: mods({ type: 'burn-rate', options: { limit: false } }) },
  })
  await $.session.start(SESSION)
  await engine.clock.advance(120_000)
  const band = await $.ui.mount(BAND)
  // $1 in two minutes is $30 an hour
  expect(await band.find({ type: 'Text', text: '💸 $30.00/h' })).toBeDefined()
})

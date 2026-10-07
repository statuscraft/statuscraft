import { expect, test } from 'claude-code/testing'
import { BAND, CONFIG_FILE, HINT, SESSION, SESSION_FILE, SPINNER, stubEngine } from './fixtures/engine'

test('counts tool calls into the session file the status line reads', async ($, on) => {
  const engine = stubEngine(on)

  await $.session.start(SESSION)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: 'README.md' })

  const saved = JSON.parse(engine.files.get(SESSION_FILE) ?? '{}')
  expect(saved.toolCalls).toBe(2)
  expect(saved.activeTool).toBe('Read')
})

test('/statuscraft profile picks a profile for this session only', async ($, on) => {
  const engine = stubEngine(on, { files: { [CONFIG_FILE]: JSON.stringify({ profiles: { default: {}, work: {} } }) } })

  await $.session.start(SESSION)
  const answer = await $.command.run({ command: 'statuscraft', args: 'profile work' })

  expect(answer.text).toContain('"work"')
  expect(JSON.parse(engine.files.get(SESSION_FILE)!).profile).toBe('work')

  const unknown = await $.command.run({ command: 'statuscraft', args: 'profile nope' })
  expect(unknown.text).toContain('No profile called "nope"')
})

test('/statuscraft with no arguments explains itself', async ($, on) => {
  stubEngine(on)
  await $.session.start(SESSION)
  const answer = await $.command.run({ command: 'statuscraft', args: '' })
  expect(answer.text).toContain('/statuscraft setup')
})

test('without a mods file the mod changes nothing Claude Code draws or decides', async ($, on) => {
  const engine = stubEngine(on)

  await $.session.start(SESSION)
  expect(engine.registered).toEqual(['statuscraft'])

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  const check = await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })
  expect(check.decision).toBe('allow')

  const done = await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 1000, isAborted: false, usage: null })
  // The answer itself comes back, which draws nothing extra
  expect(done.text).toBe('ok')

  const spinner = await $.ui.mount(SPINNER)
  expect(engine.drawn['Spinner']).toEqual(SPINNER.props)
  await spinner.unmount()

  const hint = await $.ui.mount(HINT)
  expect(engine.drawn['PromptHint']).toEqual(HINT.props)
  await hint.unmount()

  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()

  const other = await $.command.run({ command: 'compact', args: '' })
  expect(other.text).toBe('Claude Code ran /compact')

  // No usage figures are read while no mod needs them
  expect(engine.calls['session.usage'] ?? 0).toBe(0)
})

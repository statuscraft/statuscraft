import { describe, expect, it } from 'vitest';
import { parseAnsiRuns } from '../ansi/runs';
import { createDefaultConfig } from '../config/model';
import { getPreset } from '../config/presets';
import { createScenarioContext } from '../input/samples';
import { canAddMod, enabledMods, getMod, MOD_SLOTS, MODS, newModInstance } from './catalog';
import {
  alertsCrossed,
  bandLines,
  bandRefreshSeconds,
  doneAlert,
  expandShortcuts,
  fillTemplate,
  footerText,
  guardCheck,
  hintText,
  previewModState,
  promptShortcuts,
  protectedBy,
  pushContextHistory,
  quickCommands,
  runsToElements,
  spinnerSuffix,
  spinnerWord,
  toolTimerText,
  type ModContext,
} from './runtime';
import { parseModsConfig, type ModInstance, type ModsConfig } from './schema';

const NOW = 1_800_000_000_000;

function mods(...instances: Partial<ModInstance>[]): ModsConfig {
  return { version: 1, mods: instances.map((m, i) => ({ id: `m${i}`, type: 'band-text', enabled: true, options: {}, ...m })) };
}

function context(scenario: 'calm' | 'busy' | 'danger' | 'fresh' = 'busy'): ModContext {
  const widgets = createScenarioContext(scenario, { now: NOW, terminalWidth: 100 });
  const layout = getPreset('pro')!.layout;
  return { widgets, state: previewModState(widgets), config: createDefaultConfig(layout), columns: 100 };
}

const text = (runs: readonly { text: string }[]) => runs.map((r) => r.text).join('');

describe('catalog', () => {
  it('gives every mod a known slot and unique type', () => {
    const slots = new Set(MOD_SLOTS.map((s) => s.id));
    expect(new Set(MODS.map((m) => m.type)).size).toBe(MODS.length);
    for (const mod of MODS) expect(slots.has(mod.slot)).toBe(true);
  });

  it('allows single mods once and multiple mods many times', () => {
    const config = mods({ type: 'context-meter' }, { type: 'band-text' });
    expect(canAddMod(config, 'context-meter')).toBe(false);
    expect(canAddMod(config, 'band-text')).toBe(true);
    expect(canAddMod(config, 'nope')).toBe(false);
  });

  it('skips switched off and unknown mods', () => {
    const config = mods({ type: 'context-meter', enabled: false }, { type: 'gone' }, { type: 'band-text' });
    expect(enabledMods(config).map((m) => m.type)).toEqual(['band-text']);
  });

  it('gives new quick commands distinct names', () => {
    const first = newModInstance('quick-command');
    const second = newModInstance('quick-command', [first]);
    expect(first.id).not.toBe(second.id);
    expect(second.options['name']).toBe('cmd2');
    const third = newModInstance('quick-command', [first, second]);
    expect(third.options['name']).toBe('cmd3');
    expect(quickCommands(mods(first, second, third)).map((command) => command.name)).toEqual(['gs', 'cmd2', 'cmd3']);
    expect(getMod('quick-command')?.multiple).toBe(true);
  });
});

describe('schema', () => {
  it('fills defaults and rejects bad files', () => {
    expect(parseModsConfig(undefined)).toEqual({ ok: true, value: { version: 1, mods: [] } });
    const parsed = parseModsConfig({ mods: [{ id: 'a', type: 'spinner-timer' }] });
    expect(parsed.ok && parsed.value.mods[0]).toEqual({ id: 'a', type: 'spinner-timer', enabled: true, options: {} });
    expect(parseModsConfig({ version: 2 }).ok).toBe(false);
  });
});

describe('ansi runs', () => {
  it('keeps colors palette-free', () => {
    const runs = parseAnsiRuns('\x1b[31mred\x1b[0m \x1b[1;38;5;208mhot\x1b[0m \x1b[48;2;1;2;3mbg\x1b[0m');
    expect(runs).toEqual([
      { text: 'red', fg: 'ansi256(1)' },
      { text: ' ' },
      { text: 'hot', fg: 'ansi256(208)', bold: true },
      { text: ' ' },
      { text: 'bg', bg: '#010203' },
    ]);
  });
});

describe('runtime', () => {
  it('fills templates and leaves unknown placeholders alone', () => {
    expect(fillTemplate('{branch} {model} {context} {nope}', context())).toBe('feature/login Opus 5.5 56% {nope}');
    expect(fillTemplate('{constructor} {toString}', context())).toBe('{constructor} {toString}');
    const ctx = context();
    const detached = { ...ctx, widgets: { ...ctx.widgets, git: { ...ctx.widgets.git!, branch: undefined, sha: '4f9c2d1' } } };
    expect(fillTemplate('{branch}', detached)).toBe('4f9c2d1');
  });

  it('builds the spinner suffix in placed order', () => {
    const config = mods({ type: 'spinner-tools' }, { type: 'spinner-timer' }, { type: 'spinner-pip', options: { style: 'ascii' } });
    expect(spinnerSuffix(config, context())).toBe(' · 🔧 7 tools · ⏱ 1m 15s · :|');
    expect(spinnerSuffix(mods(), context())).toBe('');
  });

  it('picks a spinner word per turn', () => {
    const config = mods({ type: 'spinner-words', options: { words: 'A, B ,,C' } });
    expect([0, 1, 2, 3].map((seed) => spinnerWord(config, seed))).toEqual(['A', 'B', 'C', 'A']);
    expect(spinnerWord(mods(), 1)).toBeUndefined();
  });

  it('summarizes the last turn', () => {
    expect(footerText(mods({ type: 'turn-summary' }), context())).toBe('⏱ 3m 34s · 🔧 7 tools · ↑112k ↓6.4k tokens');
    expect(footerText(mods({ type: 'turn-summary' }), context('fresh'))).toBeUndefined();
  });

  it('fills the prompt hint', () => {
    expect(hintText(mods({ type: 'prompt-hint' }), context())).toBe('🌿 feature/login · 🧠 56% used');
  });

  it('draws band lines from the status line, the meter and text', () => {
    const config = mods({ type: 'live-statusline' }, { type: 'context-meter', options: { width: 10 } }, { type: 'band-text', options: { text: 'hi {project}', color: 'red' } });
    const lines = bandLines(config, context());
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(text(lines[0]!)).toContain('Opus 5.5');
    const meter = lines[lines.length - 2]!;
    expect(text(meter)).toContain('██████░░░░ 56%');
    expect(meter.find((r) => r.text.includes('█'))?.fg).toBe('ansi256(2)');
    expect(lines[lines.length - 1]).toEqual([{ text: 'hi my-app', fg: 'ansi256(1)', bold: undefined }]);
    expect(bandRefreshSeconds(config)).toBe(1);
    expect(bandRefreshSeconds(mods({ type: 'context-meter' }))).toBeUndefined();
  });

  it('turns runs into Claude Code elements without escape codes', () => {
    const tree = runsToElements([[{ text: 'a', fg: 'ansi256(1)', bold: true }, { text: '' }, { text: 'b', dim: true }]]);
    expect(tree).toEqual({
      type: 'Box',
      props: { flexDirection: 'column' },
      children: [{ type: 'Box', props: { flexDirection: 'row' }, children: [
        { type: 'Text', props: { color: 'ansi256(1)', bold: true }, children: ['a'] },
        { type: 'Text', props: { dimColor: true }, children: ['b'] },
      ] }],
    });
    expect(JSON.stringify(runsToElements(bandLines(mods({ type: 'live-statusline' }), context())))).not.toContain('\\u001b');
  });

  it('alerts once when a threshold is crossed', () => {
    const config = mods({ type: 'context-alert', options: { at: 50 } }, { type: 'limit-alert', options: { at: 90 } });
    const calm = createScenarioContext('calm', { now: NOW });
    const danger = createScenarioContext('danger', { now: NOW });
    expect(alertsCrossed(config, calm, danger)).toEqual([
      '🔔 Context is 93% full. Run /compact soon to keep going smoothly.',
      '⏳ Your 5-hour limit is at 94%, resets in 23m.',
    ]);
    expect(alertsCrossed(config, danger, danger)).toEqual([]);
  });

  it('asks before risky commands and never approves', () => {
    const config = mods({ type: 'danger-guard', options: { words: 'terraform destroy' } });
    expect(guardCheck(config, 'Bash', { command: 'rm -rf build' })?.decision).toBe('ask');
    expect(guardCheck(config, 'Bash', { command: 'cd x && rm -fr .' })?.decision).toBe('ask');
    expect(guardCheck(config, 'Bash', { command: 'git push --force origin main' })?.reason).toContain('force pushes');
    expect(guardCheck(config, 'Bash', { command: 'git push -f' })?.decision).toBe('ask');
    expect(guardCheck(config, 'Bash', { command: 'git reset --hard HEAD~1' })?.reason).toContain('throws away');
    expect(guardCheck(config, 'Bash', { command: 'Terraform Destroy -auto-approve' })?.reason).toContain('terraform destroy');
    for (const risky of [
      'rm --recursive build',
      'rm build -rf',
      '/bin/rm -rf build',
      '\\rm -r build',
      'sudo rm -Rf /opt/app',
      'find . -name dist | xargs rm -r',
      'bash -c "rm -rf build"',
      'git -C . push -f',
      'git push origin +main',
      'git push --force-with-lease=main origin main',
      'git -c core.pager=cat reset --hard',
      'git clean -xdf',
      'echo done; git push -uf origin main',
    ]) {
      expect(guardCheck(config, 'Bash', { command: risky })?.decision, risky).toBe('ask');
    }
    for (const safe of ['grep -r rm src', 'git push --follow-tags origin main', 'git reset HEAD~1', 'git clean -n', 'npm run format']) {
      expect(guardCheck(config, 'Bash', { command: safe }), safe).toBeUndefined();
    }
    expect(guardCheck(config, 'Bash', { command: 'rm notes.txt' })).toBeUndefined();
    expect(guardCheck(config, 'Bash', { command: 'git push origin main' })).toBeUndefined();
    expect(guardCheck(config, 'Read', { file_path: 'rm -rf' })).toBeUndefined();
    expect(guardCheck(mods({ type: 'danger-guard', options: { deletes: false } }), 'Bash', { command: 'rm -rf x' })).toBeUndefined();
  });

  it('lists valid, unique quick commands', () => {
    const config = mods(
      { type: 'quick-command', options: { name: '/gs', command: 'git status' } },
      { type: 'quick-command', options: { name: 'gs', command: 'echo dup' } },
      { type: 'quick-command', options: { name: 'statuscraft', command: 'x' } },
      { type: 'quick-command', options: { name: 'bad name', command: 'x' } },
      { type: 'quick-command', options: { name: 'empty', command: ' ' } },
    );
    expect(quickCommands(config)).toEqual([{ name: 'gs', command: 'git status', description: 'Quick git status' }]);
  });

  it('keeps a short context history', () => {
    let history: readonly number[] = [];
    for (let i = 0; i < 30; i++) history = pushContextHistory(history, i);
    expect(history).toHaveLength(20);
    expect(history[0]).toBe(10);
    expect(pushContextHistory(history, undefined)).toBe(history);
  });
});

describe('more mods', () => {
  it('shows the active tool next to the spinner', () => {
    expect(spinnerSuffix(mods({ type: 'spinner-active-tool' }), context())).toBe(' · ▶ Bash');
    expect(spinnerSuffix(mods({ type: 'spinner-active-tool' }), context('calm'))).toBe('');
  });

  it('forecasts the burn rate and the 5-hour limit', () => {
    const busy = text(bandLines(mods({ type: 'burn-rate' }), context())[0]!);
    expect(busy).toBe('💸 $2.44/h · 🔋 5h limit lasts until it resets in 2h20m');
    const danger = text(bandLines(mods({ type: 'burn-rate' }), context('danger'))[0]!);
    expect(danger).toBe('💸 $3.73/h · ⚠ at this pace your 5h limit runs out in ~17m');
    expect(bandLines(mods({ type: 'burn-rate', options: { cost: false, limit: false } }), context())).toEqual([]);
  });

  it('draws both limit bars', () => {
    const line = bandLines(mods({ type: 'limit-bars', options: { width: 4 } }), context())[0]!;
    expect(text(line)).toBe('5h ██░░ 47% ↻2h20m   7d ██░░ 38% ↻3d0h');
    expect(line.find((r) => r.text.includes('47%'))?.fg).toBe('ansi256(2)');
  });

  it('times only slow tool calls', () => {
    const config = mods({ type: 'tool-timer' });
    expect(toolTimerText(config, 4_200)).toBe('⏱ 4.2s');
    expect(toolTimerText(config, 75_000)).toBe('⏱ 1m 15s');
    expect(toolTimerText(config, 300)).toBeUndefined();
    expect(toolTimerText(config, undefined)).toBeUndefined();
    expect(toolTimerText(mods(), 9_000)).toBeUndefined();
  });

  it('pops up when a long answer is done', () => {
    const config = mods({ type: 'done-alert', options: { after: 60 } });
    expect(doneAlert(config, { durationMs: 90_000, toolCalls: 1 })).toBe('✅ Claude finished after 1m 30s.');
    expect(doneAlert(config, { durationMs: 5_000, toolCalls: 1 })).toBeUndefined();
    expect(doneAlert(config, undefined)).toBeUndefined();
  });

  it('protects secrets, keys, lockfiles and .git', () => {
    const patterns = '.env, .env.*, *.pem, .git/, bun.lock';
    expect(protectedBy('/repo/.env', patterns)).toBe('.env');
    expect(protectedBy('/repo/config/.env.local', patterns)).toBe('.env.*');
    expect(protectedBy('C:\\repo\\certs\\server.PEM', patterns)).toBe('*.pem');
    expect(protectedBy('/repo/.git/config', patterns)).toBe('.git/');
    expect(protectedBy('/repo/src/env.ts', patterns)).toBeUndefined();
    expect(protectedBy('/repo/.github/ci.yml', patterns)).toBeUndefined();
    const config = mods({ type: 'protected-files' });
    expect(guardCheck(config, 'Edit', { file_path: '/repo/.env' })?.reason).toContain('Protected Files');
    expect(guardCheck(config, 'Write', { file_path: '/repo/.git/config' })?.decision).toBe('ask');
    expect(guardCheck(config, 'NotebookEdit', { notebook_path: '/repo/id_rsa' })?.decision).toBe('ask');
    expect(guardCheck(config, 'Edit', { file_path: '/repo/src/app.ts' })).toBeUndefined();
    expect(guardCheck(config, 'Bash', { command: 'cat .env' })).toBeUndefined();
  });

  it('grows prompt shortcuts', () => {
    const config = mods({ type: 'prompt-shortcuts', options: { shortcuts: ';tests = Write tests | review=Review it | ;Tests = dup | junk' } });
    expect(promptShortcuts(config)).toEqual([
      { name: 'tests', text: 'Write tests' },
      { name: 'review', text: 'Review it' },
    ]);
    expect(expandShortcuts(config, ';tests')).toBe('Write tests');
    expect(expandShortcuts(config, 'please ;review, then ;TESTS.')).toBe('please Review it, then Write tests.');
    expect(expandShortcuts(config, 'a;tests')).toBeUndefined();
    expect(expandShortcuts(config, ';nope')).toBeUndefined();
    expect(expandShortcuts(mods(), ';tests')).toBeUndefined();
  });
});

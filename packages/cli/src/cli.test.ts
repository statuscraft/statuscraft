import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScenarioContext, getPreset, parseGitStatus, parseShortstat, stripAnsi } from '@statuscraft/core';
import {
  compareVersions,
  copyPluginFiles,
  findClaude,
  installPlugin,
  LOCAL_PLUGIN_ID,
  marketplaceManifest,
  pluginState,
  setClaudeRunner,
  uninstallPlugin,
} from './lib/claude-plugins';
import { getInstallState, install, uninstall } from './lib/claude-settings';
import { loadConfig, loadMods, loadProject, saveConfig, saveMods, saveProjectFile } from './lib/config-store';
import { paths } from './lib/paths';
import { renderFromStdin } from './commands/render';
import { applyCommand, initCommand, withActiveLayout } from './commands/setup';
import { profileCommand } from './commands/profiles';
import { runCommands } from './providers/commands';
import { getGitInfo } from './providers/git';
import { createServer } from './server';

let sandbox: string;
const saved = { ...process.env };

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'statuscraft-test-'));
  process.env['STATUSCRAFT_CONFIG_DIR'] = path.join(sandbox, 'config');
  process.env['STATUSCRAFT_CACHE_DIR'] = path.join(sandbox, 'cache');
  process.env['CLAUDE_CONFIG_DIR'] = path.join(sandbox, 'claude');
  process.env['XDG_CONFIG_HOME'] = path.join(sandbox, 'xdg');
  // Never reach the real Claude Code from tests
  process.env['STATUSCRAFT_CLAUDE_BIN'] = path.join(sandbox, 'no-claude');
  delete process.env['STATUSCRAFT_PROFILE'];
  vi.spyOn(paths, 'legacyConfigFile').mockReturnValue(path.join(sandbox, 'legacy.json'));
});

afterEach(() => {
  vi.restoreAllMocks();
  setClaudeRunner();
  process.env = { ...saved };
  fs.rmSync(sandbox, { recursive: true, force: true });
});

function writeClaudeSettings(value: unknown) {
  fs.mkdirSync(path.join(sandbox, 'claude'), { recursive: true });
  fs.writeFileSync(paths.claudeSettingsFile(), JSON.stringify(value));
}

const busyInput = (cwd: string) => {
  const input = createScenarioContext('busy').input;
  return JSON.stringify({ ...input, session_id: 'test-session', workspace: { ...input.workspace, current_dir: cwd, project_dir: cwd } });
};

describe('git parsing', () => {
  it('reads branch, ahead/behind and file counts', () => {
    const status = parseGitStatus(
      [
        '# branch.oid 4f9c2d1e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
        '# branch.head feature/x',
        '# branch.upstream origin/feature/x',
        '# branch.ab +2 -1',
        '1 .M N... 100644 100644 100644 aaa bbb a.ts',
        '1 A. N... 000000 100644 100644 000 ccc b.ts',
        '2 R. N... 100644 100644 100644 ddd eee R100 new.ts\told.ts',
        '? c.ts',
        '',
      ].join('\n'),
    );
    expect(status).toEqual({ branch: 'feature/x', sha: '4f9c2d1', changedFiles: 3, untracked: 1, ahead: 2, behind: 1 });
    expect(parseGitStatus('# branch.oid (initial)\n# branch.head main\n')).toMatchObject({ branch: 'main', sha: undefined });
    expect(parseGitStatus('# branch.oid 4f9c2d1e8a7b\n# branch.head (detached)\n')).toMatchObject({ branch: undefined, sha: '4f9c2d1' });
  });

  it('names a detached HEAD by its commit, from a real repository', async () => {
    const repo = path.join(sandbox, 'repo');
    fs.mkdirSync(repo);
    const run = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: repo, stdio: 'pipe' });
    run('init', '-q');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'a');
    run('add', '.');
    run('commit', '-qm', 'first');
    run('checkout', '-q', '--detach');
    fs.writeFileSync(path.join(repo, 'b.txt'), 'b');
    const sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    const info = await getGitInfo(repo, 'detached');
    expect(info).toMatchObject({ branch: undefined, sha, untracked: 1 });
  });

  it('reads line counts', () => {
    expect(parseShortstat(' 3 files changed, 10 insertions(+), 2 deletions(-)')).toEqual({ added: 10, deleted: 2 });
    expect(parseShortstat('')).toEqual({ added: 0, deleted: 0 });
  });
});

describe('custom commands', () => {
  const widget = (command: string, timeout?: number) => ({ id: 'cmd', type: 'custom-command', commandPath: command, timeout }) as never;
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  it.skipIf(process.platform === 'win32')('stops everything the command started when it runs too long', async () => {
    const pidFile = path.join(sandbox, 'pid');
    const started = Date.now();
    const result = await runCommands([widget(`sleep 30 & echo $! > "${pidFile}"; wait`, 300)], { stdin: '{}' });
    expect(result['cmd']).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(alive(pid)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('keeps the start of a long output', async () => {
    const result = await runCommands([widget('echo first; yes more | head -n 5000')], { stdin: '{}' });
    expect(result['cmd']?.split('\n')[0]).toBe('first');
    expect(result['cmd']?.length).toBe(4096);
  });

  it('passes Claude Code\'s JSON on stdin', async () => {
    const result = await runCommands([widget(process.platform === 'win32' ? 'more' : 'cat')], { stdin: '{"a":1}' });
    expect(result['cmd']?.trim()).toBe('{"a":1}');
  });
});

describe('config store', () => {
  it('saves and loads profiles', () => {
    const { config } = loadConfig();
    saveConfig(withActiveLayout(config, getPreset('minimal')!.layout, 'quiet'));
    const loaded = loadConfig();
    expect(loaded.exists).toBe(true);
    expect(loaded.config.activeProfile).toBe('quiet');
    expect(Object.keys(loaded.config.profiles).sort()).toEqual(['default', 'quiet']);
  });

  it('keeps a broken file and reports it instead of overwriting it', () => {
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.configFile(), '{ nope');
    const loaded = loadConfig();
    expect(loaded.error).toContain('not valid JSON');
    expect(fs.readFileSync(paths.configFile(), 'utf8')).toBe('{ nope');
  });

  it('refuses to init, apply or switch profile on top of a broken file', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.configFile(), '{ "profiles": {}, }');
    expect(await initCommand({ yes: true })).toBe(1);
    expect(await applyCommand('minimal', {})).toBe(1);
    expect(profileCommand(['use', 'default'])).toBe(1);
    expect(fs.readFileSync(paths.configFile(), 'utf8')).toBe('{ "profiles": {}, }');
    expect(fs.existsSync(paths.claudeSettingsFile())).toBe(false);
  });

  it('keeps a copy of a broken file before saving over it', () => {
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.configFile(), '{ nope');
    const { backup } = saveConfig(loadConfig().config);
    expect(backup).toContain("config.json.backups");
    expect(fs.readFileSync(backup!, 'utf8')).toBe('{ nope');
    expect(loadConfig().error).toBeUndefined();
    expect(saveConfig(loadConfig().config).backup).toBeUndefined();
  });

  it('reads and writes project files', () => {
    const project = path.join(sandbox, 'project');
    saveProjectFile(project, 'project', { profile: 'quiet' });
    saveProjectFile(project, 'local', { layout: getPreset('pip')!.layout });
    const loaded = loadProject(project);
    expect(loaded.project?.profile).toBe('quiet');
    expect(loaded.local?.layout?.lines[0]?.[0]?.type).toBe('mood');
    saveProjectFile(project, 'local', null);
    expect(loadProject(project).local).toBeUndefined();
  });
});

describe('mods file', () => {
  const placed = { version: 1 as const, mods: [{ id: 'meter', type: 'context-meter', enabled: true, options: { width: 30 } }] };

  it('starts empty, then saves and loads mods', () => {
    expect(loadMods()).toMatchObject({ exists: false, mods: { mods: [] } });
    expect(saveMods(placed)).toEqual({ path: path.join(sandbox, 'config', 'mods.json') });
    const loaded = loadMods();
    expect(loaded.exists).toBe(true);
    expect(loaded.error).toBeUndefined();
    expect(loaded.mods).toEqual(placed);
  });

  it('reports a broken or invalid file without overwriting it', () => {
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.modsFile(), '{ nope');
    expect(loadMods()).toMatchObject({ exists: true, mods: { mods: [] }, error: expect.stringContaining('not valid JSON') });
    fs.writeFileSync(paths.modsFile(), JSON.stringify({ version: 9 }));
    expect(loadMods().error).toContain('version');
    expect(fs.readFileSync(paths.modsFile(), 'utf8')).toBe('{"version":9}');
    const { backup } = saveMods(placed);
    expect(fs.readFileSync(backup!, 'utf8')).toBe('{"version":9}');
  });

  it('refuses to save invalid mods', () => {
    expect(() => saveMods({ version: 1, mods: [{ id: '', type: 'x', enabled: true, options: {} }] })).toThrow(/invalid/);
    expect(fs.existsSync(paths.modsFile())).toBe(false);
  });
});

describe('Claude Code plugin', () => {
  it('runs exactly the CLI release it was built with', () => {
    const root = path.resolve(__dirname, '../..');
    const cli = JSON.parse(fs.readFileSync(path.join(root, 'cli/package.json'), 'utf8')).version;
    expect(fs.readFileSync(path.join(root, 'plugin/hooks/vendor/version.js'), 'utf8')).toContain(`CLI_VERSION = '${cli}'`);
    expect(fs.readFileSync(path.join(root, 'plugin/hooks/register.ts'), 'utf8')).not.toContain('statuscraft@latest');
  });

  const PLUGIN_VERSION: string = JSON.parse(fs.readFileSync(path.join(__dirname, '../../plugin/.claude-plugin/plugin.json'), 'utf8')).version;
  interface FakePlugin { id: string; scope: string; enabled: boolean; version: string }

  // A pretend Claude Code that answers like `claude plugin … --json` does
  function fakeClaude(options: { version?: string; plugins?: FakePlugin[] } = {}) {
    const bin = path.join(sandbox, 'bin', 'claude');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '', { mode: 0o755 });
    process.env['STATUSCRAFT_CLAUDE_BIN'] = bin;
    const calls: string[] = [];
    const plugins = options.plugins ?? [];
    const marketplaces: { name: string; path: string }[] = [];
    const reply = (value: unknown, code = 0) => ({ code, stdout: `${JSON.stringify(value)}\n`, stderr: '' });
    setClaudeRunner(async (_bin, args) => {
      calls.push(args.join(' '));
      const [first, second, third, fourth] = args;
      if (first === '--version') return { code: 0, stdout: `${options.version ?? '2.1.291'} (Claude Code)\n`, stderr: '' };
      if (second === 'list') return reply(plugins);
      if (second === 'marketplace' && third === 'list') return reply(marketplaces);
      if (second === 'marketplace' && third === 'add') {
        marketplaces.push({ name: 'statuscraft-local', path: fourth! });
        return reply({ outcome: 'ok', message: 'Added the marketplace' });
      }
      if (second === 'marketplace' && third === 'remove') {
        marketplaces.length = 0;
        return reply({ outcome: 'ok', message: 'Removed the marketplace' });
      }
      if (second === 'install') {
        // Claude Code reports the version of the plugin it just copied
        plugins.push({ id: third!, scope: 'user', enabled: true, version: PLUGIN_VERSION });
        return reply({ outcome: 'ok', message: `Installed ${third}` });
      }
      const plugin = plugins.find((entry) => entry.id === third);
      if (second === 'enable' && plugin) {
        plugin.enabled = true;
        return reply({ outcome: 'ok', message: `Enabled ${third}` });
      }
      if (second === 'uninstall' && plugin) {
        plugins.splice(plugins.indexOf(plugin), 1);
        return reply({ outcome: 'ok', message: `Uninstalled ${third}` });
      }
      return reply({ outcome: 'failed', message: `Unexpected: ${args.join(' ')}` }, 1);
    });
    return { bin, calls, plugins };
  }

  it('compares versions like semver', () => {
    expect(compareVersions('2.1.291', '2.1.287')).toBe(1);
    expect(compareVersions('2.1.287', '2.1.287')).toBe(0);
    expect(compareVersions('2.1.9', '2.1.287')).toBe(-1);
    expect(compareVersions('2.10.0', '2.9.99')).toBe(1);
    expect(compareVersions('2.1.287-beta.1', '2.1.287')).toBe(-1);
    expect(compareVersions('2.1.287-beta.2', '2.1.287-beta.10')).toBe(-1);
    expect(compareVersions('2.1.287-rc', '2.1.287-beta')).toBe(1);
    expect(compareVersions('v3.0.0', '2.1.287')).toBe(1);
  });

  it('builds the local marketplace manifest', () => {
    expect(marketplaceManifest('Mods!')).toMatchObject({
      name: 'statuscraft-local',
      owner: { name: 'StatusCraft' },
      plugins: [{ name: 'statuscraft', source: './statuscraft', description: 'Mods!' }],
    });
  });

  it('copies the mod without tests, build scripts, type stubs or installed packages', () => {
    const from = path.join(sandbox, 'plugin-src');
    const files = ['.claude-plugin/plugin.json', '.claude-plugin/types/claude-code.d.ts', 'hooks/register.ts', 'hooks/vendor/core.js', 'tests/a.test.ts', 'scripts/build.ts', 'node_modules/x/index.js'];
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(from, file)), { recursive: true });
      fs.writeFileSync(path.join(from, file), '{}');
    }
    const to = path.join(sandbox, 'plugin-copy');
    copyPluginFiles(from, to);
    expect(fs.existsSync(path.join(to, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(to, 'hooks', 'register.ts'))).toBe(true);
    expect(fs.existsSync(path.join(to, 'hooks', 'vendor', 'core.js'))).toBe(true);
    expect(fs.existsSync(path.join(to, 'scripts'))).toBe(false);
    expect(fs.existsSync(path.join(to, '.claude-plugin', 'types'))).toBe(false);
    expect(fs.existsSync(path.join(to, 'tests'))).toBe(false);
    expect(fs.existsSync(path.join(to, 'node_modules'))).toBe(false);
  });

  it('says so when Claude Code is missing or too old', async () => {
    expect(await pluginState({ fresh: true })).toMatchObject({ claude: { found: false }, modsSupported: false, installed: false });
    await expect(installPlugin()).rejects.toThrow(/not found/);
    fakeClaude({ version: '2.1.200' });
    expect(await pluginState({ fresh: true })).toMatchObject({ claude: { found: true, version: '2.1.200' }, modsSupported: false });
    await expect(installPlugin()).rejects.toThrow(/2\.1\.287 or newer/);
  });

  it('notices when hooks are disabled', async () => {
    writeClaudeSettings({ disableAllHooks: true });
    expect((await pluginState({ fresh: true })).disabledByHooksSetting).toBe(true);
  });

  it('installs through a local marketplace, then uninstalls', async () => {
    const claude = fakeClaude();
    const result = await installPlugin();
    expect(result).toMatchObject({ installed: true, id: LOCAL_PLUGIN_ID });
    expect(claude.calls).toContain(`plugin marketplace add ${paths.marketplaceDir()} --scope user --json`);
    expect(claude.calls).toContain(`plugin install ${LOCAL_PLUGIN_ID} --scope user --json`);
    const manifest = JSON.parse(fs.readFileSync(path.join(paths.marketplaceDir(), '.claude-plugin', 'marketplace.json'), 'utf8'));
    expect(manifest.plugins[0]).toMatchObject({ name: 'statuscraft', source: './statuscraft' });
    expect(fs.existsSync(path.join(paths.marketplaceDir(), 'statuscraft', '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(paths.marketplaceDir(), 'statuscraft', 'tests'))).toBe(false);
    expect(await pluginState()).toMatchObject({ installed: true, enabled: true, source: 'local', id: LOCAL_PLUGIN_ID });

    // Installing again only refreshes the files
    claude.calls.length = 0;
    await installPlugin();
    expect(claude.calls.some((call) => call.startsWith('plugin install') || call.startsWith('plugin marketplace add'))).toBe(false);

    expect(await uninstallPlugin()).toEqual({ removed: true });
    expect(claude.calls).toContain('plugin marketplace remove statuscraft-local --json');
    expect(fs.existsSync(paths.marketplaceDir())).toBe(false);
    expect((await pluginState()).installed).toBe(false);
  });

  it('leaves a copy installed some other way alone, only turning it on', async () => {
    const claude = fakeClaude({ plugins: [{ id: 'statuscraft@statuscraft', scope: 'user', enabled: false, version: '1.0.0' }] });
    expect(await pluginState({ fresh: true })).toMatchObject({ installed: true, enabled: false, source: 'marketplace', id: 'statuscraft@statuscraft' });
    expect(await installPlugin()).toMatchObject({ installed: true, id: 'statuscraft@statuscraft' });
    expect(claude.calls).toContain('plugin enable statuscraft@statuscraft --json');
    expect(claude.calls.some((call) => call.startsWith('plugin install'))).toBe(false);
    expect(fs.existsSync(paths.marketplaceDir())).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('runs the real program, without a shell', async () => {
    const bin = path.join(sandbox, 'bin', 'claude');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    const list = JSON.stringify([{ id: 'statuscraft@elsewhere', scope: 'user', enabled: true }]);
    fs.writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.1.300 (Claude Code)"; else echo '${list}'; fi\n`, { mode: 0o755 });
    process.env['STATUSCRAFT_CLAUDE_BIN'] = bin;
    expect(await pluginState({ fresh: true })).toMatchObject({
      claude: { found: true, path: bin, version: '2.1.300' },
      modsSupported: true,
      installed: true,
      enabled: true,
      source: 'marketplace',
    });
  });

  it.skipIf(process.platform === 'win32')('finds Claude Code where the local installer puts it', () => {
    delete process.env['STATUSCRAFT_CLAUDE_BIN'];
    process.env['PATH'] = '';
    vi.spyOn(paths, 'home').mockReturnValue(path.join(sandbox, 'home'));
    expect(findClaude()).toBeUndefined();
    const local = path.join(sandbox, 'home', '.claude', 'local', 'claude');
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, '', { mode: 0o755 });
    expect(findClaude()).toBe(local);
  });
});

describe('Claude Code settings', () => {
  it('installs, keeps other settings, and restores the previous status line', () => {
    writeClaudeSettings({ theme: 'dark', statusLine: { type: 'command', command: '~/old.sh' } });
    install();
    const settings = JSON.parse(fs.readFileSync(paths.claudeSettingsFile(), 'utf8'));
    expect(settings.theme).toBe('dark');
    expect(settings.statusLine.type).toBe('command');
    expect(getInstallState()).toMatchObject({ configured: true, ours: true });
    expect(fs.existsSync(`${paths.claudeSettingsFile()}.before-statuscraft`)).toBe(true);

    expect(uninstall().restored).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).statusLine.command).toBe('~/old.sh');
  });

  it('leaves a status line alone that is no longer StatusCraft', () => {
    writeClaudeSettings({ statusLine: { type: 'command', command: '~/old.sh' } });
    install();
    const other = { type: 'command', command: 'npx ccstatusline' };
    writeClaudeSettings({ theme: 'dark', statusLine: other });
    expect(uninstall()).toEqual({ restored: false, notOurs: true });
    expect(JSON.parse(fs.readFileSync(paths.claudeSettingsFile(), 'utf8'))).toEqual({ theme: 'dark', statusLine: other });
    expect(fs.existsSync(paths.previousStatusLineFile())).toBe(true);
  });

  it('refuses to touch a settings file it cannot read', () => {
    fs.mkdirSync(path.join(sandbox, 'claude'), { recursive: true });
    fs.writeFileSync(paths.claudeSettingsFile(), '{ broken');
    expect(() => install()).toThrow(/not valid JSON/);
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe('{ broken');
  });

  it('notices when hooks are disabled', () => {
    writeClaudeSettings({ disableAllHooks: true });
    expect(getInstallState().disabledByHooksSetting).toBe(true);
  });
});

describe('renderFromStdin', () => {
  it('draws the active profile and remembers the input for the editor', async () => {
    const text = stripAnsi(await renderFromStdin(busyInput(sandbox)));
    expect(text).toContain('Opus 5.5');
    expect(text).toContain('Ctx 56%');
    expect(fs.existsSync(paths.lastInputFile())).toBe(true);
  });

  it('uses the project file over the active profile', async () => {
    const project = path.join(sandbox, 'project');
    saveProjectFile(project, 'project', { layout: getPreset('minimal')!.layout });
    const text = stripAnsi(await renderFromStdin(busyInput(project)));
    expect(text).toContain('▰');
    expect(text).not.toContain('Ctx 56%');
  });

  it('uses the profile picked for the session by the plugin', async () => {
    const { config } = loadConfig();
    saveConfig({ ...config, profiles: { ...config.profiles, quiet: getPreset('minimal')!.layout } });
    fs.mkdirSync(path.dirname(paths.sessionFile('test-session')), { recursive: true });
    fs.writeFileSync(paths.sessionFile('test-session'), JSON.stringify({ profile: 'quiet' }));
    expect(stripAnsi(await renderFromStdin(busyInput(sandbox)))).toContain('▰');
  });

  it('says so when the config is broken instead of going blank', async () => {
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.configFile(), '[]');
    const text = stripAnsi(await renderFromStdin(busyInput(sandbox)));
    expect(text).toContain('statuscraft doctor');
    expect(text).toContain('Opus 5.5');
  });

  it('survives junk input', async () => {
    await expect(renderFromStdin('not json')).resolves.toBeTypeOf('string');
  });
});

describe('editor server', () => {
  async function withServer(run: (base: string) => Promise<void>) {
    const port = 39000 + Math.floor(Math.random() * 900);
    const server = createServer({ port, projectDir: sandbox, editorDir: path.join(sandbox, 'no-editor') });
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    try {
      await run(`http://localhost:${port}`);
    } finally {
      server.close();
    }
  }

  it('serves state and saves configs', async () => {
    await withServer(async (base) => {
      const state = await (await fetch(`${base}/api/state`)).json();
      expect(state.ok).toBe(true);
      const config = withActiveLayout(state.data.config, getPreset('git')!.layout);
      const saved = await fetch(`${base}/api/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-statuscraft': '1' },
        body: JSON.stringify({ config, expectedRevision: state.data.configRevision }),
      });
      expect((await saved.json()).ok).toBe(true);
      expect(loadConfig().config.profiles['default']?.lines[0]?.[0]?.type).toBe('repo');
    });
  });

  it('serves and saves mods with the plugin state', async () => {
    await withServer(async (base) => {
      const state = await (await fetch(`${base}/api/mods`)).json();
      expect(state).toMatchObject({ ok: true, data: { exists: false, mods: { mods: [] }, plugin: { claude: { found: false }, installed: false } } });
      const write = (body: unknown) =>
        fetch(`${base}/api/mods`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-statuscraft': '1' }, body: JSON.stringify({ ...body as object, expectedRevision: state.data.revision }) });
      const saved = await (await write({ mods: { version: 1, mods: [{ id: 'm1', type: 'context-meter' }] } })).json();
      expect(saved).toEqual({ ok: true, data: { saved: true, path: paths.modsFile() } });
      expect(loadMods().mods.mods[0]).toMatchObject({ id: 'm1', type: 'context-meter', enabled: true });
      expect((await write({ mods: { version: 2 } })).status).toBe(400);
      expect((await write({})).status).toBe(400);
      expect((await fetch(`${base}/api/mods`, { method: 'PUT', body: '{}' })).status).toBe(403);
      expect(loadMods().mods.mods).toHaveLength(1);
    });
  });

  it('rejects writes without the StatusCraft header and invalid configs', async () => {
    await withServer(async (base) => {
      const noHeader = await fetch(`${base}/api/config`, { method: 'PUT', body: '{}' });
      expect(noHeader.status).toBe(403);
      const invalid = await fetch(`${base}/api/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-statuscraft': '1' },
        body: JSON.stringify({ config: { version: 4, profiles: {} } }),
      });
      expect(invalid.status).toBe(400);
    });
  });
});

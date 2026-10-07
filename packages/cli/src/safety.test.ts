import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig, getPreset, encodeShareCode } from '@statuscraft/core';
import { getInstallState, install, uninstall } from './lib/claude-settings';
import { approveCommands, commandScope, loadCommandTrust, revokeCommands } from './lib/command-trust';
import { loadConfig, saveConfig, saveMods, saveProjectFile } from './lib/config-store';
import { paths } from './lib/paths';
import { readJson, writeJson, withFileLock } from './lib/files';
import { renderFromStdin } from './commands/render';
import { applyCommand, initCommand } from './commands/setup';
import { trustCommand } from './commands/trust';
import { createServer } from './server';

let sandbox: string;
const savedEnv = { ...process.env };
beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'statuscraft-safety-test-'));
  process.env['STATUSCRAFT_CONFIG_DIR'] = path.join(sandbox, 'config');
  process.env['STATUSCRAFT_CACHE_DIR'] = path.join(sandbox, 'cache');
  process.env['CLAUDE_CONFIG_DIR'] = path.join(sandbox, 'claude');
  process.env['STATUSCRAFT_CLAUDE_BIN'] = path.join(sandbox, 'no-claude');
  delete process.env['STATUSCRAFT_PROFILE'];
  vi.spyOn(paths, 'legacyConfigFile').mockReturnValue(path.join(sandbox, 'legacy.json'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...savedEnv };
  fs.rmSync(sandbox, { recursive: true, force: true });
});
function put(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}
function snapshots(file: string): string[] {
  const dir = `${file}.backups`;
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((name) => fs.readFileSync(path.join(dir, name), 'utf8')) : [];
}
const command = `"${process.execPath}" -e "require('fs').writeFileSync('command-ran','yes');console.log('approved')"`;
function layout(cmd = command) {
  return { ...getPreset('minimal')!.layout, lines: [[{ id: 'proof', type: 'custom-command', commandPath: cmd }]] };
}
function input(project: string) {
  return JSON.stringify({ cwd: project, workspace: { current_dir: project, project_dir: project } });
}

describe('safe configuration transactions', () => {
  it('backs up Claude settings before creating our own config, with private snapshot permissions', () => {
    const original = { model: 'opus', permissions: { deny: ['Bash(rm:*)'] }, env: { SECRET: 'preserve-me' } };
    put(paths.claudeSettingsFile(), original);
    const bytes = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    saveConfig(createDefaultConfig());
    expect(fs.readFileSync(`${paths.claudeSettingsFile()}.before-statuscraft`, 'utf8')).toBe(bytes);
    expect(snapshots(paths.claudeSettingsFile())).toContain(bytes);
    expect(readJson(paths.claudeSettingsFile()).value).toEqual(original);
    if (process.platform !== 'win32') {
      expect(fs.statSync(`${paths.claudeSettingsFile()}.before-statuscraft`).mode & 0o777).toBe(0o600);
      expect(fs.statSync(paths.configFile()).mode & 0o777).toBe(0o600);
    }
  });

  it('aborts before creating config when the Claude backup cannot be made', () => {
    put(paths.claudeSettingsFile(), { model: 'opus' });
    put(`${paths.claudeSettingsFile()}.backups`, 'this blocks the backup directory');
    const before = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    expect(() => saveConfig(createDefaultConfig())).toThrow();
    expect(fs.existsSync(paths.configFile())).toBe(false);
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe(before);
  });

  it('does not create config or change malformed Claude settings during init', async () => {
    put(paths.claudeSettingsFile(), []);
    await expect(initCommand({ yes: true })).resolves.toBe(1);
    expect(fs.existsSync(paths.configFile())).toBe(false);
    expect(readJson(paths.claudeSettingsFile()).value).toEqual([]);
  });

  it('reports read failures instead of treating them as a missing file', () => {
    fs.mkdirSync(paths.claudeSettingsFile(), { recursive: true });
    expect(readJson(paths.claudeSettingsFile()).error).toContain('Cannot read');
    expect(() => install()).toThrow(/Cannot read/);
    expect(fs.statSync(paths.claudeSettingsFile()).isDirectory()).toBe(true);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('keeps unreadable settings even when an old backup exists', () => {
    put(paths.claudeSettingsFile(), { permissions: { deny: ['Bash(rm:*)'] }, model: 'opus' });
    put(`${paths.claudeSettingsFile()}.before-statuscraft`, { model: 'old' });
    const before = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    fs.chmodSync(paths.claudeSettingsFile(), 0);
    try {
      expect(() => install()).toThrow(/Cannot read/);
      expect(getInstallState().error).toContain('Cannot read');
    } finally {
      fs.chmodSync(paths.claudeSettingsFile(), 0o600);
    }
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe(before);
  });

  it('backs up valid config, mods and project files before replacements or removals', () => {
    saveConfig(createDefaultConfig());
    const config = fs.readFileSync(paths.configFile(), 'utf8');
    saveConfig(createDefaultConfig(getPreset('minimal')!.layout));
    expect(snapshots(paths.configFile())).toContain(config);
    saveMods({ version: 1, mods: [] });
    const mods = fs.readFileSync(paths.modsFile(), 'utf8');
    saveMods({ version: 1, mods: [{ id: 'meter', type: 'context-meter', enabled: true, options: {} }] });
    expect(snapshots(paths.modsFile())).toContain(mods);
    const project = path.join(sandbox, 'project');
    const file = saveProjectFile(project, 'project', { profile: 'default' });
    const first = fs.readFileSync(file, 'utf8');
    saveProjectFile(project, 'project', { layout: getPreset('minimal')!.layout });
    expect(snapshots(file)).toContain(first);
    const second = fs.readFileSync(file, 'utf8');
    saveProjectFile(project, 'project', null);
    expect(snapshots(file)).toContain(second);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('preserves imported legacy config before creating the new config', () => {
    put(paths.legacyConfigFile(), getPreset('minimal')!.layout);
    const original = fs.readFileSync(paths.legacyConfigFile(), 'utf8');
    fs.chmodSync(paths.legacyConfigFile(), 0o400);
    const loaded = loadConfig();
    expect(loaded.importedFrom).toBe(paths.legacyConfigFile());
    saveConfig(loaded.config);
    expect(snapshots(paths.legacyBackupBase())).toContain(original);
    expect(fs.readFileSync(paths.legacyConfigFile(), 'utf8')).toBe(original);
    expect(fs.existsSync(`${paths.legacyConfigFile()}.backups`)).toBe(false);
  });

  it('refuses stale writes and preserves the newer file', () => {
    saveConfig(createDefaultConfig());
    const revision = fs.readFileSync(paths.configFile(), 'utf8');
    const newer = createDefaultConfig(getPreset('git')!.layout);
    saveConfig(newer);
    expect(() => saveConfig(createDefaultConfig(), revision)).toThrow(/changed/);
    expect(loadConfig().config).toEqual(newer);
    expect(() => writeJson(paths.configFile(), {}, { expected: undefined })).toThrow(/changed/);
  });

  it('refuses overlapping transactions and releases a lock after an error', () => {
    withFileLock(paths.configFile(), () => {
      expect(() => saveConfig(createDefaultConfig())).toThrow(/Cannot lock/);
      expect(fs.existsSync(paths.configFile())).toBe(false);
    });
    expect(() => withFileLock(paths.configFile(), () => { throw new Error('test failure'); })).toThrow('test failure');
    expect(fs.existsSync(`${paths.configFile()}.statuscraft.lock`)).toBe(false);
    saveConfig(createDefaultConfig());
  });

  it.skipIf(process.platform === 'win32')('leaves symlinked user settings and their target untouched', () => {
    const target = path.join(sandbox, 'actual-settings.json');
    put(target, { model: 'opus' });
    fs.mkdirSync(path.dirname(paths.claudeSettingsFile()), { recursive: true });
    fs.symlinkSync(target, paths.claudeSettingsFile());
    expect(() => install()).toThrow(/regular file/);
    expect(fs.lstatSync(paths.claudeSettingsFile()).isSymbolicLink()).toBe(true);
    expect(readJson(target).value).toEqual({ model: 'opus' });
  });
});

describe('status line ownership and recovery', () => {
  it('leaves unrelated commands containing the word statuscraft untouched', () => {
    const original = { model: 'opus', statusLine: { type: 'command', command: 'node /tmp/statuscraft-demo/other-renderer.mjs' } };
    put(paths.claudeSettingsFile(), original);
    expect(getInstallState().ours).toBe(false);
    expect(uninstall()).toMatchObject({ notOurs: true });
    expect(readJson(paths.claudeSettingsFile()).value).toEqual(original);
    install();
    uninstall();
    expect(readJson(paths.claudeSettingsFile()).value).toEqual(original);
  });

  it('recognizes safely quoted renderer paths containing shell operators', () => {
    process.env['STATUSCRAFT_CONFIG_DIR'] = path.join(sandbox, 'config&other;(literal)');
    // The installer normalizes Windows paths to forward slashes before quoting.
    const shellPath = (value: string) => process.platform === 'win32' ? value.replace(/\\/g, '/') : value;
    put(paths.claudeSettingsFile(), { statusLine: { type: 'command', command: `"${shellPath(process.execPath)}" "${shellPath(paths.renderScript())}"` } });
    expect(getInstallState().ours).toBe(true);
    uninstall();
    expect(readJson(paths.claudeSettingsFile()).value).toEqual({});
  });

  it('does not claim a shell pipeline merely because it ends with our renderer', () => {
    put(paths.claudeSettingsFile(), { statusLine: { type: 'command', command: `echo other; node ${paths.renderScript()}` } });
    expect(getInstallState().ours).toBe(false);
  });

  it('keeps the first backup and previous status line across repeated installs', () => {
    const original = { model: 'opus', statusLine: { type: 'command', command: '~/original.sh', padding: 2 } };
    put(paths.claudeSettingsFile(), original);
    install();
    const installed = readJson(paths.claudeSettingsFile()).value as Record<string, unknown>;
    put(paths.claudeSettingsFile(), { ...installed, model: 'sonnet' });
    install();
    uninstall();
    expect(readJson(paths.claudeSettingsFile()).value).toEqual({ ...original, model: 'sonnet' });
    expect(JSON.parse(fs.readFileSync(`${paths.claudeSettingsFile()}.before-statuscraft`, 'utf8'))).toEqual(original);
  });

  it('rejects invalid previous status-line objects without changing settings', () => {
    put(paths.claudeSettingsFile(), { statusLine: { type: 'command', command: '~/original.sh' } });
    install();
    const before = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    put(paths.previousStatusLineFile(), { type: 'command', command: 123 });
    expect(() => uninstall()).toThrow(/Invalid previous/);
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe(before);
  });

  it('rejects invalid current status-line settings before installing', () => {
    put(paths.claudeSettingsFile(), { model: 'opus', statusLine: { type: 'command', command: 123 } });
    const before = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    expect(() => install()).toThrow(/invalid statusLine/);
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe(before);
  });

  it('refuses to uninstall when the recovery record is malformed', () => {
    put(paths.claudeSettingsFile(), { statusLine: { type: 'command', command: '~/original.sh' } });
    install();
    const current = fs.readFileSync(paths.claudeSettingsFile(), 'utf8');
    fs.writeFileSync(paths.previousStatusLineFile(), '{ broken');
    expect(() => uninstall()).toThrow(/Cannot restore/);
    expect(fs.readFileSync(paths.claudeSettingsFile(), 'utf8')).toBe(current);
    expect(fs.readFileSync(paths.previousStatusLineFile(), 'utf8')).toBe('{ broken');
  });

  it('does not restore a stale record when installing over an empty status line', () => {
    put(paths.claudeSettingsFile(), { model: 'opus' });
    put(paths.previousStatusLineFile(), { type: 'command', command: '~/stale.sh' });
    install();
    uninstall();
    expect(readJson(paths.claudeSettingsFile()).value).toEqual({ model: 'opus' });
  });
});

describe('command trust', () => {
  it('blocks project commands, allows exact approval, and requires approval again after edits', async () => {
    const project = path.join(sandbox, 'project');
    saveProjectFile(project, 'project', { layout: layout() });
    expect(await renderFromStdin(input(project))).toContain('commands disabled');
    expect(fs.existsSync(path.join(project, 'command-ran'))).toBe(false);
    approveCommands([{ kind: 'statusline', scope: commandScope(project), command }]);
    expect(await renderFromStdin(input(project))).toContain('approved');
    expect(fs.readFileSync(path.join(project, 'command-ran'), 'utf8')).toBe('yes');
    fs.rmSync(path.join(project, 'command-ran'));
    saveProjectFile(project, 'project', { layout: layout(command + ' ') });
    expect(await renderFromStdin(input(project))).toContain('commands disabled');
    expect(fs.existsSync(path.join(project, 'command-ran'))).toBe(false);
  });

  it('does not reuse approval from another project or from global profiles', async () => {
    const one = path.join(sandbox, 'one');
    const two = path.join(sandbox, 'two');
    saveProjectFile(one, 'project', { layout: layout() });
    saveProjectFile(two, 'local', { layout: layout() });
    approveCommands([{ kind: 'statusline', scope: commandScope(one), command }, { kind: 'statusline', scope: 'global', command }]);
    expect(await renderFromStdin(input(two))).toContain('commands disabled');
    expect(fs.existsSync(path.join(two, 'command-ran'))).toBe(false);
  });

  it('blocks imported share-code commands until an explicit global approval', async () => {
    const code = encodeShareCode(layout());
    await expect(applyCommand(code, {})).resolves.toBe(0);
    expect(await renderFromStdin(input(sandbox))).toContain('commands disabled');
    expect(fs.existsSync(path.join(sandbox, 'command-ran'))).toBe(false);
    approveCommands([{ kind: 'statusline', scope: 'global', command }]);
    expect(await renderFromStdin(input(sandbox))).toContain('approved');
    revokeCommands();
    fs.rmSync(path.join(sandbox, 'command-ran'));
    expect(await renderFromStdin(input(sandbox))).toContain('commands disabled');
    expect(fs.existsSync(path.join(sandbox, 'command-ran'))).toBe(false);
  });

  it('fails closed when the private approval file is corrupt', async () => {
    saveConfig(createDefaultConfig(layout()));
    put(paths.commandTrustFile(), { version: 9, approvals: [{ kind: 'statusline', scope: 'global', command }] });
    expect(loadCommandTrust().error).toContain('Invalid command approvals');
    expect(await renderFromStdin(input(sandbox))).toContain('commands disabled');
    expect(() => approveCommands([{ kind: 'statusline', scope: 'global', command }])).toThrow();
    expect(fs.existsSync(path.join(sandbox, 'command-ran'))).toBe(false);
  });

  it('does not let project configuration approve its own command', async () => {
    const project = path.join(sandbox, 'project');
    const config = { layout: layout(), approvals: [{ kind: 'statusline', scope: 'global', command }] };
    put(paths.projectFile(project), config);
    put(path.join(project, '.claude/trusted-commands.json'), { version: 1, approvals: config.approvals });
    expect(await renderFromStdin(input(project))).toContain('commands disabled');
    expect(fs.existsSync(path.join(project, 'command-ran'))).toBe(false);
  });

  it('does not execute commands when producing diagnostic samples', async () => {
    saveConfig(createDefaultConfig(layout()));
    approveCommands([{ kind: 'statusline', scope: 'global', command }]);
    await renderFromStdin(input(sandbox), Date.now(), { executeCommands: false });
    expect(fs.existsSync(path.join(sandbox, 'command-ran'))).toBe(false);
  });

  it('does not silently approve commands in a noninteractive terminal', async () => {
    saveConfig(createDefaultConfig(layout()));
    await expect(trustCommand({})).resolves.toBe(1);
    expect(loadCommandTrust().trust.approvals).toEqual([]);
  });
});

describe('editor safeguards', () => {
  async function withServer(run: (base: string) => Promise<void>) {
    // Use a loopback test server with the same Host allowlist as the editor.
    const port = 41000 + Math.floor(Math.random() * 1000);
    const editor = path.join(sandbox, 'editor');
    fs.mkdirSync(editor);
    fs.writeFileSync(path.join(editor, 'index.html'), 'EDITOR');
    const server = createServer({ port, projectDir: sandbox, editorDir: editor });
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    try { await run(`http://127.0.0.1:${port}`); }
    finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  }
  const headers = { 'content-type': 'application/json', 'x-statuscraft': '1' };

  it('rejects stale editor saves and writes with no revision', async () => {
    saveConfig(createDefaultConfig());
    await withServer(async (base) => {
      const state = (await (await fetch(`${base}/api/state`)).json()).data;
      saveConfig(createDefaultConfig(getPreset('minimal')!.layout));
      const write = (body: unknown) => fetch(`${base}/api/config`, { method: 'PUT', headers, body: JSON.stringify(body) });
      expect((await write({ config: state.config, expectedRevision: state.configRevision })).status).toBe(409);
      expect((await write({ config: state.config })).status).toBe(400);
      expect(loadConfig().config.profiles.default).toEqual(getPreset('minimal')!.layout);
    });
  });

  it('does not delete a project config when data is omitted', async () => {
    saveProjectFile(sandbox, 'project', { profile: 'default' });
    await withServer(async (base) => {
      expect((await fetch(`${base}/api/project`, { method: 'PUT', headers, body: JSON.stringify({ which: 'project', expectedRevision: null }) })).status).toBe(400);
      expect(fs.existsSync(paths.projectFile(sandbox))).toBe(true);
    });
  });

  it('authorizes only exact reviewed commands through the protected endpoint', async () => {
    saveConfig(createDefaultConfig(layout()));
    await withServer(async (base) => {
      const approval = { kind: 'statusline', scope: 'global', command };
      expect((await fetch(`${base}/api/commands/trust`, { method: 'POST', body: JSON.stringify({ approvals: [approval] }) })).status).toBe(403);
      expect(loadCommandTrust().trust.approvals).toEqual([]);
      expect((await fetch(`${base}/api/commands/trust`, { method: 'POST', headers, body: JSON.stringify({ approvals: [approval] }) })).status).toBe(200);
      expect(loadCommandTrust().trust.approvals).toEqual([approval]);
      expect(await renderFromStdin(input(sandbox))).toContain('approved');
    });
  });

  it('rejects cross-origin requests and approvals for another project', async () => {
    await withServer(async (base) => {
      expect((await fetch(`${base}/api/state`, { headers: { origin: 'https://untrusted.example' } })).status).toBe(403);
      expect((await fetch(`${base}/api/commands/trust`, { method: 'POST', headers, body: JSON.stringify({ approvals: [{ kind: 'statusline', scope: 'project:/unrelated', command }] }) })).status).toBe(400);
      expect(loadCommandTrust().trust.approvals).toEqual([]);
    });
  });

  it('does not serve files from a sibling directory with the same prefix', async () => {
    const sibling = path.join(sandbox, 'editor-private');
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(sibling, 'secret.txt'), 'DO NOT SERVE');
    await withServer(async (base) => {
      const response = await fetch(`${base}/..%2feditor-private%2fsecret.txt`);
      expect(await response.text()).not.toContain('DO NOT SERVE');
    });
  });
});

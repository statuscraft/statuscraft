import { prepareClaudeSettings } from './claude-settings';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getInstallState } from './claude-settings';
import { fileExists, readJson, writeJson } from './files';
import { paths } from './paths';

// Mods (in-process plugins) arrived in this Claude Code version
export const MODS_MIN_CLAUDE = '2.1.287';
export const PLUGIN_NAME = 'statuscraft';
export const LOCAL_MARKETPLACE = 'statuscraft-local';
export const LOCAL_PLUGIN_ID = `${PLUGIN_NAME}@${LOCAL_MARKETPLACE}`;

export interface PluginState {
  claude: { found: boolean; path?: string; version?: string };
  modsSupported: boolean;
  installed: boolean;
  enabled: boolean;
  id?: string;
  source?: 'local' | 'marketplace';
  disabledByHooksSetting: boolean;
  error?: string;
}

export interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type ClaudeRunner = (bin: string, args: readonly string[], timeoutMs: number) => Promise<RunResult>;

// One entry of `claude plugin list --json`
interface InstalledPlugin {
  readonly id: string;
  readonly scope?: string;
  readonly enabled?: boolean;
  readonly version?: string;
}

// Never through a shell: arguments go to the program exactly as given.
const spawnRunner: ClaudeRunner = (bin, args, timeoutMs) =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const timer = setTimeout(() => {
      stderr += `\n${path.basename(bin)} took longer than ${Math.round(timeoutMs / 1000)}s and was stopped.`;
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });

let runner: ClaudeRunner = spawnRunner;

// Tests swap in a fake Claude Code; call with no argument to go back to the real one.
export function setClaudeRunner(next?: ClaudeRunner): void {
  runner = next ?? spawnRunner;
  cache = undefined;
}

// Semver order: 1 when a is newer, -1 when b is newer, 0 when equal.
export function compareVersions(a: string, b: string): number {
  const parse = (text: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(text.trim());
    if (!match) return undefined;
    return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4]?.split('.') ?? [] };
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return left ? 1 : right ? -1 : 0;
  for (let i = 0; i < 3; i++) {
    const diff = left.core[i]! - right.core[i]!;
    if (diff !== 0) return Math.sign(diff);
  }
  // A pre-release (2.1.0-beta) comes before its release (2.1.0)
  if (!left.pre.length || !right.pre.length) return Math.sign(right.pre.length - left.pre.length);
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i];
    const y = right.pre[i];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) return Math.sign(Number(x) - Number(y));
    if (xNum !== yNum) return xNum ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function findClaude(): string | undefined {
  const override = process.env['STATUSCRAFT_CLAUDE_BIN'];
  if (override) return isExecutable(override) ? override : undefined;
  const name = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const onPath = (process.env['PATH'] ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, name));
  // The local installer only adds a shell alias, which programs started by StatusCraft never see
  const usual = [path.join(paths.home(), '.claude', 'local', name), path.join(paths.home(), '.local', 'bin', name)];
  return [...onPath, ...usual].find(isExecutable);
}

function isExecutable(file: string): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseJsonOutput(stdout: string): unknown {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Commands that print more than JSON put the result on the last line
  }
  const last = text.split(/\r?\n/).reverse().find((line) => /^\s*[[{]/.test(line));
  try {
    return last ? JSON.parse(last) : undefined;
  } catch {
    return undefined;
  }
}

function failureText(result: RunResult): string {
  return (result.stderr.trim() || result.stdout.trim()).split(/\r?\n/).slice(-3).join(' ') || `exit code ${result.code}`;
}

interface Probe {
  readonly version?: string;
  readonly plugins: readonly InstalledPlugin[];
  readonly error?: string;
}

const CACHE_MS = 10_000;
let cache: { key: string; at: number; probe: Promise<Probe> } | undefined;

function probeClaude(bin: string, fresh = false): Promise<Probe> {
  const key = `${bin}\0${process.env['CLAUDE_CONFIG_DIR'] ?? ''}`;
  if (!fresh && cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.probe;
  const probe = (async (): Promise<Probe> => {
    const [versionRun, listRun] = await Promise.all([
      runner(bin, ['--version'], 15_000),
      runner(bin, ['plugin', 'list', '--json'], 30_000),
    ]);
    const version = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(versionRun.stdout)?.[1];
    if (listRun.code !== 0) return { version, plugins: [], error: `Could not ask Claude Code which plugins are installed: ${failureText(listRun)}` };
    const list = parseJsonOutput(listRun.stdout);
    if (!Array.isArray(list)) return { version, plugins: [], error: 'Claude Code listed its plugins in a format StatusCraft does not understand.' };
    const plugins = list.filter((entry): entry is InstalledPlugin => typeof entry?.id === 'string');
    return { version, plugins };
  })();
  cache = { key, at: Date.now(), probe };
  return probe;
}

const pluginName = (id: string) => id.split('@')[0];
const marketplaceOf = (id: string) => id.split('@').slice(1).join('@');

async function inspect(fresh: boolean): Promise<{ state: PluginState; entries: readonly InstalledPlugin[] }> {
  const disabledByHooksSetting = getInstallState().disabledByHooksSetting;
  const bin = findClaude();
  if (!bin) return { state: { claude: { found: false }, modsSupported: false, installed: false, enabled: false, disabledByHooksSetting }, entries: [] };

  const probe = await probeClaude(bin, fresh);
  const entries = probe.plugins.filter((plugin) => pluginName(plugin.id) === PLUGIN_NAME);
  const main = entries.find((plugin) => plugin.enabled === true) ?? entries[0];
  const state: PluginState = {
    claude: { found: true, path: bin, version: probe.version },
    modsSupported: probe.version !== undefined && compareVersions(probe.version, MODS_MIN_CLAUDE) >= 0,
    installed: entries.length > 0,
    enabled: entries.some((plugin) => plugin.enabled === true),
    id: main?.id,
    source: main ? (marketplaceOf(main.id) === LOCAL_MARKETPLACE ? 'local' : 'marketplace') : undefined,
    disabledByHooksSetting,
    error: probe.error,
  };
  return { state, entries };
}

export async function pluginState(options: { fresh?: boolean } = {}): Promise<PluginState> {
  return (await inspect(options.fresh ?? false)).state;
}

// Where the mod's files are: next to the bundled CLI, or packages/plugin when running from source
export function bundledPluginDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'plugin');
  return fileExists(path.join(bundled, '.claude-plugin', 'plugin.json')) ? bundled : path.resolve(here, '..', '..', '..', 'plugin');
}

// Tests, build scripts, type stubs and installed packages are only needed while working on the mod
const SKIPPED = new Set(['tests', 'scripts', 'types', '.claude-plugin/types']);

// Walks the tree itself, so the skip list sees the same relative paths on every system
export function copyPluginFiles(from: string, to: string, relative = ''): void {
  for (const entry of fs.readdirSync(path.join(from, relative), { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.name === 'node_modules' || SKIPPED.has(rel)) continue;
    if (entry.isDirectory()) {
      copyPluginFiles(from, to, rel);
    } else {
      fs.mkdirSync(path.dirname(path.join(to, rel)), { recursive: true });
      fs.copyFileSync(path.join(from, rel), path.join(to, rel));
    }
  }
}

export function marketplaceManifest(description?: string) {
  return {
    name: LOCAL_MARKETPLACE,
    owner: { name: 'StatusCraft' },
    description: 'The StatusCraft mod, served from your computer by the StatusCraft editor',
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./${PLUGIN_NAME}`,
        description: description ?? 'Runs the mods you place in the StatusCraft editor',
      },
    ],
  };
}

// Local marketplaces load in place, so copying fresh files is how the mod updates.
export function writeLocalMarketplace(from = bundledPluginDir()): string {
  const manifest = path.join(from, '.claude-plugin', 'plugin.json');
  if (!fileExists(manifest)) throw new Error(`The StatusCraft mod files are missing (${from}). Reinstall StatusCraft, then try again.`);
  const dir = paths.marketplaceDir();
  const target = path.join(dir, PLUGIN_NAME);
  const temp = `${target}.${process.pid}.tmp`;
  fs.rmSync(temp, { recursive: true, force: true });
  copyPluginFiles(from, temp);
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(temp, target);
  const plugin = readJson(manifest).value as { description?: unknown } | undefined;
  writeJson(path.join(dir, '.claude-plugin', 'marketplace.json'), marketplaceManifest(typeof plugin?.description === 'string' ? plugin.description : undefined));
  return dir;
}

interface CommandResult {
  readonly outcome?: string;
  readonly message?: string;
  readonly failureCode?: string;
  readonly alreadyInGoalState?: boolean;
}

// Run one `claude plugin … --json` step, remember what it said, and stop on a real failure.
async function step(bin: string, args: readonly string[], log: string[], timeoutMs = 120_000): Promise<CommandResult> {
  const result = await runner(bin, args, timeoutMs);
  const json = (parseJsonOutput(result.stdout) ?? {}) as CommandResult;
  if (json.message) log.push(json.message);
  const nothingToDo = json.alreadyInGoalState === true || json.failureCode === 'not_installed';
  if (result.code !== 0 && !nothingToDo) {
    throw new Error(json.message ?? `"claude ${args.slice(0, 3).join(' ')}" failed: ${failureText(result)}`);
  }
  return json;
}

function requireClaude(): string {
  const bin = findClaude();
  if (!bin) throw new Error('Claude Code was not found. Install it from https://claude.com/claude-code, then try again.');
  return bin;
}

async function ensureMarketplace(bin: string, log: string[]): Promise<void> {
  const dir = paths.marketplaceDir();
  const listed = await runner(bin, ['plugin', 'marketplace', 'list', '--json'], 30_000);
  const marketplaces = parseJsonOutput(listed.stdout);
  const known = Array.isArray(marketplaces)
    ? (marketplaces as { name?: string; path?: string; installLocation?: string }[]).find((entry) => entry?.name === LOCAL_MARKETPLACE)
    : undefined;
  if (known) {
    const knownDir = known.path ?? known.installLocation;
    if (knownDir && path.resolve(knownDir) === path.resolve(dir)) {
      await step(bin, ['plugin', 'marketplace', 'update', LOCAL_MARKETPLACE, '--json'], log);
      return;
    }
    // Same name, old folder (for example after moving the StatusCraft config): point it here
    await step(bin, ['plugin', 'marketplace', 'remove', LOCAL_MARKETPLACE, '--json'], log);
  }
  await step(bin, ['plugin', 'marketplace', 'add', dir, '--scope', 'user', '--json'], log);
}

export interface PluginInstallResult {
  installed: boolean;
  id: string;
  output: string;
}

export async function installPlugin(): Promise<PluginInstallResult> {
  const bin = requireClaude();
  const { state, entries } = await inspect(true);
  if (!state.modsSupported) {
    throw new Error(`Mods need Claude Code ${MODS_MIN_CLAUDE} or newer, and you have ${state.claude.version ?? 'an unknown version'}. Run "claude update", then try again.`);
  }
  if (state.error) throw new Error(state.error);

  prepareClaudeSettings();
  const log: string[] = [];
  try {
    if (state.installed && state.source === 'marketplace' && state.id) {
      // Installed some other way (for example from GitHub): leave it be, just make sure it is on
      if (state.enabled) return { installed: true, id: state.id, output: `StatusCraft is already installed as ${state.id}.` };
      await step(bin, ['plugin', 'enable', state.id, '--json'], log);
      cache = undefined;
      return { installed: true, id: state.id, output: log.join('\n') };
    }

    writeLocalMarketplace();
    const ours = entries.find((plugin) => plugin.id === LOCAL_PLUGIN_ID);
    if (ours) {
      log.push('Copied the latest StatusCraft mod files.');
      const fresh = readJson(path.join(paths.marketplaceDir(), PLUGIN_NAME, '.claude-plugin', 'plugin.json')).value as { version?: string } | undefined;
      if (fresh?.version && ours.version && fresh.version !== ours.version) {
        await step(bin, ['plugin', 'marketplace', 'update', LOCAL_MARKETPLACE, '--json'], log);
        await step(bin, ['plugin', 'update', LOCAL_PLUGIN_ID, '--scope', ours.scope ?? 'user', '--json'], log);
      }
      if (!ours.enabled) await step(bin, ['plugin', 'enable', LOCAL_PLUGIN_ID, '--json'], log);
    } else {
      await ensureMarketplace(bin, log);
      await step(bin, ['plugin', 'install', LOCAL_PLUGIN_ID, '--scope', 'user', '--json'], log);
    }

    // Ask again rather than trust the messages, and keep the answer for the editor's next look
    const after = await pluginState({ fresh: true });
    return { installed: after.installed && after.id === LOCAL_PLUGIN_ID, id: LOCAL_PLUGIN_ID, output: log.join('\n') };
  } catch (error) {
    cache = undefined;
    throw error;
  }
}

export async function uninstallPlugin(): Promise<{ removed: boolean }> {
  const bin = requireClaude();
  const { state, entries } = await inspect(true);
  if (state.error) throw new Error(state.error);

  prepareClaudeSettings();
  const log: string[] = [];
  let removed = false;
  try {
    // Project installs live in a shared, committed file and managed ones belong to an admin
    for (const entry of entries.filter((plugin) => plugin.scope === undefined || plugin.scope === 'user' || plugin.scope === 'local')) {
      const result = await step(bin, ['plugin', 'uninstall', entry.id, '--scope', entry.scope ?? 'user', '--json'], log);
      if (result.outcome === 'ok') removed = true;
    }

    const listed = parseJsonOutput((await runner(bin, ['plugin', 'marketplace', 'list', '--json'], 30_000)).stdout);
    if (Array.isArray(listed) && listed.some((entry: { name?: string }) => entry?.name === LOCAL_MARKETPLACE)) {
      await step(bin, ['plugin', 'marketplace', 'remove', LOCAL_MARKETPLACE, '--json'], log);
    }
    fs.rmSync(paths.marketplaceDir(), { recursive: true, force: true });
    return { removed };
  } finally {
    cache = undefined;
  }
}

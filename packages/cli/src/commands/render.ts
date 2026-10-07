import * as fs from 'node:fs';
import {
  collectNeeds,
  isCommandTrusted,
  currentDir,
  parseStatusInput,
  projectDir,
  renderStatusText,
  resolveLayout,
  type StatusInput,
  type WidgetContext,
} from '@statuscraft/core';
import { loadConfig, loadProject, loadSession } from '../lib/config-store';
import { paths } from '../lib/paths';
import { commandScope, loadCommandTrust } from '../lib/command-trust';
import { runCommands } from '../providers/commands';
import { getGitInfo } from '../providers/git';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Never throws: a status line command that fails makes Claude Code show nothing.
export async function renderFromStdin(stdin: string, now = Date.now(), options: { executeCommands?: boolean } = {}): Promise<string> {
  try {
    const input: StatusInput = parseStatusInput(stdin) ?? {};
    const { config, error } = loadConfig();
    const project = projectDir(input);
    const projectFiles = project ? loadProject(project) : undefined;
    const session = loadSession(input.session_id);

    const { layout, source } = resolveLayout({
      config,
      project: projectFiles?.project,
      local: projectFiles?.local,
      envProfile: process.env['STATUSCRAFT_PROFILE'],
      sessionProfile: session?.profile,
      input,
      home: paths.home(),
    });

    const cwd = currentDir(input) ?? process.cwd();
    const { needs, commands } = collectNeeds(layout);
    const { trust } = loadCommandTrust();
    const scope = commandScope(source === 'project-file' || source === 'local-file' ? project : undefined);
    const approved = options.executeCommands === false ? [] : commands.filter((widget) => isCommandTrusted(trust, { kind: 'statusline', scope, command: widget.commandPath ?? '' }));
    const [git, commandOutput] = await Promise.all([
      needs.has('git') ? getGitInfo(cwd, input.session_id, now) : Promise.resolve(undefined),
      approved.length ? runCommands(approved, { cwd, stdin }) : Promise.resolve({}),
    ]);

    const ctx: WidgetContext = {
      input,
      git,
      companion: session,
      commands: commandOutput,
      now,
      terminalWidth: terminalWidth(),
      home: paths.home(),
      isPreview: false,
    };

    rememberInput(stdin, input);
    const text = renderStatusText(layout, ctx);
    const problem = error ?? projectFiles?.errors[0];
    const warnings = [];
    if (problem) warnings.push('config problem, run "npx statuscraft doctor"');
    if (options.executeCommands !== false && approved.length < commands.length) warnings.push(`commands disabled; review with "npx statuscraft trust${scope === 'global' ? '' : ' --project'}"`);
    return [...warnings.map((warning) => `${YELLOW}⚠ StatusCraft: ${warning}${RESET}`), text].filter(Boolean).join('\n');
  } catch (error) {
    return `${YELLOW}⚠ StatusCraft: ${error instanceof Error ? error.message : String(error)}${RESET}`;
  }
}

// Claude Code sets COLUMNS because the command cannot read the terminal size itself.
function terminalWidth(): number {
  const columns = Number(process.env['COLUMNS']);
  if (Number.isFinite(columns) && columns > 0) return columns;
  return process.stdout.columns || 120;
}

function rememberInput(stdin: string, input: StatusInput): void {
  if (!input.session_id) return;
  try {
    fs.mkdirSync(paths.cacheDir(), { recursive: true });
    fs.writeFileSync(paths.lastInputFile(), stdin);
  } catch {
    // Only the editor preview uses this file
  }
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += (chunk as Buffer).length;
    if (size > 2_000_000) throw new Error('Status line input exceeds 2 MB.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

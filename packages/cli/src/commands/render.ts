import * as fs from 'node:fs';
import {
  collectNeeds,
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
import { runCommands } from '../providers/commands';
import { getGitInfo } from '../providers/git';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Never throws: a status line command that fails makes Claude Code show nothing.
export async function renderFromStdin(stdin: string, now = Date.now()): Promise<string> {
  try {
    const input: StatusInput = parseStatusInput(stdin) ?? {};
    const { config, error } = loadConfig();
    const project = projectDir(input);
    const projectFiles = project ? loadProject(project) : undefined;
    const session = loadSession(input.session_id);

    const { layout } = resolveLayout({
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
    const [git, commandOutput] = await Promise.all([
      needs.has('git') ? getGitInfo(cwd, input.session_id, now) : Promise.resolve(undefined),
      commands.length ? runCommands(commands, { cwd, stdin }) : Promise.resolve({}),
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
    return problem ? `${YELLOW}⚠ StatusCraft: config problem, run "npx statuscraft doctor"${RESET}\n${text}` : text;
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
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

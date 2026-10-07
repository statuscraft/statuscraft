import { isCommandTrusted, layoutCommandApprovals, quickCommands, type CommandApproval } from '@statuscraft/core';
import { approveCommands, commandScope, loadCommandTrust, revokeCommands } from '../lib/command-trust';
import { loadConfig, loadMods, loadProject } from '../lib/config-store';
import { ask, fail, info, ok, warn } from '../lib/ui';

export async function trustCommand(options: { project?: boolean; local?: boolean; mods?: boolean; revoke?: boolean; profile?: string }): Promise<number> {
  if (options.revoke) {
    revokeCommands();
    ok('Revoked every command approval. Commands remain disabled until reviewed again.');
    return 0;
  }
  const loaded = loadConfig();
  if (loaded.error) { fail(loaded.error); return 1; }
  let approvals: CommandApproval[] = [];
  if (options.mods) {
    const mods = loadMods();
    if (mods.error) { fail(mods.error); return 1; }
    approvals = quickCommands(mods.mods).map((command) => ({ kind: 'quick-command', scope: 'global', command: command.command }));
  } else if (options.project || options.local) {
    const project = loadProject(process.cwd());
    if (project.errors.length) { fail(project.errors.join('\n')); return 1; }
    const file = options.local ? project.local : (project.local ?? project.project);
    const layout = file?.layout ?? (file?.profile ? loaded.config.profiles[file.profile] : undefined);
    if (layout) approvals = layoutCommandApprovals(layout, commandScope(process.cwd()));
  } else {
    if (options.profile && !loaded.config.profiles[options.profile]) { fail(`Unknown profile "${options.profile}".`); return 1; }
    const layouts = options.profile ? [loaded.config.profiles[options.profile]!] : Object.values(loaded.config.profiles);
    approvals = layouts.flatMap((layout) => layoutCommandApprovals(layout));
  }
  const { trust, error } = loadCommandTrust();
  if (error) { fail(error); return 1; }
  const pending = approvals.filter((approval) => !isCommandTrusted(trust, approval));
  if (!pending.length) { info('No commands need approval for this selection.'); return 0; }
  warn('These shell commands run with your user permissions, outside Claude Code’s tool approval checks. Review every command before allowing it.');
  info(options.project || options.local ? `Approval applies only to this project: ${process.cwd()}` : 'Approval applies across projects. Commands run in the current working directory.');
  for (const item of pending) console.log(`  ${JSON.stringify(item.command)}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail('Approval needs an interactive terminal. Commands were left disabled. Run this command yourself, or review them in the local editor.');
    return 1;
  }
  if ((await ask('Allow these exact commands? [y/N]: ', 'n')).trim().toLowerCase() !== 'y') {
    info('Commands were left disabled.');
    return 1;
  }
  approveCommands(pending);
  ok('Approved these exact commands. Changed commands require a new approval.');
  return 0;
}

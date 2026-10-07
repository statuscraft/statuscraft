import * as fs from 'node:fs';
import * as path from 'node:path';
import { CommandTrustSchema, isCommandTrusted, type CommandApproval, type CommandTrust } from '@statuscraft/core';
import { readJson, withFileLock, writeJson } from './files';
import { paths } from './paths';

export function commandScope(project?: string): string {
  return project ? `project:${fs.realpathSync(path.resolve(project))}` : 'global';
}

export function loadCommandTrust(): { trust: CommandTrust; error?: string } {
  const loaded = readJson(paths.commandTrustFile());
  const empty: CommandTrust = { version: 1, approvals: [] };
  if (loaded.error) return { trust: empty, error: loaded.error };
  if (loaded.value === undefined) return { trust: empty };
  const parsed = CommandTrustSchema.safeParse(loaded.value);
  return parsed.success ? { trust: parsed.data } : { trust: empty, error: `Invalid command approvals in ${paths.commandTrustFile()}. Commands remain disabled.` };
}

export function approveCommands(approvals: CommandApproval[]): void {
  withFileLock(paths.commandTrustFile(), () => {
    const loaded = loadCommandTrust();
    if (loaded.error) throw new Error(loaded.error);
    const next = { ...loaded.trust, approvals: [...loaded.trust.approvals] };
    for (const approval of approvals) if (!isCommandTrusted(next, approval)) next.approvals.push(approval);
    const parsed = CommandTrustSchema.parse(next);
    writeJson(paths.commandTrustFile(), parsed, { backup: true });
  });
}

export function revokeCommands(): void {
  withFileLock(paths.commandTrustFile(), () => writeJson(paths.commandTrustFile(), { version: 1, approvals: [] }, { backup: true }));
}

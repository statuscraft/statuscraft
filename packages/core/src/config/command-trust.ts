import { z } from 'zod';
import type { Settings } from '../types/settings';

export const CommandApprovalSchema = z.object({
  kind: z.enum(['statusline', 'quick-command']),
  scope: z.string().min(1),
  command: z.string().min(1).max(8192),
});
export const CommandTrustSchema = z.object({
  version: z.literal(1),
  approvals: z.array(CommandApprovalSchema).max(1000),
});
export type CommandApproval = z.infer<typeof CommandApprovalSchema>;
export type CommandTrust = z.infer<typeof CommandTrustSchema>;

export function isCommandTrusted(trust: CommandTrust, approval: CommandApproval): boolean {
  return trust.approvals.some((item) => item.kind === approval.kind && item.scope === approval.scope && item.command === approval.command);
}

export function layoutCommandApprovals(layout: Settings, scope = 'global'): CommandApproval[] {
  return [...new Set(layout.lines.flat().filter((widget) => widget.type === 'custom-command').map((widget) => widget.commandPath).filter((command): command is string => Boolean(command)))].map((command) => ({ kind: 'statusline', scope, command }));
}

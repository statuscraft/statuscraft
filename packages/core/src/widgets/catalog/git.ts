import { defineWidget, readBoolean, readString } from '../define';
import { hyperlink } from '../format';

const REVIEW_ICONS: Record<string, string> = {
  approved: '✓',
  pending: '…',
  changes_requested: '✗',
  draft: '✎',
};

export const gitWidgets = [
  defineWidget({
    type: 'git-branch',
    name: 'Git Branch',
    description: 'The current git branch',
    category: 'git',
    emoji: '🌿',
    defaultColor: 'magenta',
    needs: ['git'],
    options: [{ key: 'aheadBehind', label: 'Show commits ahead/behind', kind: 'toggle', default: false }],
    render(ctx, config) {
      const git = ctx.git;
      const branch = git?.branch ?? git?.sha ?? ctx.input.worktree?.branch;
      if (!branch) return null;
      if (!git || !readBoolean(config, 'aheadBehind', false)) return branch;
      const arrows = (git.ahead ? ` ↑${git.ahead}` : '') + (git.behind ? ` ↓${git.behind}` : '');
      return branch + arrows;
    },
  }),

  defineWidget({
    type: 'git-changes',
    name: 'Git Changes',
    description: 'Lines added and removed but not yet committed (hidden when clean)',
    category: 'git',
    emoji: '✏️',
    defaultColor: 'yellow',
    needs: ['git'],
    render(ctx) {
      const git = ctx.git;
      if (!git || (git.added === 0 && git.deleted === 0)) return null;
      return `+${git.added} -${git.deleted}`;
    },
  }),

  defineWidget({
    type: 'git-status',
    name: 'Git Status',
    description: 'Changed and new files, or a tick when everything is committed',
    category: 'git',
    emoji: '🧺',
    defaultColor: 'yellow',
    needs: ['git'],
    render(ctx) {
      const git = ctx.git;
      if (!git || (!git.branch && !git.sha)) return null;
      if (git.changedFiles === 0 && git.untracked === 0) return '✓ clean';
      const parts = [];
      if (git.changedFiles) parts.push(`✚${git.changedFiles}`);
      if (git.untracked) parts.push(`?${git.untracked}`);
      return parts.join(' ');
    },
  }),

  defineWidget({
    type: 'git-worktree',
    name: 'Git Worktree',
    description: 'The linked worktree you are in, if any',
    category: 'git',
    emoji: '🌳',
    defaultColor: 'green',
    label: 'WT',
    render: (ctx) => ctx.input.workspace?.git_worktree ?? ctx.input.worktree?.name ?? null,
  }),

  defineWidget({
    type: 'repo',
    name: 'Repository',
    description: 'The GitHub/GitLab repository (owner/name)',
    category: 'git',
    emoji: '📦',
    defaultColor: 'brightCyan',
    options: [
      {
        key: 'format', label: 'Show', kind: 'select', default: 'full',
        choices: [{ value: 'full', label: 'owner/name' }, { value: 'name', label: 'name only' }],
      },
    ],
    render(ctx, config) {
      const repo = ctx.input.workspace?.repo;
      if (!repo?.name) return null;
      if (readString(config, 'format', 'full') === 'name' || !repo.owner) return repo.name;
      return `${repo.owner}/${repo.name}`;
    },
  }),

  defineWidget({
    type: 'pull-request',
    name: 'Pull Request',
    description: 'The open PR for this branch and its review state (clickable)',
    category: 'git',
    emoji: '🔀',
    defaultColor: 'brightBlue',
    options: [{ key: 'link', label: 'Make it clickable', kind: 'toggle', default: true }],
    render(ctx, config) {
      const pr = ctx.input.pr;
      if (pr?.number === undefined) return null;
      const prefix = pr.kind === 'mr' ? '!' : '#';
      const state = pr.review_state ? ` ${REVIEW_ICONS[pr.review_state] ?? pr.review_state}` : '';
      const text = `PR ${prefix}${pr.number}${state}`;
      return pr.url && readBoolean(config, 'link', true) ? hyperlink(text, pr.url) : text;
    },
  }),

  defineWidget({
    type: 'lines-changed',
    name: 'Lines Changed',
    description: 'Lines Claude added and removed this session',
    category: 'git',
    emoji: '🧱',
    defaultColor: 'green',
    render(ctx) {
      const cost = ctx.input.cost;
      if (cost?.total_lines_added === undefined) return null;
      return `+${cost.total_lines_added} -${cost.total_lines_removed ?? 0}`;
    },
  }),
];

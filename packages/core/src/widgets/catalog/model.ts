import { defineWidget, readString } from '../define';

export const modelWidgets = [
  defineWidget({
    type: 'model',
    name: 'Model',
    description: 'The Claude model you are talking to',
    category: 'model',
    emoji: '🤖',
    defaultColor: 'cyan',
    options: [
      {
        key: 'format', label: 'Show', kind: 'select', default: 'name',
        choices: [{ value: 'name', label: 'Display name (Opus 5.5)' }, { value: 'id', label: 'Model id (claude-opus-5-5)' }],
      },
    ],
    render(ctx, config) {
      const model = ctx.input.model;
      if (!model) return null;
      const format = readString(config, 'format', 'name');
      return (format === 'id' ? model.id : model.display_name ?? model.id) ?? null;
    },
  }),

  defineWidget({
    type: 'effort',
    name: 'Effort',
    description: 'Reasoning effort level (low to max)',
    category: 'model',
    emoji: '💪',
    defaultColor: 'brightMagenta',
    label: 'Effort',
    render: (ctx) => ctx.input.effort?.level ?? null,
  }),

  defineWidget({
    type: 'thinking',
    name: 'Thinking',
    description: 'Shows when extended thinking is on',
    category: 'model',
    emoji: '💭',
    defaultColor: 'brightBlue',
    render: (ctx) => (ctx.input.thinking?.enabled ? 'thinking' : null),
  }),

  defineWidget({
    type: 'fast-mode',
    name: 'Fast Mode',
    description: 'Shows when fast mode is on',
    category: 'model',
    emoji: '⚡',
    defaultColor: 'brightYellow',
    render: (ctx) => (ctx.input.fast_mode ? '⚡ fast' : null),
  }),

  defineWidget({
    type: 'output-style',
    name: 'Output Style',
    description: 'The active output style',
    category: 'model',
    emoji: '🎨',
    defaultColor: 'yellow',
    label: 'Style',
    render: (ctx) => ctx.input.output_style?.name ?? null,
  }),

  defineWidget({
    type: 'session-name',
    name: 'Session Name',
    description: 'The session title (set with /rename or generated)',
    category: 'model',
    emoji: '🏷️',
    defaultColor: 'white',
    render: (ctx) => ctx.input.session_name ?? null,
  }),

  defineWidget({
    type: 'claude-session-id',
    name: 'Session ID',
    description: 'First characters of the session id',
    category: 'model',
    emoji: '🔑',
    defaultColor: 'brightBlack',
    label: 'SID',
    render: (ctx) => ctx.input.session_id?.slice(0, 8) ?? null,
  }),

  defineWidget({
    type: 'agent',
    name: 'Agent',
    description: 'The agent name when running with --agent',
    category: 'model',
    emoji: '🕵️',
    defaultColor: 'brightCyan',
    label: 'Agent',
    render: (ctx) => ctx.input.agent?.name ?? null,
  }),

  defineWidget({
    type: 'vim-mode',
    name: 'Vim Mode',
    description: 'NORMAL / INSERT when vim mode is on',
    category: 'model',
    emoji: '⌨️',
    defaultColor: 'green',
    render: (ctx) => ctx.input.vim?.mode ?? null,
  }),

  defineWidget({
    type: 'version',
    name: 'Claude Code Version',
    description: 'The Claude Code version',
    category: 'model',
    emoji: '🔖',
    defaultColor: 'brightBlack',
    render: (ctx) => (ctx.input.version ? `v${ctx.input.version}` : null),
  }),
];

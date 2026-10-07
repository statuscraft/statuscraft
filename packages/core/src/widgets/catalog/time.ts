import { defineWidget, readString } from '../define';
import { formatDuration } from '../format';

export const timeWidgets = [
  defineWidget({
    type: 'session-clock',
    name: 'Session Time',
    description: 'How long this session has been running',
    category: 'time',
    emoji: '🕰️',
    defaultColor: 'brightBlack',
    label: 'Session',
    render: (ctx) => {
      const ms = ctx.input.cost?.total_duration_ms;
      return ms === undefined ? null : formatDuration(ms);
    },
  }),

  defineWidget({
    type: 'api-time',
    name: 'API Time',
    description: 'Time spent waiting for Claude to answer',
    category: 'time',
    emoji: '⌛',
    defaultColor: 'brightBlack',
    label: 'API',
    render: (ctx) => {
      const ms = ctx.input.cost?.total_api_duration_ms;
      return ms === undefined ? null : formatDuration(ms);
    },
  }),

  defineWidget({
    type: 'clock',
    name: 'Clock',
    description: 'The current time (add refreshInterval to keep it ticking)',
    category: 'time',
    emoji: '🕐',
    defaultColor: 'white',
    options: [
      {
        key: 'format', label: 'Format', kind: 'select', default: '24h',
        choices: [{ value: '24h', label: '24-hour (14:05)' }, { value: '12h', label: '12-hour (2:05 PM)' }],
      },
    ],
    render(ctx, config) {
      const date = new Date(ctx.now);
      const minutes = String(date.getMinutes()).padStart(2, '0');
      if (readString(config, 'format', '24h') === '12h') {
        const hours = date.getHours() % 12 || 12;
        return `${hours}:${minutes} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
      }
      return `${String(date.getHours()).padStart(2, '0')}:${minutes}`;
    },
  }),

  defineWidget({
    type: 'turn-timer',
    name: 'Turn Timer',
    description: 'How long Claude has been working on your request (needs the StatusCraft plugin)',
    category: 'time',
    emoji: '⏱️',
    defaultColor: 'yellow',
    needs: ['companion'],
    render(ctx) {
      const companion = ctx.companion;
      if (!companion) return null;
      if (companion.turnStartedAt !== undefined) return `⏱ ${formatDuration(ctx.now - companion.turnStartedAt)}`;
      if (companion.lastTurnMs !== undefined) return `last ${formatDuration(companion.lastTurnMs)}`;
      return null;
    },
  }),

  defineWidget({
    type: 'tool-calls',
    name: 'Tool Calls',
    description: 'How many tools Claude has used this session (needs the StatusCraft plugin)',
    category: 'time',
    emoji: '🔧',
    defaultColor: 'brightBlue',
    label: 'Tools',
    needs: ['companion'],
    render: (ctx) => (ctx.companion?.toolCalls === undefined ? null : String(ctx.companion.toolCalls)),
  }),
];

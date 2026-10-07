import { stripAnsi } from '../../ansi/builder';
import { defineWidget, readNumber, readString } from '../define';

export const customWidgets = [
  defineWidget({
    type: 'custom-text',
    name: 'Text',
    description: 'Any text or emoji you like',
    category: 'custom',
    emoji: '💬',
    defaultColor: 'white',
    options: [{ key: 'customText', label: 'Text', kind: 'text', placeholder: '🚀 ship it', default: '' }],
    render: (_ctx, config) => readString(config, 'customText', '') || null,
  }),

  defineWidget({
    type: 'custom-command',
    name: 'Command',
    description: 'The first line printed by a shell command you choose',
    category: 'custom',
    emoji: '🖥️',
    defaultColor: 'white',
    needs: ['command'],
    options: [
      { key: 'commandPath', label: 'Command', kind: 'text', placeholder: 'date +%H:%M', default: '' },
      { key: 'timeout', label: 'Timeout (ms)', kind: 'number', min: 100, max: 5000, default: 1000 },
      { key: 'maxWidth', label: 'Max length', kind: 'number', min: 0, max: 200, default: 0 },
    ],
    render(ctx, config) {
      const output = ctx.commands[config.id];
      if (!output) return ctx.isPreview && config.commandPath ? `$(${config.commandPath})` : null;
      let line = (output.split('\n')[0] ?? '').trim();
      if (!config.preserveColors) line = stripAnsi(line);
      const maxWidth = readNumber(config, 'maxWidth', 0);
      if (maxWidth > 0 && line.length > maxWidth) line = stripAnsi(line).slice(0, Math.max(1, maxWidth - 1)) + '…';
      return line || null;
    },
  }),
];

import { currentDir, projectDir } from '../../input/parse';
import { defineWidget, readNumber, readString } from '../define';
import { shortenHome } from '../format';

export const systemWidgets = [
  defineWidget({
    type: 'current-working-dir',
    name: 'Folder',
    description: 'The folder Claude is working in',
    category: 'system',
    emoji: '📁',
    defaultColor: 'blue',
    options: [
      {
        key: 'base', label: 'Folder', kind: 'select', default: 'current',
        choices: [{ value: 'current', label: 'Current folder' }, { value: 'project', label: 'Project root' }],
      },
      {
        key: 'style', label: 'Style', kind: 'select', default: 'short',
        choices: [{ value: 'short', label: 'Last folder name' }, { value: 'full', label: 'Full path' }],
      },
      { key: 'segments', label: 'Folders to keep (full path)', kind: 'number', min: 0, max: 10, default: 0 },
    ],
    render(ctx, config) {
      const dir = readString(config, 'base', 'current') === 'project' ? projectDir(ctx.input) : currentDir(ctx.input);
      if (!dir) return null;
      const parts = dir.split(/[\\/]/).filter(Boolean);
      if (readString(config, 'style', 'short') === 'short') return parts[parts.length - 1] ?? dir;
      const path = shortenHome(dir, ctx.home);
      const segments = readNumber(config, 'segments', 0);
      if (segments > 0) {
        const pathParts = path.split(/[\\/]/).filter(Boolean);
        if (pathParts.length > segments) return '…/' + pathParts.slice(-segments).join('/');
      }
      return path;
    },
  }),

  defineWidget({
    type: 'terminal-width',
    name: 'Terminal Width',
    description: 'Terminal width in columns',
    category: 'system',
    emoji: '↔️',
    defaultColor: 'brightBlack',
    label: 'Cols',
    render: (ctx) => String(ctx.terminalWidth),
  }),
];

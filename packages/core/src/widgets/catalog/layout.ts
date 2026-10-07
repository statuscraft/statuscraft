import { defineWidget } from '../define';

export const layoutWidgets = [
  defineWidget({
    type: 'separator',
    name: 'Separator',
    description: 'A divider between bricks',
    category: 'layout',
    emoji: '│',
    defaultColor: 'brightBlack',
    options: [{ key: 'character', label: 'Character', kind: 'text', placeholder: '│', default: '│' }],
    render: (_ctx, config) => config.character ?? '│',
  }),

  defineWidget({
    type: 'flex-separator',
    name: 'Spacer',
    description: 'Pushes everything after it to the right edge',
    category: 'layout',
    emoji: '↔',
    defaultColor: 'brightBlack',
    render: () => '',
  }),
];

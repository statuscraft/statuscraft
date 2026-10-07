import { sessionPressure } from '../../input/parse';
import { FACE_STYLES, faceFor } from '../../mascot';
import { defineWidget, readString } from '../define';

export const funWidgets = [
  defineWidget({
    type: 'mood',
    name: 'Pip',
    description: 'Pip the brick mascot: smiles while things are fine, panics when context or limits run out',
    category: 'fun',
    emoji: '🧱',
    defaultColor: 'brightYellow',
    thresholds: {
      hint: 'Pip changes color as the pressure rises',
      defaults: [{ at: 75, tone: 'warn' }, { at: 90, tone: 'danger' }],
    },
    options: [
      {
        key: 'style', label: 'Face style', kind: 'select', default: 'kaomoji',
        choices: Object.entries(FACE_STYLES).map(([value, faces]) => ({ value, label: `${faces.happy} ${faces.panic}  ${value}` })),
      },
    ],
    value: (ctx) => sessionPressure(ctx.input),
    render: (ctx, config) => faceFor(sessionPressure(ctx.input) ?? 0, readString(config, 'style', 'kaomoji')),
  }),
];

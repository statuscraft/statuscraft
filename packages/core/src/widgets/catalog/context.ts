import { contextPercent, contextTokens, contextWindowSize } from '../../input/parse';
import { defineWidget, readBoolean, readNumber, readString } from '../define';
import { BAR_STYLES, formatPercent, formatTokens, progressBar } from '../format';

const CONTEXT_THRESHOLDS = {
  hint: 'Turns yellow, then red, as the context window fills up',
  defaults: [
    { at: 70, tone: 'warn' },
    { at: 90, tone: 'danger' },
  ],
} as const;

// Auto-compact starts before the window is full
const USABLE_SHARE = 0.8;

export const contextWidgets = [
  defineWidget({
    type: 'context-percentage',
    name: 'Context %',
    description: 'How full the context window is',
    category: 'context',
    emoji: '🧠',
    defaultColor: 'green',
    label: 'Ctx',
    thresholds: CONTEXT_THRESHOLDS,
    options: [
      {
        key: 'show', label: 'Show', kind: 'select', default: 'used',
        choices: [{ value: 'used', label: 'Used (42%)' }, { value: 'remaining', label: 'Remaining (58% left)' }],
      },
    ],
    value: (ctx) => contextPercent(ctx.input),
    render(ctx, config) {
      const used = contextPercent(ctx.input);
      if (used === undefined) return null;
      return readString(config, 'show', 'used') === 'remaining'
        ? `${formatPercent(100 - used)} left`
        : formatPercent(used);
    },
  }),

  defineWidget({
    type: 'context-bar',
    name: 'Context Bar',
    description: 'A progress bar of the context window',
    category: 'context',
    emoji: '📊',
    defaultColor: 'green',
    thresholds: CONTEXT_THRESHOLDS,
    options: [
      { key: 'width', label: 'Bar length', kind: 'number', min: 4, max: 30, default: 10 },
      {
        key: 'style', label: 'Bar style', kind: 'select', default: 'blocks',
        choices: Object.keys(BAR_STYLES).map((style) => ({ value: style, label: progressBar(60, 5, style) + '  ' + style })),
      },
      { key: 'percent', label: 'Show number', kind: 'toggle', default: true },
    ],
    value: (ctx) => contextPercent(ctx.input),
    render(ctx, config) {
      const used = contextPercent(ctx.input) ?? (ctx.input.context_window ? 0 : undefined);
      if (used === undefined) return null;
      const bar = progressBar(used, readNumber(config, 'width', 10), readString(config, 'style', 'blocks'));
      return readBoolean(config, 'percent', true) ? `${bar} ${formatPercent(used)}` : bar;
    },
  }),

  defineWidget({
    type: 'context-length',
    name: 'Context Tokens',
    description: 'Tokens in the context window',
    category: 'context',
    emoji: '📏',
    defaultColor: 'brightBlack',
    label: 'Tokens',
    options: [{ key: 'showMax', label: 'Show window size', kind: 'toggle', default: false }],
    render(ctx, config) {
      const tokens = contextTokens(ctx.input);
      if (tokens === undefined) return null;
      const text = formatTokens(tokens);
      return readBoolean(config, 'showMax', false) ? `${text}/${formatTokens(contextWindowSize(ctx.input))}` : text;
    },
  }),

  defineWidget({
    type: 'context-percentage-usable',
    name: 'Usable Context %',
    description: 'Share of the context you can use before auto-compact (80% of the window)',
    category: 'context',
    emoji: '🧯',
    defaultColor: 'green',
    label: 'Usable',
    thresholds: CONTEXT_THRESHOLDS,
    value(ctx) {
      const tokens = contextTokens(ctx.input);
      return tokens === undefined ? undefined : (tokens / (contextWindowSize(ctx.input) * USABLE_SHARE)) * 100;
    },
    render(ctx) {
      const tokens = contextTokens(ctx.input);
      if (tokens === undefined) return null;
      return formatPercent((tokens / (contextWindowSize(ctx.input) * USABLE_SHARE)) * 100);
    },
  }),

  defineWidget({
    type: 'tokens-input',
    name: 'Input Tokens',
    description: 'Input tokens in the context window (cache included)',
    category: 'context',
    emoji: '📥',
    defaultColor: 'blue',
    label: 'In',
    render: (ctx) => {
      const n = ctx.input.context_window?.total_input_tokens;
      return n === undefined ? null : formatTokens(n);
    },
  }),

  defineWidget({
    type: 'tokens-output',
    name: 'Output Tokens',
    description: 'Output tokens of the latest answer',
    category: 'context',
    emoji: '📤',
    defaultColor: 'magenta',
    label: 'Out',
    render: (ctx) => {
      const n = ctx.input.context_window?.total_output_tokens;
      return n === undefined ? null : formatTokens(n);
    },
  }),

  defineWidget({
    type: 'tokens-cached',
    name: 'Cached Tokens',
    description: 'Tokens read from the prompt cache on the latest request',
    category: 'context',
    emoji: '🗄️',
    defaultColor: 'cyan',
    label: 'Cached',
    render: (ctx) => {
      const n = ctx.input.context_window?.current_usage?.cache_read_input_tokens;
      return n === undefined ? null : formatTokens(n);
    },
  }),

  defineWidget({
    type: 'tokens-total',
    name: 'Total Tokens',
    description: 'Input plus output tokens in the context window',
    category: 'context',
    emoji: '🧮',
    defaultColor: 'white',
    label: 'Total',
    render: (ctx) => {
      const window = ctx.input.context_window;
      if (window?.total_input_tokens === undefined) return null;
      return formatTokens(window.total_input_tokens + (window.total_output_tokens ?? 0));
    },
  }),

  defineWidget({
    type: 'prompt-cache',
    name: 'Prompt Cache',
    description: 'Whether the prompt cache is warm, and its hit ratio',
    category: 'context',
    emoji: '🔥',
    defaultColor: 'brightRed',
    label: 'Cache',
    thresholds: { hint: 'Warns as the cache miss rate grows', defaults: [{ at: 30, tone: 'warn' }, { at: 50, tone: 'danger' }] },
    value: (ctx) => {
      const ratio = ctx.input.prompt_cache?.hit_ratio;
      return typeof ratio === 'number' ? (1 - ratio) * 100 : undefined;
    },
    render(ctx) {
      const cache = ctx.input.prompt_cache;
      if (!cache?.caching_observed) return null;
      const state = cache.warm ? 'warm' : 'cold';
      return typeof cache.hit_ratio === 'number' ? `${state} ${formatPercent(cache.hit_ratio * 100)}` : state;
    },
  }),
];

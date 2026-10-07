import type { RateLimitWindow, StatusInput } from '../../input/types';
import { defineWidget, readBoolean, type WidgetDefinition } from '../define';
import { formatCost, formatCountdown, formatPercent } from '../format';

const LIMIT_THRESHOLDS = {
  hint: 'Turns yellow, then red, as you use up the limit',
  defaults: [
    { at: 70, tone: 'warn' },
    { at: 90, tone: 'danger' },
  ],
} as const;

function rateLimitWidget(
  type: string,
  name: string,
  label: string,
  pick: (limits: NonNullable<StatusInput['rate_limits']>) => RateLimitWindow | undefined,
): WidgetDefinition {
  return defineWidget({
    type,
    name,
    description: `How much of your ${name.toLowerCase()} you have used (Pro and Max plans)`,
    category: 'usage',
    emoji: '🚦',
    defaultColor: 'green',
    label,
    thresholds: LIMIT_THRESHOLDS,
    options: [{ key: 'reset', label: 'Show time until reset', kind: 'toggle', default: true }],
    value: (ctx) => (ctx.input.rate_limits ? pick(ctx.input.rate_limits)?.used_percentage : undefined),
    render(ctx, config) {
      const window = ctx.input.rate_limits ? pick(ctx.input.rate_limits) : undefined;
      if (window?.used_percentage === undefined) return null;
      const used = formatPercent(window.used_percentage);
      if (!readBoolean(config, 'reset', true) || window.resets_at === undefined) return used;
      return `${used} ↻${formatCountdown(window.resets_at, ctx.now)}`;
    },
  });
}

export const usageWidgets = [
  defineWidget({
    type: 'session-cost',
    name: 'Session Cost',
    description: 'Estimated cost of this session in USD',
    category: 'usage',
    emoji: '💵',
    defaultColor: 'green',
    label: 'Cost',
    thresholds: { hint: 'Warns when a session gets expensive (in dollars)', defaults: [{ at: 5, tone: 'warn' }, { at: 20, tone: 'danger' }] },
    value: (ctx) => ctx.input.cost?.total_cost_usd,
    render: (ctx) => {
      const usd = ctx.input.cost?.total_cost_usd;
      return usd === undefined ? null : formatCost(usd);
    },
  }),

  rateLimitWidget('rate-limit-5h', '5-hour limit', '5h', (limits) => limits.five_hour),
  rateLimitWidget('rate-limit-7d', 'Weekly limit', '7d', (limits) => limits.seven_day),

  defineWidget({
    type: 'block-timer',
    name: 'Block Timer',
    description: 'Time left until your 5-hour usage window resets',
    category: 'usage',
    emoji: '⏳',
    defaultColor: 'brightBlack',
    label: 'Reset in',
    render(ctx) {
      const resetsAt = ctx.input.rate_limits?.five_hour?.resets_at;
      return resetsAt === undefined ? null : formatCountdown(resetsAt, ctx.now);
    },
  }),

  defineWidget({
    type: 'spend-limit',
    name: 'Spend Limit',
    description: 'Spend against your gateway spend limit',
    category: 'usage',
    emoji: '🏦',
    defaultColor: 'green',
    label: 'Spend',
    thresholds: LIMIT_THRESHOLDS,
    value: (ctx) => ctx.input.rate_limits?.spend_limit?.used_percentage,
    render(ctx) {
      const limit = ctx.input.rate_limits?.spend_limit;
      if (!limit) return null;
      if (limit.used_usd !== undefined && limit.limit_usd !== undefined) {
        return `${formatCost(limit.used_usd)}/${formatCost(limit.limit_usd)}`;
      }
      return limit.used_percentage === undefined ? null : formatPercent(limit.used_percentage);
    },
  }),
];

export type MergeMode = boolean | 'no-padding';

export type Tone = 'warn' | 'danger';

export interface Threshold {
  readonly at: number;
  readonly tone: Tone;
}

export interface WidgetConfig {
  readonly id: string;
  readonly type: string;

  readonly color?: string;
  readonly backgroundColor?: string;
  readonly bold?: boolean;

  readonly rawValue?: boolean;
  readonly merge?: MergeMode;

  readonly thresholds?: readonly Threshold[];

  readonly metadata?: Readonly<Record<string, string>>;

  readonly character?: string;

  readonly customText?: string;

  readonly commandPath?: string;
  readonly maxWidth?: number;
  readonly timeout?: number;
  readonly preserveColors?: boolean;
}

export function isLayoutWidget(type: string): boolean {
  return type === 'separator' || type === 'flex-separator';
}

export function generateWidgetId(): string {
  return Math.random().toString(36).slice(2, 10);
}

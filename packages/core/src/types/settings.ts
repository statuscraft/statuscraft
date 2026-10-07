import type { WidgetConfig } from './widget';
import type { ColorLevel } from './color';

export type FlexMode = 'full' | 'full-minus-40' | 'full-until-compact';

export interface PowerlineConfig {
  readonly enabled: boolean;
  readonly separators: readonly string[];
  readonly separatorInvertBackground: readonly boolean[];
  readonly startCaps: readonly string[];
  readonly endCaps: readonly string[];
  readonly theme?: string;
  readonly autoAlign: boolean;
}

export interface Settings {
  readonly version: number;
  readonly lines: readonly (readonly WidgetConfig[])[];

  readonly terminalApp?: string;
  readonly terminalTheme?: string;

  readonly flexMode: FlexMode;
  readonly compactThreshold: number;
  readonly colorLevel: ColorLevel;

  readonly defaultSeparator?: string;
  readonly defaultPadding?: string;
  readonly inheritSeparatorColors: boolean;

  readonly overrideBackgroundColor?: string;
  readonly overrideForegroundColor?: string;
  readonly globalBold: boolean;

  readonly powerline: PowerlineConfig;
}

export const CURRENT_SETTINGS_VERSION = 3;

export function createDefaultSettings(): Settings {
  return {
    version: CURRENT_SETTINGS_VERSION,
    lines: [
      [
        { id: 'model', type: 'model', color: 'cyan', bold: true },
        {
          id: 'context',
          type: 'context-percentage',
          color: 'green',
          thresholds: [
            { at: 70, tone: 'warn' },
            { at: 90, tone: 'danger' },
          ],
        },
        { id: 'branch', type: 'git-branch', color: 'magenta' },
        { id: 'changes', type: 'git-changes', color: 'yellow' },
      ],
    ],
    flexMode: 'full-minus-40',
    compactThreshold: 60,
    colorLevel: 2,
    defaultSeparator: ' │ ',
    inheritSeparatorColors: false,
    globalBold: false,
    powerline: {
      enabled: false,
      separators: ['\uE0B0'],
      separatorInvertBackground: [false],
      startCaps: [],
      endCaps: [],
      autoAlign: false,
    },
  };
}

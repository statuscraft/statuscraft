export const POWERLINE_SEPARATORS = {
  arrow: { left: '\uE0B0', right: '\uE0B2', leftThin: '\uE0B1', rightThin: '\uE0B3' },
  round: { left: '\uE0B4', right: '\uE0B6' },
  slash: { left: '\uE0BC', right: '\uE0BE' },
  slashThin: { left: '\uE0BD', right: '\uE0BF' },
  flame: { left: '\uE0C0', right: '\uE0C2' },
  pixel: { left: '\uE0C4', right: '\uE0C5' },
} as const;

export type PowerlineSeparatorStyle = keyof typeof POWERLINE_SEPARATORS;

export function getSeparatorStyles(): PowerlineSeparatorStyle[] {
  return Object.keys(POWERLINE_SEPARATORS) as PowerlineSeparatorStyle[];
}

export const POWERLINE_FONTS = [
  'MesloLGS NF',
  'FiraCode Nerd Font',
  'JetBrains Mono NF',
  'JetBrainsMono Nerd Font',
  'Hack Nerd Font',
  'CaskaydiaCove Nerd Font',
  'DejaVuSansMono Nerd Font',
  'RobotoMono Nerd Font',
  'SourceCodePro Nerd Font',
  'UbuntuMono Nerd Font',
] as const;

export type PowerlineFont = (typeof POWERLINE_FONTS)[number];

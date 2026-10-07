import { PRESETS } from '@statuscraft/core';
import { loadConfig, saveConfig } from '../lib/config-store';
import { c, fail, ok } from '../lib/ui';
import { brokenConfig, previewLayout } from './setup';

export function profileCommand(args: string[]): number {
  const { config, error } = loadConfig();
  if (error) return brokenConfig(error);
  const [action, name] = args;

  if (action === 'use') {
    if (!name || !config.profiles[name]) {
      fail(`No profile called "${name ?? ''}". You have: ${Object.keys(config.profiles).join(', ')}`);
      return 1;
    }
    saveConfig({ ...config, activeProfile: name });
    ok(`Now using profile ${c.bold(name)}`);
    return 0;
  }

  for (const [profileName, layout] of Object.entries(config.profiles)) {
    const marker = profileName === config.activeProfile ? c.green('●') : c.dim('○');
    console.log(`${marker} ${c.bold(profileName)}`);
    console.log(`  ${previewLayout(layout).split('\n').join('\n  ')}\n`);
  }
  if (config.rules.length) {
    console.log(c.bold('Rules'));
    for (const rule of config.rules) console.log(`  ${JSON.stringify(rule.match)} → ${rule.profile}`);
  }
  console.log(c.dim(`Switch with: npx statuscraft profile use <name>`));
  return 0;
}

export function presetsCommand(): number {
  for (const preset of PRESETS) {
    console.log(`${preset.emoji} ${c.bold(preset.name)} ${c.dim(`(${preset.id})`)} ${c.dim('- ' + preset.description)}`);
    console.log(`  ${previewLayout(preset.layout).split('\n').join('\n  ')}\n`);
  }
  console.log(c.dim('Use one with: npx statuscraft apply <id>'));
  return 0;
}

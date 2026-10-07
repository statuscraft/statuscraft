import {
  createScenarioContext,
  decodeShareCode,
  getPreset,
  isShareCode,
  parseLayout,
  PRESETS,
  renderStatusText,
  type Settings,
  type StatusCraftConfig,
} from '@statuscraft/core';
import { readJson } from '../lib/files';
import { getInstallState, install, uninstall } from '../lib/claude-settings';
import { loadConfig, saveConfig, saveProjectFile } from '../lib/config-store';
import { ask, c, fail, info, ok, pip, warn } from '../lib/ui';

export function previewLayout(layout: Settings): string {
  return renderStatusText(layout, createScenarioContext('busy', { terminalWidth: 110 }));
}

// Saving on top of defaults would wipe every profile in a file that only has a typo
export function brokenConfig(error: string): number {
  fail(`Your config file has a problem: ${error}`);
  info('Fix it, or delete it to start fresh. Nothing was changed.');
  return 1;
}

export async function initCommand(options: { preset?: string; yes?: boolean }): Promise<number> {
  pip("Hi! Let's build your status line. It takes ten seconds.");
  const loaded = loadConfig();
  if (loaded.error) return brokenConfig(loaded.error);
  let config = loaded.config;

  if (loaded.importedFrom && !options.preset) {
    ok(`Kept your CCStatuskit look (imported from ${loaded.importedFrom})`);
  } else if (!loaded.exists || options.preset) {
    const preset = options.preset ? getPreset(options.preset) : await choosePreset(options.yes);
    if (!preset) {
      fail(`Unknown preset "${options.preset}". Run ${c.cyan('npx statuscraft presets')} to see them all.`);
      return 1;
    }
    config = withActiveLayout(config, preset.layout);
    ok(`Using the ${preset.emoji} ${c.bold(preset.name)} look`);
    if (preset.needsNerdFont) warn('This look uses powerline arrows. If you see boxes instead, install a Nerd Font (https://www.nerdfonts.com).');
  }

  saveConfig(config);
  ok(`Saved ${c.dim(loaded.path)}`);
  return installCommand();
}

async function choosePreset(yes?: boolean) {
  if (yes) return PRESETS[0];
  console.log(c.bold('Pick a starter kit:\n'));
  PRESETS.forEach((preset, index) => {
    console.log(`  ${c.bold(String(index + 1))}. ${preset.emoji} ${c.bold(preset.name)} ${c.dim('- ' + preset.description)}`);
    console.log(`     ${previewLayout(preset.layout).split('\n').join('\n     ')}\n`);
  });
  const answer = await ask(`Your choice ${c.dim('[1]')}: `, '1');
  return PRESETS[Number(answer) - 1] ?? getPreset(answer) ?? PRESETS[0];
}

export function installCommand(): number {
  const state = getInstallState();
  if (state.error) {
    fail(state.error);
    return 1;
  }
  try {
    const result = install();
    ok(`Claude Code now uses StatusCraft ${c.dim('(' + result.settingsFile + ')')}`);
    if (state.configured && !state.ours) info('Your previous status line is saved. "npx statuscraft uninstall" brings it back.');
    if (state.disabledByHooksSetting) warn('"disableAllHooks" is on in your Claude Code settings, which hides every status line.');
    pip(`All done! Your status line appears after Claude's next answer.\n           Want to change it? Run ${c.cyan('npx statuscraft')} to open the brick editor.`);
    return 0;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function uninstallCommand(): number {
  try {
    const { restored, notOurs } = uninstall();
    if (notOurs) {
      info('Claude Code is not using StatusCraft right now, so its settings are left as they are.');
      return 0;
    }
    ok(restored ? 'Restored your previous status line.' : 'Removed StatusCraft from Claude Code.');
    info('Your StatusCraft settings are kept, in case you come back.');
    return 0;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export async function applyCommand(source: string | undefined, options: { profile?: string; project?: boolean; local?: boolean }): Promise<number> {
  if (!source) {
    fail('Tell me what to apply: a preset name, a share code (sc1.…) or a .json file.');
    return 1;
  }
  const layout = loadLayoutFrom(source);
  if (!layout.ok) {
    fail(layout.error);
    return 1;
  }

  if (options.project || options.local) {
    const file = saveProjectFile(process.cwd(), options.local ? 'local' : 'project', { layout: layout.value });
    ok(`Saved this layout for this project in ${c.dim(file)}`);
  } else {
    const { config, error } = loadConfig();
    if (error) return brokenConfig(error);
    saveConfig(withActiveLayout(config, layout.value, options.profile));
    ok(`Saved to profile ${c.bold(options.profile ?? config.activeProfile)}`);
  }
  console.log('\n  ' + previewLayout(layout.value).split('\n').join('\n  ') + '\n');
  if (!getInstallState().ours) info(`Run ${c.cyan('npx statuscraft init')} to switch Claude Code over to StatusCraft.`);
  return 0;
}

function loadLayoutFrom(source: string): { ok: true; value: Settings } | { ok: false; error: string } {
  if (isShareCode(source)) return decodeShareCode(source);
  const preset = getPreset(source);
  if (preset) return { ok: true, value: preset.layout };
  const file = readJson(source);
  if (file.error) return { ok: false, error: file.error };
  if (file.value === undefined) return { ok: false, error: `"${source}" is not a preset, a share code or a file.` };
  return parseLayout(file.value);
}

export function withActiveLayout(config: StatusCraftConfig, layout: Settings, profile = config.activeProfile): StatusCraftConfig {
  return { ...config, activeProfile: profile, profiles: { ...config.profiles, [profile]: layout } };
}

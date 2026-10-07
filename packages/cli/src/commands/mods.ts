import { getMod, MOD_SLOTS, slotOf } from '@statuscraft/core';
import { installPlugin, MODS_MIN_CLAUDE, pluginState, uninstallPlugin, type PluginState } from '../lib/claude-plugins';
import { loadMods } from '../lib/config-store';
import { c, fail, info, ok, warn } from '../lib/ui';

export async function modsCommand(args: string[]): Promise<number> {
  const [action] = args;
  if (action === 'install') return modsInstallCommand();
  if (action === 'uninstall' || action === 'remove') return modsUninstallCommand();
  if (action !== undefined && action !== 'list') {
    fail(`Unknown mods action "${action}". Try ${c.cyan('npx statuscraft mods')}, ${c.cyan('mods install')} or ${c.cyan('mods uninstall')}.`);
    return 1;
  }

  const loaded = loadMods();
  if (loaded.error) {
    fail(`Your mods file has a problem: ${loaded.error}`);
    return 1;
  }
  if (!loaded.mods.mods.length) {
    info(`No mods placed yet. Open the editor with ${c.cyan('npx statuscraft')} and drag some in.`);
  } else {
    console.log(`${c.bold('Your mods')} ${c.dim(loaded.path)}\n`);
    const slots = [...MOD_SLOTS.map((slot) => ({ id: slot.id as string, title: `${slot.emoji} ${slot.name}` })), { id: 'other', title: '❔ Unknown' }];
    for (const slot of slots) {
      const placed = loaded.mods.mods.filter((mod) => (slotOf(mod) ?? 'other') === slot.id);
      if (!placed.length) continue;
      console.log(`  ${c.bold(slot.title)}`);
      for (const mod of placed) {
        const definition = getMod(mod.type);
        const name = definition ? `${definition.emoji} ${definition.name}` : mod.type;
        console.log(`    ${mod.enabled ? c.green('●') : c.dim('○')} ${name}${mod.enabled ? '' : c.dim(' (off)')}`);
      }
      console.log('');
    }
  }

  printPluginState(await pluginState(), loaded.mods.mods.length > 0);
  return 0;
}

export function printPluginState(state: PluginState, hasMods: boolean): number {
  let problems = 0;
  // Without placed mods nothing is broken yet, so these are only hints
  const problem = (text: string) => {
    if (!hasMods) return warn(text);
    problems++;
    fail(text);
  };

  if (!state.claude.found) {
    problem('Claude Code was not found, so mods cannot be set up. Install it from https://claude.com/claude-code.');
    return problems;
  }
  if (!state.modsSupported) {
    problem(`Claude Code ${state.claude.version ?? '(unknown version)'} is too old for mods. They need ${MODS_MIN_CLAUDE} or newer: run ${c.cyan('claude update')}.`);
  } else {
    ok(`Claude Code ${state.claude.version} ${c.dim(state.claude.path ?? '')}`);
  }

  if (state.error) problem(state.error);
  else if (state.installed && state.enabled) ok(`The StatusCraft mod is on in Claude Code ${c.dim(`(${state.id})`)}`);
  else if (state.installed) problem(`The StatusCraft mod is installed but turned off. Run ${c.cyan('npx statuscraft mods install')} to turn it on.`);
  else if (hasMods) problem(`The StatusCraft mod is not in Claude Code yet, so your mods do not run. Run ${c.cyan('npx statuscraft mods install')}.`);
  else info(`The StatusCraft mod is not in Claude Code. ${c.cyan('npx statuscraft mods install')} adds it.`);

  if (state.disabledByHooksSetting) warn('"disableAllHooks" is true in your Claude Code settings, so mods do not run.');
  return problems;
}

async function modsInstallCommand(): Promise<number> {
  info('Adding the StatusCraft mod to Claude Code…');
  try {
    const result = await installPlugin();
    for (const line of result.output.split('\n').filter(Boolean)) info(c.dim(line));
    if (!result.installed) {
      fail(`Claude Code did not list ${result.id} afterwards. Run ${c.cyan('npx statuscraft doctor')} to find out why.`);
      return 1;
    }
    ok(`The StatusCraft mod is ready ${c.dim(`(${result.id})`)}`);
    info('Start a new Claude Code session (or type /reload-plugins) to see your mods.');
    if (!loadMods().mods.mods.length) info(`No mods placed yet. Open the editor with ${c.cyan('npx statuscraft')} and drag some in.`);
    return 0;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function modsUninstallCommand(): Promise<number> {
  try {
    const { removed } = await uninstallPlugin();
    ok(removed ? 'Removed the StatusCraft mod from Claude Code.' : 'The StatusCraft mod was not installed, so there was nothing to remove.');
    info('Your placed mods are kept, in case you come back.');
    return 0;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

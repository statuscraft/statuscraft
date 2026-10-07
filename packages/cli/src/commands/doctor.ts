import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createScenarioContext, PRESETS, resolveLayout } from '@statuscraft/core';
import { pluginState } from '../lib/claude-plugins';
import { getInstallState } from '../lib/claude-settings';
import { loadConfig, loadMods, loadProject } from '../lib/config-store';
import { paths } from '../lib/paths';
import { c, fail, info, ok, pip, warn } from '../lib/ui';
import { printPluginState } from './mods';
import { renderFromStdin } from './render';

export async function doctorCommand(): Promise<number> {
  pip("Let's check your setup.");
  let problems = 0;
  const problem = (text: string) => {
    problems++;
    fail(text);
  };

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok(`Node.js ${process.versions.node}`);
  else problem(`Node.js ${process.versions.node} is too old. StatusCraft needs Node.js 20 or newer.`);

  const loaded = loadConfig();
  if (loaded.error) problem(`Your config has a problem: ${loaded.error}`);
  else if (!loaded.exists) warn(`No config yet. Run ${c.cyan('npx statuscraft init')}.`);
  else ok(`Config ${c.dim(loaded.path)}: ${Object.keys(loaded.config.profiles).length} profile(s), active "${loaded.config.activeProfile}"`);

  const state = getInstallState();
  if (state.error) problem(state.error);
  else if (!state.configured) problem(`Claude Code has no status line. Run ${c.cyan('npx statuscraft init')}.`);
  else if (!state.ours) warn(`Claude Code uses another status line: ${c.dim(state.command ?? '')}`);
  else {
    ok(`Claude Code runs StatusCraft ${c.dim(state.command ?? '')}`);
    if (!fs.existsSync(paths.renderScript()) && !state.command?.includes('dev')) {
      problem(`The renderer is missing at ${paths.renderScript()}. Run ${c.cyan('npx statuscraft init')} again.`);
    }
  }
  if (state.disabledByHooksSetting) problem('"disableAllHooks" is true in your Claude Code settings, so no status line is drawn.');

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    ok('git is available');
  } catch {
    warn('git was not found, so git widgets stay empty.');
  }

  const project = loadProject(process.cwd());
  for (const error of project.errors) problem(error);
  const here = resolveLayout({ config: loaded.config, project: project.project, local: project.local, envProfile: process.env['STATUSCRAFT_PROFILE'], home: paths.home() });
  info(`In this folder StatusCraft draws ${here.profile ? `profile "${here.profile}"` : 'a layout'} (chosen by: ${here.source})`);

  const sample = createScenarioContext('busy').input;
  const output = await renderFromStdin(JSON.stringify({ ...sample, session_id: undefined }), Date.now(), { executeCommands: false });
  console.log(`\n  ${c.dim('Sample render:')}\n  ${output.split('\n').join('\n  ')}\n`);

  if (process.env['COLORTERM'] === 'truecolor' || process.env['COLORTERM'] === '24bit') {
    info('Your terminal supports millions of colors. Set "Colors" to "True color" in the editor for the richest look.');
  }
  info(`Powerline check: if you see arrows here → ${'\uE0B0'} ${'\uE0B4'} ← your font is ready for the ${PRESETS.filter((p) => p.needsNerdFont).map((p) => p.name).join(', ')} looks.`);

  console.log(`\n${c.bold('Mods')}`);
  const mods = loadMods();
  if (mods.error) problem(`Your mods file has a problem: ${mods.error}`);
  else if (!mods.exists) info(`No mods placed yet. Open the editor with ${c.cyan('npx statuscraft')} to add some.`);
  else ok(`Mods ${c.dim(mods.path)}: ${mods.mods.mods.length} placed, ${mods.mods.mods.filter((mod) => mod.enabled).length} on`);
  problems += printPluginState(await pluginState(), mods.mods.mods.some((mod) => mod.enabled));

  console.log('');
  if (problems === 0) ok(c.bold('Everything looks good!'));
  else fail(c.bold(`${problems} problem(s) found.`));
  return problems === 0 ? 0 : 1;
}

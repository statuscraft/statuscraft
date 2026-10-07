#!/usr/bin/env node
import { applyCommand, initCommand, installCommand, uninstallCommand } from './commands/setup';
import { trustCommand } from './commands/trust';
import { doctorCommand } from './commands/doctor';
import { editCommand } from './commands/edit';
import { modsCommand } from './commands/mods';
import { presetsCommand, profileCommand } from './commands/profiles';
import { readStdin, renderFromStdin } from './commands/render';
import { c } from './lib/ui';
import { VERSION } from './version';

const HELP = `
${c.bold('StatusCraft')} ${c.dim(VERSION)}: build your Claude Code status line from bricks.

${c.bold('Start here')}
  npx statuscraft init              pick a look and switch Claude Code over
  npx statuscraft                   open the drag-and-drop brick editor

${c.bold('More')}
  npx statuscraft presets           show every starter kit
  npx statuscraft apply <what>      use a preset, a share code (sc1.…) or a .json file
        --profile <name>            save into this profile
        --project / --local         save for this project (shared / just you)
  npx statuscraft profile           list profiles
  npx statuscraft profile use <n>   switch profile
  npx statuscraft mods              list the mods you placed in the editor
  npx statuscraft mods install      add the StatusCraft mod to Claude Code
  npx statuscraft mods uninstall    take it out again (your mods are kept)
  npx statuscraft trust             review shell commands before enabling them
        --project / --local         approve commands for this project only
        --mods                      review Quick Command mods
        --revoke                    disable all previously approved commands
  npx statuscraft doctor            find out why something does not show
  npx statuscraft uninstall         put your old status line back
  npx statuscraft render            draw the status line from JSON on stdin

${c.bold('Editor options')}
  --port <n>                        use this port (default 3847)
  --no-open                         do not open a browser
`;

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  // `statuscraft --no-open` and `statuscraft --port 4000` mean the editor, as the help says
  const editorFlag = argv[0] === '--no-open' || argv[0] === '--port';
  const [command, ...args] = editorFlag ? ['edit', ...argv] : argv;

  // Claude Code pipes JSON in: act as the status line itself
  if (command === 'render' || (!command && !process.stdin.isTTY)) {
    const output = await renderFromStdin(await readStdin());
    await new Promise<void>((resolve) => process.stdout.write(output ? output + '\n' : '', () => resolve()));
    return 0;
  }

  switch (command) {
    case undefined:
    case 'edit':
      return editCommand({ port: Number(option(args, '--port')) || undefined, open: !flag(args, '--no-open') });
    case 'init':
      return initCommand({ preset: option(args, '--preset') ?? args.find((a) => !a.startsWith('-')), yes: flag(args, '--yes') || flag(args, '-y') });
    case 'install':
      return installCommand();
    case 'uninstall':
      return uninstallCommand();
    case 'apply':
      return applyCommand(args.find((a) => !a.startsWith('-') && a !== option(args, '--profile')), {
        profile: option(args, '--profile'),
        project: flag(args, '--project'),
        local: flag(args, '--local'),
      });
    case 'presets':
      return presetsCommand();
    case 'profile':
    case 'profiles':
      return profileCommand(args);
    case 'mods':
    case 'mod':
      return modsCommand(args);
    case 'trust':
      return trustCommand({ project: flag(args, '--project'), local: flag(args, '--local'), mods: flag(args, '--mods'), revoke: flag(args, '--revoke'), profile: option(args, '--profile') });
    case 'doctor':
      return doctorCommand();
    case '--version':
    case '-v':
      console.log(VERSION);
      return 0;
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      return 0;
    default:
      console.log(HELP);
      console.log(c.red(`Unknown command "${command}"`));
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);

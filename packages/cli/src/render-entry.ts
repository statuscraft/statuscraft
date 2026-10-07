import { readStdin, renderFromStdin } from './commands/render';

const output = await renderFromStdin(await readStdin());
// Exit once the line is out: nothing left running may hold up Claude Code's status line
process.stdout.write(output ? output + '\n' : '', () => process.exit(0));

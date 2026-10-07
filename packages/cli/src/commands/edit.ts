import { spawn } from 'node:child_process';
import * as net from 'node:net';
import { createServer } from '../server';
import { c, info, pip } from '../lib/ui';

const DEFAULT_PORT = 3847;

export async function editCommand(options: { port?: number; open?: boolean }): Promise<number> {
  const port = options.port ?? (await freePort(DEFAULT_PORT));
  const server = createServer({ port, projectDir: process.cwd() });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  const url = `http://localhost:${port}`;
  pip(`The brick box is open at ${c.cyan(url)}`);
  info('Drag bricks, pick a look, then press "Apply to Claude Code".');
  info(`Press ${c.bold('Ctrl+C')} here when you are done.`);
  if (options.open !== false) openBrowser(url);

  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  server.close();
  console.log('\nBye! 👋');
  return 0;
}

async function freePort(start: number): Promise<number> {
  for (let port = start; port < start + 50; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = net.createServer();
      probe.once('error', () => resolve(false));
      probe.once('listening', () => probe.close(() => resolve(true)));
      probe.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error(`No free port between ${start} and ${start + 49}`);
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [url]] :
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    ['xdg-open', [url]];
  try {
    spawn(command as string, args as string[], { detached: true, stdio: 'ignore' }).on('error', () => undefined).unref();
  } catch {
    // The URL is printed, so it can be opened by hand
  }
}

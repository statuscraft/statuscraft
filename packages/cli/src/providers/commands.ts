import { spawn, type ChildProcess } from 'node:child_process';
import type { WidgetConfig } from '@statuscraft/core';

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_OUTPUT = 4096;

// Each command gets Claude Code's JSON on stdin, so it can use jq on the same data.
export async function runCommands(
  widgets: readonly WidgetConfig[],
  options: { cwd?: string; stdin: string },
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  let index = 0;
  const deadline = Date.now() + 5000;
  // A large shared layout must not spawn hundreds of processes at once.
  await Promise.all(Array.from({ length: Math.min(4, widgets.length) }, async () => {
    while (index < widgets.length) {
      const widget = widgets[index++]!;
      const remaining = deadline - Date.now();
      results[widget.id] = remaining <= 0 ? null : await runCommand({ ...widget, timeout: Math.min(widget.timeout ?? DEFAULT_TIMEOUT_MS, remaining) }, options);
    }
  }));
  return results;
}

// Stop the command and everything it started: a program the shell launched would otherwise
// keep the output pipe open, and the status line would wait for it.
function killTree(child: ChildProcess): void {
  try {
    if (process.platform !== 'win32' && child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
    else if (child.pid !== undefined) {
      // Killing cmd.exe alone leaves the shell's children running on Windows.
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill());
    } else child.kill();
  } catch {
    // Already gone
  }
}

function runCommand(widget: WidgetConfig, options: { cwd?: string; stdin: string }): Promise<string | null> {
  const command = widget.commandPath;
  if (!command) return Promise.resolve(null);
  const timeout = widget.timeout && widget.timeout > 0 ? Math.min(5000, Math.max(100, widget.timeout)) : DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.destroy();
      child.unref();
      resolve(value);
    };

    // Its own process group, so killTree reaches the whole pipeline
    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const timer = setTimeout(() => {
      killTree(child);
      finish(null);
    }, timeout);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      // Enough for any status line: keep what arrived instead of waiting for the rest
      if (output.length > MAX_OUTPUT) {
        killTree(child);
        finish(output.slice(0, MAX_OUTPUT));
      }
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code === 0 ? output : null));
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.stdin);
  });
}

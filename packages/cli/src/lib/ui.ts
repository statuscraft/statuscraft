import * as readline from 'node:readline/promises';
import { MASCOT_NAME } from '@statuscraft/core';

const useColor = process.stdout.isTTY && !process.env['NO_COLOR'];
const paint = (code: string) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);

export const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  magenta: paint('35'),
  cyan: paint('36'),
};

export function pip(message: string): void {
  const brick = useColor ? '\x1b[33m' : '';
  const reset = useColor ? '\x1b[0m' : '';
  const lines = [
    `${brick}  ▗▖  ▗▖ ${reset}`,
    `${brick} ▐█████▌${reset}  ${c.bold(MASCOT_NAME + ':')} ${message}`,
    `${brick} ▐▌◕‿◕▐▌${reset}`,
    `${brick} ▝▀▀▀▀▀▘${reset}`,
  ];
  console.log('\n' + lines.join('\n') + '\n');
}

export const ok = (text: string) => console.log(`${c.green('✔')} ${text}`);
export const warn = (text: string) => console.log(`${c.yellow('!')} ${text}`);
export const fail = (text: string) => console.log(`${c.red('✘')} ${text}`);
export const info = (text: string) => console.log(`${c.dim('·')} ${text}`);

export async function ask(question: string, fallback = ''): Promise<string> {
  if (!process.stdin.isTTY) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, fallback = true): Promise<boolean> {
  const answer = (await ask(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `, fallback ? 'y' : 'n')).toLowerCase();
  return answer.startsWith('y');
}

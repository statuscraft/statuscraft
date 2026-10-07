import * as fs from 'node:fs';
import * as path from 'node:path';

export function readJson(file: string): { value?: unknown; error?: string } {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `${file} is not valid JSON (${error instanceof Error ? error.message : String(error)})` };
  }
}

// Write to a temp file and rename, so a crash never leaves half a file.
export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

export function removeFile(file: string): void {
  fs.rmSync(file, { force: true });
}

export function fileExists(file: string): boolean {
  return fs.existsSync(file);
}

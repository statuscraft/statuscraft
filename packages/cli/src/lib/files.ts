import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export class ConfigConflictError extends Error {}

export function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readJson(file: string): { value?: unknown; error?: string; raw?: string } {
  let raw: string | undefined;
  try {
    raw = readText(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (raw === undefined) return {};
  try {
    return { value: JSON.parse(raw), raw };
  } catch (error) {
    return { raw, error: `${file} is not valid JSON (${error instanceof Error ? error.message : String(error)})` };
  }
}

function assertRegularFile(file: string): void {
  try {
    if (!fs.lstatSync(file).isFile()) throw new Error(`Refusing to replace ${file}: it is not a regular file (symlinks are left untouched).`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// Serialize StatusCraft transactions. Never remove a possibly live lock automatically.
export function withFileLock<T>(file: string, action: () => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.statuscraft.lock`;
  let fd: number;
  try {
    fd = fs.openSync(lock, 'wx', 0o600);
  } catch (error) {
    throw new Error(`Cannot lock ${file}. Another StatusCraft operation may be running; if it stopped, remove ${lock} and retry. ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created: new Date().toISOString() }));
    return action();
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lock, { force: true });
  }
}

function writePrivateFile(file: string, text: string): void {
  const fd = fs.openSync(file, 'wx', 0o600);
  let complete = false;
  try {
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    complete = true;
  } finally {
    fs.closeSync(fd);
    if (!complete) fs.rmSync(file, { force: true });
  }
}

// Keep the first pre-install snapshot too, without ever replacing it.
export function backupOnce(file: string): string | undefined {
  assertRegularFile(file);
  const raw = readText(file);
  if (raw === undefined) return undefined;
  const backup = `${file}.before-statuscraft`;
  assertRegularFile(backup);
  if (fileExists(backup)) return backup;
  writePrivateFile(backup, raw);
  return backup;
}

export function backupFile(file: string, backupBase = file): string | undefined {
  assertRegularFile(file);
  const raw = readText(file);
  if (raw === undefined) return undefined;
  return backupText(backupBase, raw);
}

function backupText(file: string, raw: string): string {
  const dir = `${file}.backups`;
  if (fs.existsSync(dir) && !fs.lstatSync(dir).isDirectory()) throw new Error(`Refusing to write backups to ${dir}: it is not a regular directory.`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const backup = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  writePrivateFile(backup, raw);
  return backup;
}

export interface WriteOptions {
  backup?: boolean;
  // An explicit undefined means the caller expects a missing file.
  expected?: string;
}

// User-config callers hold withFileLock across their read and write. Compare content
// before committing too, to detect edits by programs that do not use our lock.
export function writeJson(file: string, value: unknown, options: WriteOptions = {}): { backup?: string } {
  return writeText(file, JSON.stringify(value, null, 2) + '\n', options);
}

export function writeText(file: string, text: string, options: WriteOptions = {}): { backup?: string } {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  assertRegularFile(file);
  const current = readText(file);
  if ('expected' in options && current !== options.expected) throw new ConfigConflictError(`${file} changed while saving. Reload it and try again; nothing was overwritten.`);
  if (current === text) return {};
  const backup = options.backup && current !== undefined ? backupText(file, current) : undefined;
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    writePrivateFile(temp, text);
    assertRegularFile(file);
    if (readText(file) !== current) throw new ConfigConflictError(`${file} changed while saving. Reload it and try again; nothing was overwritten.`);
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  return backup ? { backup } : {};
}

export function removeFile(file: string): void {
  fs.rmSync(file, { force: true });
}

export function fileExists(file: string): boolean {
  return fs.existsSync(file);
}

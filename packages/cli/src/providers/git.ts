import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { GIT_DIFF_ARGS, GIT_STATUS_ARGS, parseGitStatus, parseShortstat, type GitInfo } from '@statuscraft/core';
import { readJson, writeJson } from '../lib/files';
import { paths } from '../lib/paths';

const CACHE_MS = 5_000;
const TIMEOUT_MS = 1_500;

// Cached per session for a few seconds: Claude Code redraws often and large repos are slow.
export async function getGitInfo(cwd: string, sessionId = 'default', now = Date.now()): Promise<GitInfo | undefined> {
  const key = createHash('sha1').update(`${sessionId}:${cwd}`).digest('hex').slice(0, 16);
  const cacheFile = paths.gitCacheFile(key);
  const cached = readJson(cacheFile).value as { at: number; info: GitInfo | null } | undefined;
  if (cached && now - cached.at < CACHE_MS) return cached.info ?? undefined;

  const info = await readGit(cwd);
  try {
    writeJson(cacheFile, { at: now, info: info ?? null });
  } catch {
    // A read-only cache only costs speed
  }
  return info;
}

async function readGit(cwd: string): Promise<GitInfo | undefined> {
  const [status, diff] = await Promise.all([git(cwd, GIT_STATUS_ARGS), git(cwd, GIT_DIFF_ARGS)]);
  if (status === undefined) return undefined;
  return { ...parseGitStatus(status), ...parseShortstat(diff ?? '') };
}

function git(cwd: string, args: readonly string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      resolve(error ? undefined : stdout);
    });
  });
}

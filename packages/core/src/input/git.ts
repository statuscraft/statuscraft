import type { GitInfo } from './types';

// Shared by the status line and the plugin, so both read git the same way
export const GIT_STATUS_ARGS = ['--no-optional-locks', 'status', '--porcelain=v2', '--branch'] as const;
export const GIT_DIFF_ARGS = ['--no-optional-locks', 'diff', '--shortstat', 'HEAD'] as const;

// Reads `git status --porcelain=v2 --branch`. Its headers carry the commit too, so a
// detached HEAD (rebase, bisect, a checked-out tag) still has something to show.
export function parseGitStatus(text: string): Pick<GitInfo, 'branch' | 'sha' | 'changedFiles' | 'untracked' | 'ahead' | 'behind'> {
  let branch: string | undefined;
  let sha: string | undefined;
  let ahead = 0;
  let behind = 0;
  let changedFiles = 0;
  let untracked = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim();
      if (head && head !== '(detached)') branch = head;
    } else if (line.startsWith('# branch.oid ')) {
      const oid = line.slice('# branch.oid '.length).trim();
      if (/^[0-9a-f]{7,}$/.test(oid)) sha = oid.slice(0, 7);
    } else if (line.startsWith('# branch.ab ')) {
      const counts = /\+(\d+) -(\d+)/.exec(line);
      ahead = Number(counts?.[1] ?? 0);
      behind = Number(counts?.[2] ?? 0);
    } else if (line.startsWith('? ')) {
      untracked++;
    } else if (/^[12u] /.test(line)) {
      changedFiles++;
    }
  }
  return { branch, sha, changedFiles, untracked, ahead, behind };
}

export function parseShortstat(text: string): Pick<GitInfo, 'added' | 'deleted'> {
  return {
    added: Number(/(\d+) insertion/.exec(text)?.[1] ?? 0),
    deleted: Number(/(\d+) deletion/.exec(text)?.[1] ?? 0),
  };
}

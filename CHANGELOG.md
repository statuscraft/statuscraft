# Changelog

## 1.1.0

This release hardens setup, recovery and shell-command execution. The bundled Claude Code plugin is 1.2.0.

- Back up existing Claude settings before first creating StatusCraft configuration or invoking Claude's plugin installer. Keep the original `settings.json.before-statuscraft` snapshot and additional timestamped snapshots.
- Back up valid and malformed StatusCraft config, mods, project files and command approvals before replacing them; also back up project files before removal and legacy config before import.
- Stop on read errors, failed backups, invalid status-line settings or invalid recovery records. Leave symlinked settings/config files untouched.
- Replace files atomically, use private file permissions where supported, serialize StatusCraft mutations, and reject detected concurrent edits and stale editor saves.
- Identify the exact installed renderer instead of claiming any command containing `statuscraft`. Preserve unrelated status lines and their recovery records.
- Disable Command widgets and Quick Command mods until the user reviews and approves their exact commands. Approvals are kept separately from shareable designs, project approvals are bound to the real project folder, and changes/revocation take effect without reusing old approvals.
- Add `statuscraft trust`, `--project`, `--local`, `--profile`, `--mods` and `--revoke`, plus command review in the local editor. Existing custom commands also need approval after upgrading.
- Bound command concurrency, timeout and input size; terminate command process trees on Windows as well as POSIX. Diagnostic sample rendering does not execute commands.
- Preserve Claude's existing denies and deny when a failed enabled guard cannot verify the permission decision.
- Reject cross-origin editor requests, missing project data and static path traversal into sibling directories.

Approved shell commands and mods still run with the user's permissions. Guard widgets are not a sandbox. See the README's backup and command safety guide.

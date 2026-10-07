# StatusCraft plugin for Claude Code

The optional companion to the [StatusCraft](https://github.com/statuscraft/statuscraft) status line. It is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) and needs Claude Code 2.1.287 or newer.

```
/plugin marketplace add statuscraft/statuscraft
/plugin install statuscraft@statuscraft
```

It adds:

- `/statuscraft setup`: switch Claude Code over to StatusCraft (runs `npx statuscraft init --yes`)
- `/statuscraft profile <name>`: use a profile in this session only (`reset` to go back)
- `/statuscraft doctor`: check why something does not show
- the data behind the **Turn Timer** and **Tool Calls** bricks
- the **mods** you place in the StatusCraft editor (`npx statuscraft`, Mods tab)

## Mods

The editor saves your mods to `~/.config/statuscraft/mods.json`. The plugin checks that file every two seconds, so **Apply** in the editor takes effect in a running session. With no file, or a file it cannot read, the plugin behaves as if you had placed no mods.

| Where | Mods | What the plugin does |
| --- | --- | --- |
| Above the prompt | Live Status Line, Context Meter, Banner Text, Burn Rate, Limit Bars | Draws a band above the prompt box. The Live Status Line renders a profile from `config.json` and redraws every few seconds, so clocks and timers tick. Burn Rate and Limit Bars read cost, session length and the 5-hour and weekly limits. Other mods' bands stay, under it. |
| Spinner | Tool Counter, Turn Timer, Active Tool, Pip, Spinner Words | Adds text after the "Thinking" word (Active Tool: the tool running now in the main conversation), or swaps the word |
| Tool calls | Tool Timer | Adds the time to a finished tool call's row when it was slower than your mark. The time runs from when Claude asked for the tool, so it includes a permission prompt you answered. |
| Under each answer | Turn Summary | Adds a line under each answer: time, tools, tokens, context |
| Prompt hint | Prompt Hint | Replaces the hint line under an empty prompt (Claude Code's own hint stays while you type or Claude works) |
| Pop-up alerts | Context Alert, Limit Alert, Done Alert | A toast once when context or the 5-hour limit crosses your mark, or when an answer took longer than your mark (not when you interrupted it) |
| Safety guards | Danger Guard, Protected Files | Turns an allowed `rm -rf`, force push or `git reset --hard`, or an edit to a protected file (`.env`, keys, lockfiles, `.git/`), into a question. Guards only ever ask: they never approve a call and never lift a deny. |
| Prompt shortcuts | Prompt Shortcuts | `;tests` and the like grow into their full prompt when you send it. Nothing else in a prompt changes. |
| Slash commands | Quick Command | Adds `/<name>`, which runs your shell command (`sh -c`, in the session's folder, 30 s limit) and prints its output after you explicitly approve the exact command in the local editor or with `npx statuscraft trust --mods` |

## What it reads, writes and runs

As `claude plugin validate packages/plugin` lists it:

- **Writes** `~/.cache/statuscraft/sessions/<session id>.json` (turn timer, tool count, session profile) for the status line
- **Reads** `~/.config/statuscraft/trusted-commands.json` before each Quick Command, `~/.config/statuscraft/mods.json`, `~/.config/statuscraft/config.json`, `~/.cache/statuscraft/last-input.json` (what the status line saw last, for figures the mods API lacks), and `~/.claude/settings.json` (once, to suggest `/statuscraft setup`)
- **Reads** the session's context use, rate limits, cost, model and folder from Claude Code, only while a mod that shows them is placed
- **Runs** `git branch --show-current` (or `git status` and `git diff --shortstat` for a Live Status Line with git bricks) at most every 10 seconds, only when a placed mod shows the branch; your Quick Commands when you type them; `npx statuscraft@<version>` (the CLI release this plugin was built with) only for `/statuscraft setup` and `/statuscraft doctor`
- It never changes your tool calls, and changes a prompt only to grow the `;shortcuts` you placed. The guards can only make Claude Code ask you first.

`STATUSCRAFT_CONFIG_DIR`, `STATUSCRAFT_CACHE_DIR`, `XDG_CONFIG_HOME` and `XDG_CACHE_HOME` move those folders, as they do for the CLI.

Quick Commands remain disabled when approvals are missing, malformed, revoked or do not match the current command text. An approval also trusts the programs/scripts the command invokes; changes to those files are not tracked. Guards are best-effort checks for supported tool calls, not a sandbox, and do not protect against arbitrary shell scripts or processes started by mods. The plugin preserves existing deny decisions and never approves tool calls for you.

To remove the mod, run `npx statuscraft mods uninstall`. `npx statuscraft uninstall` removes only the separate status line. Start `claude --safe-mode` if a mod disrupts a session. See the main README's [backup and safety guide](../../README.md#backups-and-command-safety).

## Developing

A hooks module can import only its own files, so `hooks/vendor/core.js` is `@statuscraft/core` bundled by `scripts/build.ts`. Rebuild it after changing core, and commit it, since the plugin is installed straight from this folder:

```
bun run build:plugin
claude plugin validate packages/plugin
claude plugin test packages/plugin
claude --plugin-dir packages/plugin     # try it in a session; reloads when you save
```

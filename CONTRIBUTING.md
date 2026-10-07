# Contributing to StatusCraft

Thanks for helping! This guide gets you from clone to pull request.

## Setup

You need [Bun](https://bun.sh) 1.1 or newer, and Node.js 20 or newer.

```sh
bun install
bun run dev        # editor on http://localhost:5173, API on :3847
bun run test       # unit tests (Vitest)
bun run typecheck
bun run lint
bun run build      # editor + CLI bundles in packages/cli/dist
```

Try the CLI from source without touching your real setup:

```sh
export STATUSCRAFT_CONFIG_DIR=/tmp/sc/config STATUSCRAFT_CACHE_DIR=/tmp/sc/cache CLAUDE_CONFIG_DIR=/tmp/sc/claude
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":42}}' | bun packages/cli/src/index.ts render
bun packages/cli/src/index.ts presets
```

## How the code is organized

```
packages/
  core/     Pure TypeScript, no Node APIs. Runs in the CLI and in the browser.
    input/      The JSON Claude Code sends, plus preview scenarios
    widgets/    The brick catalog (catalog/*.ts) and the registry
    renderer/   Layout + plain/powerline ANSI output
    config/     Config schema, profiles, rules, presets, share codes
    mascot/     Pip's faces
    mods/       The mod catalog, mods.json schema, and what each mod shows
  cli/      The `statuscraft` command: render, init, doctor, apply, editor server
    lib/        Files StatusCraft owns, Claude Code settings, terminal UI
    providers/  git and custom commands (the only places that run programs)
    server/     The local API the editor talks to (node:http, no framework)
  editor/   The React brick editor (Vite, Tailwind, dnd-kit, zustand)
  plugin/   The Claude Code mod: /statuscraft, turn timer, tool count, and the mods from mods.json
```

The rule that keeps it simple: **widgets never do I/O**. The CLI gathers data first (stdin, git, command output, plugin stats), then every widget is a pure function of that data. That is why the editor can preview everything in the browser.

## Add a brick

1. Pick the file in `packages/core/src/widgets/catalog/` that matches the category.
2. Add an entry:

   ```ts
   defineWidget({
     type: 'lines-today',          // stable id saved in configs: never rename it
     name: 'Lines Today',
     description: 'Lines Claude changed this session',
     category: 'git',
     emoji: '📈',
     defaultColor: 'green',
     label: 'Lines',               // shown as "Lines 42" unless the user hides labels
     render: (ctx) => {
       const added = ctx.input.cost?.total_lines_added;
       return added === undefined ? null : String(added); // null hides the brick
     },
   }),
   ```

3. Need new data? Add the field to `StatusInput` in `core/src/input/types.ts` (mirroring the [status line docs](https://code.claude.com/docs/en/statusline#available-data)) and to the scenarios in `samples.ts`, so the preview shows it.
4. Offer warning colors with `thresholds` and a `value()` that returns a number where higher is worse.
5. Offer settings with `options`. The editor builds the form for you.
6. Run `bun run test` (every widget is rendered in every scenario) and `bun run docs` to refresh `docs/widgets.md`.

## Add a mod

Mods are data, not code: the editor writes `mods.json`, and the one StatusCraft mod in `packages/plugin` reads it. That keeps the mod's list of hooks and calls fixed, so `claude plugin validate` can review it once.

1. Add an entry to `MODS` in `packages/core/src/mods/catalog.ts` (a stable `type`, a `slot`, `options` like a brick's).
2. Teach `packages/core/src/mods/runtime.ts` what it shows. Keep it a pure function of `ModContext`: the editor preview and the real mod both call it, so they always match.
3. If it needs a new Claude Code event, wire it in `packages/plugin/hooks/register.ts`, then `bun run build:plugin` and `claude plugin test packages/plugin`.
4. Add tests to `packages/core/src/mods/mods.test.ts` and, for the editor, `e2e/mods.spec.ts`.

## The plugin

`packages/plugin` is a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview). Work on it with:

```sh
claude --plugin-dir packages/plugin        # loads it and reloads on save
claude plugin validate packages/plugin
bun run test:plugin                         # claude plugin test
```

It talks to the CLI only through `~/.cache/statuscraft/sessions/<session id>.json`. Keep the path rules in `hooks/register.ts` and `cli/src/lib/paths.ts` in sync.

## Pull requests

- One topic per PR, with tests for new behavior.
- `bun run lint && bun run typecheck && bun run test` must pass.
- UI changes: add a screenshot.
- Write user-facing text for someone who has never seen a terminal: short, friendly, no jargon.

## Releasing

Bump the version in `packages/cli/package.json` and `packages/cli/src/version.ts`, then push a `v*` tag. CI builds and publishes `statuscraft` to npm.

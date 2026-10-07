import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConfigSchema, ProjectConfigSchema } from '@statuscraft/core';
import { copyPluginFiles } from '../src/lib/claude-plugins';

const root = path.resolve(import.meta.dir, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

async function bundle(entry: string, outfile: string, shebang: boolean): Promise<void> {
  const result = await Bun.build({
    entrypoints: [path.join(root, entry)],
    target: 'node',
    format: 'esm',
    minify: true,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Failed to bundle ${entry}`);
  }
  const code = (await result.outputs[0]!.text()).replace(/^#!.*\n/, '');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, outfile), (shebang ? '#!/usr/bin/env node\n' : '') + code);
  if (shebang) fs.chmodSync(path.join(dist, outfile), 0o755);
}

// The mod ships inside the CLI, so "statuscraft mods install" can hand it to Claude Code
const pluginDir = path.resolve(root, '../plugin');
const pluginBuild = path.join(pluginDir, 'scripts', 'build.ts');
if (fs.existsSync(pluginBuild)) {
  execFileSync(process.execPath, ['run', pluginBuild], { cwd: path.resolve(root, '../..'), stdio: 'inherit' });
} else {
  console.warn('! packages/plugin/scripts/build.ts not found: the mod is copied without its vendored files');
}

await bundle('src/index.ts', 'statuscraft.js', true);
await bundle('src/render-entry.ts', 'statuscraft-render.mjs', false);

const editorDist = path.resolve(root, '../editor/dist');
if (fs.existsSync(editorDist)) {
  fs.cpSync(editorDist, path.join(dist, 'editor'), { recursive: true });
} else {
  console.warn('! editor/dist not found: build the editor first (bun run build at the repo root does both)');
}

copyPluginFiles(pluginDir, path.join(dist, 'plugin'));

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'StatusCraft config',
  description: 'User config (~/.config/statuscraft/config.json) or project file (.claude/statuscraft.json)',
  anyOf: [
    zodToJsonSchema(ConfigSchema, { target: 'jsonSchema7', $refStrategy: 'none' }),
    zodToJsonSchema(ProjectConfigSchema, { target: 'jsonSchema7', $refStrategy: 'none' }),
  ],
};
fs.writeFileSync(path.join(root, 'schema.json'), JSON.stringify(schema, null, 2) + '\n');

// Ship the project license and upstream notices with the code.
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  fs.copyFileSync(path.resolve(root, '../..', file), path.join(root, file));
}

// npm shows the package README; point its images and links at GitHub
const readme = fs.readFileSync(path.resolve(root, '../../README.md'), 'utf8');
fs.writeFileSync(
  path.join(root, 'README.md'),
  readme.replace(/(src|href)="(?!https?:)([^"]+)"/g, '$1="https://raw.githubusercontent.com/statuscraft/statuscraft/main/$2"')
    .replace(/\]\((?!https?:|#)([^)]+)\)/g, '](https://github.com/statuscraft/statuscraft/blob/main/$1)'),
);

for (const file of fs.readdirSync(dist)) {
  const stat = fs.statSync(path.join(dist, file));
  console.log(`  ${file.padEnd(28)} ${stat.isDirectory() ? 'dir' : (stat.size / 1024).toFixed(1) + ' KB'}`);
}

import * as os from 'node:os';
import * as path from 'node:path';

export const paths = {
  home(): string {
    return os.homedir();
  },

  configDir(): string {
    const override = process.env['STATUSCRAFT_CONFIG_DIR'];
    if (override) return override;
    const xdg = process.env['XDG_CONFIG_HOME'];
    return path.join(xdg || path.join(os.homedir(), '.config'), 'statuscraft');
  },

  configFile(): string {
    return path.join(paths.configDir(), 'config.json');
  },

  modsFile(): string {
    return path.join(paths.configDir(), 'mods.json');
  },

  // A local Claude Code marketplace that serves the StatusCraft mod
  marketplaceDir(): string {
    return path.join(paths.configDir(), 'marketplace');
  },

  renderScript(): string {
    return path.join(paths.configDir(), 'bin', 'statuscraft-render.mjs');
  },

  previousStatusLineFile(): string {
    return path.join(paths.configDir(), 'previous-statusline.json');
  },

  legacyConfigFile(): string {
    return path.join(os.homedir(), '.config', 'ccstatuskit', 'settings.json');
  },

  cacheDir(): string {
    const override = process.env['STATUSCRAFT_CACHE_DIR'];
    if (override) return override;
    const xdg = process.env['XDG_CACHE_HOME'];
    return path.join(xdg || path.join(os.homedir(), '.cache'), 'statuscraft');
  },

  sessionFile(sessionId: string): string {
    return path.join(paths.cacheDir(), 'sessions', `${sanitize(sessionId)}.json`);
  },

  gitCacheFile(key: string): string {
    return path.join(paths.cacheDir(), 'git', `${sanitize(key)}.json`);
  },

  lastInputFile(): string {
    return path.join(paths.cacheDir(), 'last-input.json');
  },

  claudeSettingsFile(): string {
    const dir = process.env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
    return path.join(dir, 'settings.json');
  },

  projectFile(projectDir: string): string {
    return path.join(projectDir, '.claude', 'statuscraft.json');
  },

  localProjectFile(projectDir: string): string {
    return path.join(projectDir, '.claude', 'statuscraft.local.json');
  },
};

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

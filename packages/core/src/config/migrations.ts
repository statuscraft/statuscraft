import { CURRENT_SETTINGS_VERSION } from '../types/settings';

type Migration = (data: unknown) => unknown;

const migrations: Record<number, Migration> = {
  1: (data: unknown) => {
    const obj = data as Record<string, unknown>;
    obj['version'] = 1;
    return obj;
  },

  2: (data: unknown) => {
    const obj = data as Record<string, unknown>;

    obj['version'] = 2;

    const lines = obj['lines'] as unknown[][] | undefined;
    if (lines) {
      obj['lines'] = lines.map((line, lineIndex) =>
        line.map((widget, widgetIndex) => {
          const w = widget as Record<string, unknown>;
          if (!w['id']) {
            w['id'] = `${lineIndex}-${widgetIndex}`;
          }
          return w;
        })
      );
    }

    return obj;
  },

  3: (data: unknown) => {
    const obj = data as Record<string, unknown>;

    obj['version'] = 3;

    if (!obj['powerline']) {
      obj['powerline'] = {
        enabled: false,
        separators: ['\uE0B0'],
        separatorInvertBackground: [false],
        startCaps: [],
        endCaps: [],
        autoAlign: false,
      };
    } else {
      const pl = obj['powerline'] as Record<string, unknown>;
      if (!Array.isArray(pl['separators'])) {
        pl['separators'] = [pl['separator'] ?? '\uE0B0'];
        delete pl['separator'];
      }
      if (!Array.isArray(pl['separatorInvertBackground'])) {
        pl['separatorInvertBackground'] = [false];
      }
      if (!Array.isArray(pl['startCaps'])) {
        pl['startCaps'] = [];
      }
      if (!Array.isArray(pl['endCaps'])) {
        pl['endCaps'] = [];
      }
    }

    return obj;
  },
};

export function needsMigration(data: unknown, targetVersion: number): boolean {
  if (typeof data !== 'object' || data === null) {
    return true;
  }

  const obj = data as Record<string, unknown>;
  const version = typeof obj['version'] === 'number' ? obj['version'] : 0;

  return version < targetVersion;
}

export function getVersion(data: unknown): number {
  if (typeof data !== 'object' || data === null) {
    return 0;
  }

  const obj = data as Record<string, unknown>;
  return typeof obj['version'] === 'number' ? obj['version'] : 0;
}

export function migrateConfig(
  data: unknown,
  targetVersion: number = CURRENT_SETTINGS_VERSION
): unknown {
  let currentVersion = getVersion(data);
  let result = data;

  while (currentVersion < targetVersion) {
    const nextVersion = currentVersion + 1;
    const migration = migrations[nextVersion];

    if (!migration) {
      console.error(`No migration found for version ${nextVersion}`);
      break;
    }

    try {
      result = migration(result);
      currentVersion = nextVersion;
    } catch (error) {
      console.error(`Migration to version ${nextVersion} failed:`, error);
      break;
    }
  }

  return result;
}

export function validateMigration(data: unknown, expectedVersion: number): boolean {
  const version = getVersion(data);
  return version === expectedVersion;
}

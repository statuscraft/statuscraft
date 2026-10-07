import { describe, it, expect } from 'vitest';
import { needsMigration, getVersion, migrateConfig, validateMigration } from './migrations';

describe('migrations', () => {
  describe('getVersion', () => {
    it('returns 0 for data without version', () => {
      expect(getVersion({})).toBe(0);
      expect(getVersion({ lines: [] })).toBe(0);
    });

    it('returns version from data', () => {
      expect(getVersion({ version: 2 })).toBe(2);
      expect(getVersion({ version: 3 })).toBe(3);
    });

    it('returns 0 for invalid data', () => {
      expect(getVersion(null)).toBe(0);
      expect(getVersion(undefined)).toBe(0);
      expect(getVersion('string')).toBe(0);
    });
  });

  describe('needsMigration', () => {
    it('returns true when version is lower', () => {
      expect(needsMigration({ version: 1 }, 3)).toBe(true);
      expect(needsMigration({ version: 2 }, 3)).toBe(true);
    });

    it('returns false when version matches', () => {
      expect(needsMigration({ version: 3 }, 3)).toBe(false);
    });

    it('returns true for data without version', () => {
      expect(needsMigration({}, 3)).toBe(true);
    });

    it('returns false when version is higher', () => {
      expect(needsMigration({ version: 4 }, 3)).toBe(false);
    });

    it('returns true for invalid data types', () => {
      expect(needsMigration(null, 3)).toBe(true);
      expect(needsMigration('string', 3)).toBe(true);
    });
  });

  describe('migrateConfig', () => {
    it('migrates v0 to v1 (unversioned to versioned)', () => {
      const v0 = {
        lines: [[{ type: 'model' }]],
      };

      const migrated = migrateConfig(v0, 1) as Record<string, unknown>;

      expect(migrated['version']).toBe(1);
    });

    it('migrates v0 to v2', () => {
      const v0 = {
        lines: [
          [{ type: 'model' }],
        ],
      };

      const migrated = migrateConfig(v0, 2) as Record<string, unknown>;

      expect(migrated['version']).toBe(2);
      const lines = migrated['lines'] as unknown[][];
      expect((lines[0]?.[0] as Record<string, unknown>)?.['id']).toBeDefined();
    });

    it('migrates v2 to v3', () => {
      const v2 = {
        version: 2,
        lines: [[{ id: '1', type: 'model' }]],
      };

      const migrated = migrateConfig(v2, 3) as Record<string, unknown>;

      expect(migrated['version']).toBe(3);
      expect(migrated['powerline']).toBeDefined();

      const powerline = migrated['powerline'] as Record<string, unknown>;
      expect(powerline['enabled']).toBe(false);
      expect(Array.isArray(powerline['separators'])).toBe(true);
    });

    it('migrates through multiple versions (v0 to v3)', () => {
      const v0 = {
        lines: [
          [{ type: 'model' }],
        ],
      };

      const migrated = migrateConfig(v0, 3) as Record<string, unknown>;

      expect(migrated['version']).toBe(3);
      expect(migrated['powerline']).toBeDefined();
    });

    it('handles old powerline format with single separator', () => {
      const v2WithOldPowerline = {
        version: 2,
        lines: [[{ id: '1', type: 'model' }]],
        powerline: {
          enabled: true,
          separator: '\uE0B2',  // Old format with single separator
        },
      };

      const migrated = migrateConfig(v2WithOldPowerline, 3) as Record<string, unknown>;
      const powerline = migrated['powerline'] as Record<string, unknown>;

      expect(Array.isArray(powerline['separators'])).toBe(true);
      expect((powerline['separators'] as string[])[0]).toBe('\uE0B2');
      expect(powerline['separator']).toBeUndefined();
    });

    it('preserves existing powerline arrays during v2 to v3 migration', () => {
      const v2WithNewPowerline = {
        version: 2,
        lines: [[{ id: '1', type: 'model' }]],
        powerline: {
          enabled: true,
          separators: ['\uE0B0', '\uE0B2'],
          separatorInvertBackground: [false, true],
        },
      };

      const migrated = migrateConfig(v2WithNewPowerline, 3) as Record<string, unknown>;
      const powerline = migrated['powerline'] as Record<string, unknown>;

      expect(powerline['separators']).toEqual(['\uE0B0', '\uE0B2']);
      expect(powerline['separatorInvertBackground']).toEqual([false, true]);
    });

    it('does not modify data already at target version', () => {
      const v3 = {
        version: 3,
        lines: [[{ id: '1', type: 'model' }]],
        powerline: {
          enabled: true,
          separators: ['\uE0B0'],
        },
      };

      const migrated = migrateConfig(v3, 3) as Record<string, unknown>;

      expect(migrated['version']).toBe(3);
      expect(migrated).toEqual(v3);
    });

    it('adds widget IDs based on line and widget index', () => {
      const v0 = {
        lines: [
          [{ type: 'model' }, { type: 'separator' }],
          [{ type: 'git-branch' }],
        ],
      };

      const migrated = migrateConfig(v0, 2) as Record<string, unknown>;
      const lines = migrated['lines'] as unknown[][];

      expect((lines[0]?.[0] as Record<string, unknown>)?.['id']).toBe('0-0');
      expect((lines[0]?.[1] as Record<string, unknown>)?.['id']).toBe('0-1');
      expect((lines[1]?.[0] as Record<string, unknown>)?.['id']).toBe('1-0');
    });

    it('preserves existing widget IDs', () => {
      const v1 = {
        version: 1,
        lines: [
          [{ id: 'custom-id', type: 'model' }, { type: 'separator' }],
        ],
      };

      const migrated = migrateConfig(v1, 2) as Record<string, unknown>;
      const lines = migrated['lines'] as unknown[][];

      expect((lines[0]?.[0] as Record<string, unknown>)?.['id']).toBe('custom-id');
      expect((lines[0]?.[1] as Record<string, unknown>)?.['id']).toBe('0-1');
    });
  });

  describe('validateMigration', () => {
    it('returns true for matching version', () => {
      expect(validateMigration({ version: 3 }, 3)).toBe(true);
    });

    it('returns false for non-matching version', () => {
      expect(validateMigration({ version: 2 }, 3)).toBe(false);
    });

    it('returns false for data without version', () => {
      expect(validateMigration({}, 3)).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { SettingsSchema } from './schemas';
import { createDefaultSettings } from './settings';

describe('Settings Schema', () => {
  it('validates default settings', () => {
    const defaults = createDefaultSettings();
    const result = SettingsSchema.safeParse(defaults);

    expect(result.success).toBe(true);
  });

  it('applies defaults for missing fields', () => {
    const minimal = {
      lines: [[{ id: '1', type: 'model' }]],
    };

    const result = SettingsSchema.parse(minimal);

    expect(result.version).toBe(3);
    expect(result.flexMode).toBe('full-minus-40');
    expect(result.colorLevel).toBe(2);
  });

  it('accepts unknown widget types so newer share codes still load', () => {
    const result = SettingsSchema.safeParse({ lines: [[{ id: '1', type: 'from-the-future' }]] });

    expect(result.success).toBe(true);
  });

  it('rejects widgets without a type', () => {
    const result = SettingsSchema.safeParse({ lines: [[{ id: '1', type: '' }]] });

    expect(result.success).toBe(false);
  });
});

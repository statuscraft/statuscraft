import { describe, it, expect } from 'vitest';

describe('Core Package', () => {
  it('should be importable', async () => {
    const core = await import('./index');
    expect(core).toBeDefined();
  });
});

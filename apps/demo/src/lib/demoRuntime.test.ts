import { describe, expect, it } from 'vitest';
import { normalizeHex } from './demoRuntime';

describe('normalizeHex', () => {
  it('normalizes short and hash-less inputs', () => {
    expect(normalizeHex('abc')).toBe('#aabbcc');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('A1B2C3')).toBe('#A1B2C3');
  });

  it('falls back to white for invalid values', () => {
    expect(normalizeHex('')).toBe('#ffffff');
    expect(normalizeHex('zzzzzz')).toBe('#ffffff');
    expect(normalizeHex('#12')).toBe('#ffffff');
  });
});

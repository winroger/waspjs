import { describe, expect, it } from 'vitest';
import { availableSets } from './availableSets';

describe('availableSets', () => {
  it('discovers at least one demo set', () => {
    expect(availableSets.length).toBeGreaterThan(0);
  });

  it('provides normalized shape and stable sorting', () => {
    for (const set of availableSets) {
      expect(set.slug).toBeTruthy();
      expect(set.name).toBeTruthy();
      expect(set.path.startsWith('examples/')).toBe(true);
      expect(set.aggregation).toBeTruthy();
      expect(Array.isArray(set.colors)).toBe(true);
      expect(typeof set.byPart).toBe('object');
    }

    const sortedNames = [...availableSets].map(set => set.name);
    const expected = [...sortedNames].sort((a, b) => a.localeCompare(b));
    expect(sortedNames).toEqual(expected);
  });
});

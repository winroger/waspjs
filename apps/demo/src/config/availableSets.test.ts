import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('availableSets', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('loads and normalizes sets from atlas catalog + meta', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/catalog/catalog.json')) {
        return {
          ok: true,
          json: async () => ({
            systems: [
              {
                slug: 'z-set',
                name: 'Zeta Set',
                description: 'Z desc',
                author: 'Author Z',
                tags: ['tag-z'],
                aggregation_url: 'systems/z-set/aggregation.json',
                meta_url: 'systems/z-set/meta.json',
              },
              {
                slug: 'a-set',
                name: 'Alpha Set',
                description: 'A desc',
                author: 'Author A',
                tags: ['tag-a'],
                aggregation_url: 'systems/a-set/aggregation.json',
                meta_url: 'systems/a-set/meta.json',
              },
            ],
          }),
        };
      }

      if (url.endsWith('/systems/a-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'mm',
            version: '1.0.0',
            created: '2026-03-02',
            colors: ['#ffffff'],
            byPart: { A: '#ffffff' },
          }),
        };
      }

      if (url.endsWith('/systems/z-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'cm',
            version: '2.0.0',
            created: '2026-03-03',
            palette: ['#000000'],
            by_part: { Z: '#000000' },
          }),
        };
      }

      return { ok: false, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('./availableSets');
    const result = await mod.loadAvailableSets();

    expect(result.fromBackup).toBe(false);
    expect(result.notice).toBeNull();
    expect(result.sets.length).toBe(2);

    const names = result.sets.map((set) => set.name);
    expect(names).toEqual(['Alpha Set', 'Zeta Set']);

    for (const set of result.sets) {
      expect(set.slug).toBeTruthy();
      expect(set.name).toBeTruthy();
      expect(set.path).toContain('https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas/main/systems/');
      expect(set.aggregation).toBe('aggregation.json');
      expect(Array.isArray(set.colors)).toBe(true);
      expect(typeof set.byPart).toBe('object');
      expect(Array.isArray(set.tags)).toBe(true);
    }
  });
});

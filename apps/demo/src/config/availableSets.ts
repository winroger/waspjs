const exampleConfigs = import.meta.glob('../../../../public/examples/**/config.json', {
  eager: true,
});

export type DemoSetConfig = {
  slug: string;
  name: string;
  description: string;
  author: string;
  path: string;
  aggregation: string;
  colors: string[];
  byPart: Record<string, string>;
};

function normalizeEntry(entry: any, slug: string): DemoSetConfig {
  const data = entry?.default ?? entry ?? {};
  return {
    slug,
    name: data.name || slug,
    description: data.description || '',
    author: data.author || '',
    path: `examples/${slug}/`,
    aggregation: data.aggregation || 'aggregation.json',
    colors: data.colors || data.palette || [],
    byPart: data.byPart || {},
  };
}

export const availableSets: DemoSetConfig[] = Object.entries(exampleConfigs)
  .map(([filepath, entry]) => {
    const match = filepath.match(/public\/examples\/([^/]+)\/config\.json$/);
    if (!match) return null;
    return normalizeEntry(entry, match[1]);
  })
  .filter((item): item is DemoSetConfig => Boolean(item))
  .sort((a, b) => a.name.localeCompare(b.name));

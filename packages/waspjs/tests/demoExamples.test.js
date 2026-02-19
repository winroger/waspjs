import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const publicRoot = path.join(repoRoot, 'public');
const examplesRoot = path.join(publicRoot, 'examples');

describe('demo availableSets assets', () => {
  it('all referenced files exist and parse as JSON', () => {
    const setDirs = readdirSync(examplesRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    setDirs.forEach(slug => {
      const configFile = path.join(examplesRoot, slug, 'config.json');
      expect(existsSync(configFile)).toBe(true);

      const config = JSON.parse(readFileSync(configFile, 'utf-8'));
      const aggregationName = config.aggregation || 'aggregation.json';
      const basePath = path.join(examplesRoot, slug);

      const aggPath = path.join(basePath, aggregationName);
      expect(existsSync(aggPath)).toBe(true);
      expect(() => JSON.parse(readFileSync(aggPath, 'utf-8'))).not.toThrow();
    });
  });
});
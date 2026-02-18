import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const publicRoot = path.join(repoRoot, 'public');
const configPath = path.join(repoRoot, 'apps', 'demo', 'static', 'js', 'config.js');

describe('demo availableSets assets', () => {
  it('all referenced files exist and parse as JSON', async () => {
    const { availableSets } = await import(pathToFileURL(configPath).href);

    availableSets.forEach(set => {
      const normalizedPath = set.path.startsWith('/') ? set.path.slice(1) : set.path;
      const basePath = path.join(publicRoot, normalizedPath);

      const aggPath = path.join(basePath, set.aggregation);
      expect(existsSync(aggPath)).toBe(true);
      expect(() => JSON.parse(readFileSync(aggPath, 'utf-8'))).not.toThrow();
    });
  });
});
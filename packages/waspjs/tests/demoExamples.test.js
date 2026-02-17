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
      const normalizedPath = set.Path.startsWith('/') ? set.Path.slice(1) : set.Path;
      const basePath = path.join(publicRoot, normalizedPath);

      if (set.aggregationFile) {
        const aggPath = path.join(basePath, set.aggregationFile);
        expect(existsSync(aggPath)).toBe(true);
        expect(() => JSON.parse(readFileSync(aggPath, 'utf-8'))).not.toThrow();
      } else {
        const partFiles = (set.partFiles || []).filter(Boolean);
        partFiles.forEach(file => {
          const partPath = path.join(basePath, file);
          expect(existsSync(partPath)).toBe(true);
          expect(() => JSON.parse(readFileSync(partPath, 'utf-8'))).not.toThrow();
        });

        if (set.ruleFile) {
          const rulePath = path.join(basePath, set.ruleFile);
          expect(existsSync(rulePath)).toBe(true);
          expect(() => JSON.parse(readFileSync(rulePath, 'utf-8'))).not.toThrow();
        }
      }
    });
  });
});
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const localWaspSource = resolve(__dirname, '../../packages/waspjs/src/index.js');
const useLocalSource = existsSync(localWaspSource);

export default defineConfig({
  root: 'apps/demo',
  resolve: {
    alias: useLocalSource
      ? {
          webwaspjs: localWaspSource,
        }
      : {},
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'node',
  },
});

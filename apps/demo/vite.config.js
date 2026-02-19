import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const localWaspSource = resolve(__dirname, '../../packages/waspjs/src/index.js');
const useLocalSource = process.env.VITE_USE_LOCAL_WASP_SOURCE !== 'false' && existsSync(localWaspSource);

export default defineConfig(({ mode }) => ({
  root: __dirname,
  publicDir: resolve(__dirname, '../../public'),
  build: {
    outDir: resolve(__dirname, '../../dist')
  },
  // Allow overriding base for external hosting (e.g., GH Pages) via env.
  base: process.env.VITE_BASE_PATH || (mode === 'production' ? '/waspjs/' : '/'),
  resolve: {
    alias: useLocalSource
      ? {
          // In-repo: consume local library source for fast iteration.
          // External consumption: fallback to package dependency automatically when source path is absent.
          webwaspjs: localWaspSource,
        }
      : {},
  }
}));

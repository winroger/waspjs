import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => ({
  root: __dirname,
  publicDir: resolve(__dirname, '../../public'),
  build: {
    outDir: resolve(__dirname, '../../dist')
  },
  // Allow overriding base for external hosting (e.g., GH Pages) via env.
  base: process.env.VITE_BASE_PATH || (mode === 'production' ? '/waspjs/' : '/'),
  resolve: {
    alias: {
      // When the demo lives in-repo, point to source; in external repo, remove this alias to consume the published package.
      webwaspjs: resolve(__dirname, '../../packages/waspjs/src/index.js')
    }
  }
}));

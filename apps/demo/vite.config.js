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
  base: mode === 'production' ? '/waspjs/' : '/',
  resolve: {
    alias: {
      webwaspjs: resolve(__dirname, '../../packages/waspjs/src/index.js')
    }
  }
}));

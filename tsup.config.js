import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.js'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  clean: true,
  dts: false,
  target: 'es2020',
  outDir: 'dist',
});

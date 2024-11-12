import { defineConfig } from 'vite';

export default defineConfig({
  root: 'test',
  publicDir: '../public',
  build: {
    outDir: '../dist'
  }
});
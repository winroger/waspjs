import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'packages/waspjs',
  test: {
    include: ['tests/**/*.{test,spec}.js'],
    globals: true,
    environment: 'node',
  },
});

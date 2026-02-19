import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'apps/demo',
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'node',
  },
});

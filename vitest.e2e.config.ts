import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['test/e2e/**/tier*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    reporters: ['default'],
    isolate: true
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
});

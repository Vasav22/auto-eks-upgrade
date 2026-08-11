/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reportsDirectory: '../../coverage/apps/web',
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/test/**'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@app/shared': path.resolve(__dirname, '../../libs/shared/src/index.ts'),
    },
  },
});

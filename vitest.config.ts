import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment for running tests
    environment: 'jsdom',

    // Global test setup
    setupFiles: ['./__tests__/setup.ts'],

    // Include patterns
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        '__tests__/',
        '.next/',
        'coverage/',
        '*.config.*',
        'app/abi/**',
        'components/ui/**', // shadcn components don't need testing
        '**/*.d.ts',
        'test-results/**',
      ],
      // Only report coverage for files that have tests
      // No global thresholds to avoid failures for untested files
      // Per-file thresholds can be added as test coverage expands
    },

    // Global variables available in tests
    globals: true,

    // Type checking
    typecheck: {
      tsconfig: './tsconfig.json',
    },

    // Timeout for tests
    testTimeout: 10000,

    // Retry on failure for flaky tests
    retry: 1,

    // Watch mode configuration
    watch: false,

    // Reporter configuration
    reporters: ['verbose', 'html'],
    outputFile: {
      html: './test-results/index.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/mock-data': path.resolve(__dirname, './mock-data/index.ts'),
    },
  },
});

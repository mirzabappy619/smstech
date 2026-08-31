import { defineConfig } from 'vitest/config';
import path from 'path';

const alias = {
  '@': path.resolve(__dirname, './src'),
  '@/domain': path.resolve(__dirname, './src/domain'),
  '@/application': path.resolve(__dirname, './src/application'),
  '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
  '@/presentation': path.resolve(__dirname, './src/presentation'),
  '@/lib': path.resolve(__dirname, './src/lib'),
  '@/config': path.resolve(__dirname, './src/config'),
};

export default defineConfig({
  plugins: [],
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },
    // Unit and integration tests need different environments. The unit setup
    // stubs global fetch, which silently broke every integration test — they
    // got the stub instead of a real HTTP response, so `response.status` was
    // undefined. Keeping them in separate projects prevents that.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
          testTimeout: 10000,
          hookTimeout: 10000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});

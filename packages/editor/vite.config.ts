import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@statuscraft/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // The e2e tests point this elsewhere, so a StatusCraft you have running does not leak in
    proxy: { '/api': { target: process.env['STATUSCRAFT_API'] ?? 'http://localhost:3847', changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

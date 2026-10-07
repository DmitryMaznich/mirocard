import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()], base: './', publicDir: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  build: { outDir: '.cache/word-formation-responsive', emptyOutDir: true, rollupOptions: { input: 'tests/responsive/word-formation.html' } },
});

/**
 * Build de arquivo único 100% autossuficiente (React embutido, sem nenhum recurso externo).
 * Abre em visualizadores de arquivo sem internet (ex.: prévia de arquivos do iPhone).
 * Uso: npm run build:page
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-artifact/standalone',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.tsx',
      output: { format: 'iife', entryFileNames: 'game.js', assetFileNames: 'game[extname]' },
    },
  },
});

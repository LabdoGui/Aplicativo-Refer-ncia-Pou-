/**
 * Build alternativo: gera um único arquivo HTML (dist-artifact/tycoon-empire.html) com o jogo
 * embutido e o React carregado do cdnjs. Usado para publicar uma versão jogável como página.
 * Uso: npm run build:page
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.tsx',
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        format: 'iife',
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
        entryFileNames: 'game.js',
        assetFileNames: 'game[extname]',
      },
    },
  },
});

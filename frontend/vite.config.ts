import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromHere = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

/** Destino do proxy de desenvolvimento: o gateway (porta 3000 por padrão). */
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // Os contratos são importados direto do código-fonte TypeScript (sem build prévio).
      {
        find: /^@pulso\/contracts$/,
        replacement: fromHere('../backend/libs/contracts/src/index.ts'),
      },
      { find: /^@\//, replacement: `${fromHere('./src')}/` },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});

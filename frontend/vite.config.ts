import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const fromHere = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

/** Destino do proxy de desenvolvimento: o gateway (porta 3000 por padrão). */
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    changeOrigin: true,
  },
};

/**
 * `vite build --mode demo`: demonstração que roda só no navegador (servidor
 * simulado em src/demo), num único arquivo HTML em dist-demo/demo.html.
 */
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    plugins: [react(), tailwindcss(), ...(demo ? [viteSingleFile()] : [])],
    resolve: {
      alias: [
        // Os contratos são importados direto do código-fonte TypeScript (sem build prévio).
        {
          find: /^@pulso\/contracts$/,
          replacement: fromHere('../backend/libs/contracts/src/index.ts'),
        },
        { find: /^@\//, replacement: `${fromHere('./src')}/` },
        // Só a demonstração usa: regras e dados fictícios do back-end, sem Node.
        { find: /^@backend\//, replacement: `${fromHere('../backend')}/` },
        ...(demo
          ? [{ find: /^node:crypto$/, replacement: fromHere('./src/demo/seed/node-crypto.ts') }]
          : []),
      ],
    },
    build: demo
      ? {
          outDir: 'dist-demo',
          rollupOptions: { input: fromHere('./demo.html') },
        }
      : {
          // Fontes nunca viram data: URI (o CSP do nginx só aceita fontes de 'self').
          assetsInlineLimit: (filePath: string) => (/\.woff2?$/.test(filePath) ? false : undefined),
        },
    server: {
      port: 5173,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      proxy: demo ? undefined : apiProxy,
    },
  };
});

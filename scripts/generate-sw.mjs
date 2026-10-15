/**
 * Gera dist/sw.js depois do build: pré-carrega TODOS os arquivos do app para funcionar sem internet.
 * O nome do cache inclui um hash da lista de arquivos, então cada novo build substitui o anterior.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name !== 'sw.js') files.push(relative(DIST, p).split('\\').join('/'));
  }
})(DIST);

const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(DIST, f)));
const version = hash.digest('hex').slice(0, 12);
const urls = ['./', ...files.map((f) => `./${f}`)];

const sw = `/* Gerado por scripts/generate-sw.mjs — não editar à mão. */
const CACHE = 'tycoon-empire-${version}';
const PRECACHE = ${JSON.stringify(urls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tycoon-empire-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Abrir o app: tenta a rede (pega atualizações) e, sem internet, usa a cópia guardada.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  // Arquivos do app (nomes com hash): cache primeiro.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
`;
writeFileSync(join(DIST, 'sw.js'), sw);
console.log(`dist/sw.js: ${urls.length} arquivos, cache ${version}`);

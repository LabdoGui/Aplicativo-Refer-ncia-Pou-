/**
 * Monta as versões de arquivo único a partir dos builds IIFE:
 * - dist-artifact/tycoon-empire.html          → página publicada (React via cdnjs, fonte Inter)
 * - dist-artifact/tycoon-empire-offline.html  → 100% autossuficiente, sem nada externo
 */
import { readFileSync, writeFileSync } from 'node:fs';

const read = (dir) => ({
  js: readFileSync(`${dir}/game.js`, 'utf8').replace(/<\/script/gi, '<\\/script'),
  css: readFileSync(`${dir}/game.css`, 'utf8').replace(/<\/style/gi, '<\\/style'),
});

// Mostra algo útil antes do jogo carregar e, se um erro acontecer, explica em vez de deixar a tela preta.
const bootFallback = `<div id="root"><div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;color:#b4bfcd;background:#0a0d12;font-family:system-ui,-apple-system,sans-serif">
<div><div style="font-weight:800;letter-spacing:.08em;color:#eaeef4">TYCOON <span style="color:#e8c46a">EMPIRE</span></div><p>Carregando seu império…</p></div></div></div>
<script>
window.addEventListener('error', function (e) {
  var r = document.getElementById('root');
  if (r && !r.querySelector('.app')) {
    r.innerHTML = '<div style="padding:24px;color:#eaeef4;background:#0a0d12;min-height:100vh;font-family:system-ui,sans-serif"><h1 style="font-size:18px">Não foi possível iniciar o jogo</h1><p style="color:#b4bfcd">Motivo: ' +
      String(e.message || e.error || 'erro desconhecido').replace(/[<>&]/g, '') + '</p><p style="color:#7d8a9b">Seu salvamento não foi alterado.</p></div>';
  }
});
</script>`;

const head = `<title>Tycoon Empire</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0a0d12">`;

const cdn = read('dist-artifact');
writeFileSync(
  'dist-artifact/tycoon-empire.html',
  `${head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
${cdn.css}
</style>
${bootFallback}
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${cdn.js}
</script>
`,
);

const sa = read('dist-artifact/standalone');
writeFileSync(
  'dist-artifact/tycoon-empire-offline.html',
  `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
<style>
html,body{background:#0a0d12;margin:0}
${sa.css}
</style>
</head>
<body>
${bootFallback}
<script>
${sa.js}
</script>
</body>
</html>
`,
);
console.log('dist-artifact/tycoon-empire.html e dist-artifact/tycoon-empire-offline.html gerados');

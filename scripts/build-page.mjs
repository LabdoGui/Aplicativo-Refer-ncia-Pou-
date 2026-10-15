/** Monta dist-artifact/tycoon-empire.html a partir do build IIFE (JS e CSS embutidos). */
import { readFileSync, writeFileSync } from 'node:fs';

const js = readFileSync('dist-artifact/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist-artifact/game.css', 'utf8').replace(/<\/style/gi, '<\\/style');
const html = `<title>Tycoon Empire</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0a0d12">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
writeFileSync('dist-artifact/tycoon-empire.html', html);
console.log(`dist-artifact/tycoon-empire.html (${(html.length / 1024).toFixed(0)} KB)`);

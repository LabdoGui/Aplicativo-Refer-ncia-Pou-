/**
 * Instala o servidor simulado e o aviso da demonstração. Importado antes do app
 * (src/demo/main.ts): os módulos são avaliados na ordem dos imports, então o
 * fetch já está interceptado quando o app começa.
 */
import { installDemoServer } from './index';
import { mountDemoBanner } from './ui/banner';

installDemoServer();
mountDemoBanner();

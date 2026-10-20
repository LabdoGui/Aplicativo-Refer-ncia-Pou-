/** Entrada da demonstração no navegador: instala o servidor simulado e abre o app. */
import { installDemoServer } from './index';
import { mountDemoBanner } from './ui/banner';

installDemoServer();
mountDemoBanner();
await import('../main');

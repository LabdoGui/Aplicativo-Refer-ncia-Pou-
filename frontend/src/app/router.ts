import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { routes } from './routes';

// A demonstração (vite --mode demo) roda num arquivo único, sem servidor que
// devolva o index.html em cada caminho: as rotas vão no #.
export const router =
  import.meta.env.MODE === 'demo' ? createHashRouter(routes) : createBrowserRouter(routes);

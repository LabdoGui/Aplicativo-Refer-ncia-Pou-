import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes servidas pelo próprio app (sem Google Fonts): nenhum dado do visitante vai a
// terceiros e o app continua com a tipografia certa offline (PWA).
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import { App } from './app/App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado no index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

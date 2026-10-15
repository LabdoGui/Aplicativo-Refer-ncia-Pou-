import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { StoreContext } from './ui/context';
import { registerServiceWorker, requestPersistentStorage } from './ui/pwa';
import { GameStore, acquireSingleTabLock } from './ui/store';
import './ui/styles.css';

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 20 }}>{title}</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 360 }}>{text}</p>
      </div>
    </div>
  );
}

async function start() {
  root.render(<Message title="Tycoon Empire" text="Carregando seu império…" />);
  const ok = await acquireSingleTabLock();
  if (!ok) {
    root.render(
      <Message
        title="O jogo já está aberto em outra aba"
        text="Para proteger seu progresso, apenas uma aba pode jogar por vez. Feche a outra aba e recarregue esta página."
      />,
    );
    return;
  }
  try {
    const store = await GameStore.boot();
    store.start();
    root.render(
      <StrictMode>
        <StoreContext.Provider value={store}>
          <App />
        </StoreContext.Provider>
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
    root.render(
      <Message
        title="Não foi possível iniciar o jogo"
        text={`Seu salvamento não foi alterado. Detalhe técnico: ${(e as Error).message}`}
      />,
    );
  }
}

registerServiceWorker();
requestPersistentStorage();
void start();

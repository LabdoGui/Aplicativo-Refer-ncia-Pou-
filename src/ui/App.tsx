import { useEffect, useState } from 'react';
import { MISSIONS, type TabId } from '../engine/config/missions';
import { netWorth } from '../engine/economy';
import { formatMoney } from '../engine/money';
import { missionProgress, progressContext } from '../engine/progress';
import { OfflineModal, Toasts } from './components/common';
import { NavContext, useGame } from './context';
import { dismissInstallHint, shouldShowInstallHint } from './pwa';
import { BusinessTab } from './tabs/BusinessTab';
import { HomeTab } from './tabs/HomeTab';
import { MarketTab } from './tabs/MarketTab';
import { AchievementsTab, MissionsTab } from './tabs/ProgressTabs';
import { RealEstateTab } from './tabs/RealEstateTab';
import { WealthTab } from './tabs/WealthTab';

const TABS: { id: TabId; label: string; short: string; icon: string }[] = [
  { id: 'inicio', label: 'Início', short: 'Início', icon: '💳' },
  { id: 'negocios', label: 'Negócios', short: 'Negócios', icon: '🏢' },
  { id: 'bolsa', label: 'Bolsa', short: 'Bolsa', icon: '📈' },
  { id: 'cripto', label: 'Cripto', short: 'Cripto', icon: '🪙' },
  { id: 'imoveis', label: 'Imóveis', short: 'Imóveis', icon: '🏠' },
  { id: 'patrimonio', label: 'Patrimônio', short: 'Bens', icon: '💼' },
  { id: 'missoes', label: 'Missões', short: 'Missões', icon: '🎯' },
  { id: 'conquistas', label: 'Conquistas', short: 'Troféus', icon: '🏆' },
];

function readTab(): TabId {
  const h = location.hash.replace('#', '') as TabId;
  return TABS.some((t) => t.id === h) ? h : 'inicio';
}

export function App() {
  const { s, store } = useGame();
  const [tab, setTab] = useState<TabId>(readTab);
  const [installHint, setInstallHint] = useState(shouldShowInstallHint);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', s.settings.reduceMotion);
  }, [s.settings.reduceMotion]);

  useEffect(() => {
    for (const w of store.loadWarnings) store.pushToast({ kind: 'warning', title: 'Salvamento', detail: w });
    store.loadWarnings = [];
  }, [store]);

  const go = (t: TabId) => {
    setTab(t);
    if (location.hash !== `#${t}`) history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };

  const ctx = progressContext(s);
  const claimable = MISSIONS.some((m) => {
    const p = missionProgress(s, m, ctx);
    return p.done && !p.claimed;
  });

  return (
    <NavContext.Provider value={go}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              T
            </span>
            <span>
              TYCOON <small>EMPIRE</small>
            </span>
          </div>
          <div className="topbar-stats">
            <div className="label">Patrimônio</div>
            <div className="value num">{formatMoney(netWorth(s).total, { compact: true })}</div>
          </div>
        </header>

        <nav className="nav" aria-label="Seções do jogo">
          {TABS.map((t) => (
            <button key={t.id} aria-label={t.label} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <span className="icon" aria-hidden="true">
                {t.icon}
              </span>
              <span className="l-full">{t.label}</span>
              <span className="l-short" aria-hidden="true">
                {t.short}
              </span>
              {t.id === 'missoes' && claimable && <span className="badge-dot" aria-label="Recompensa disponível" />}
            </button>
          ))}
        </nav>

        <main>
          {installHint && tab === 'inicio' && (
            <div className="card guide install-hint" role="note">
              <div className="row between">
                <div className="step">Instale no iPhone</div>
                <button
                  className="btn ghost small"
                  aria-label="Fechar dica de instalação"
                  onClick={() => {
                    dismissInstallHint();
                    setInstallHint(false);
                  }}
                >
                  Fechar
                </button>
              </div>
              <ol className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li>
                  Toque em <strong>Compartilhar</strong> (quadrado com seta para cima) na barra do Safari.
                </li>
                <li>
                  Escolha <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.
                </li>
                <li>Abra pelo ícone novo: tela cheia, funciona sem internet e o progresso fica salvo.</li>
              </ol>
            </div>
          )}
          {tab === 'inicio' && <HomeTab />}
          {tab === 'negocios' && <BusinessTab />}
          {tab === 'bolsa' && <MarketTab key="stock" kind="stock" />}
          {tab === 'cripto' && <MarketTab key="crypto" kind="crypto" />}
          {tab === 'imoveis' && <RealEstateTab />}
          {tab === 'patrimonio' && <WealthTab />}
          {tab === 'missoes' && <MissionsTab />}
          {tab === 'conquistas' && <AchievementsTab />}
        </main>
      </div>
      <Toasts />
      {store.offlineReport && <OfflineModal report={store.offlineReport} onClose={() => store.dismissOffline()} />}
    </NavContext.Provider>
  );
}

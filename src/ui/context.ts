import { createContext, useContext, useSyncExternalStore } from 'react';
import type { TabId } from '../engine/config/missions';
import type { GameStore } from './store';

export const StoreContext = createContext<GameStore | null>(null);
export const NavContext = createContext<(tab: TabId) => void>(() => undefined);

/** Reassina o componente a cada atualização do jogo (até 4×/s). */
export function useGame() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext ausente');
  useSyncExternalStore(store.subscribe, store.getVersion);
  return { store, s: store.state, dispatch: store.dispatch.bind(store) };
}

export function useNav() {
  return useContext(NavContext);
}

import { useSyncExternalStore } from 'react';
import type { AuthSession, LoginRequest, RegisterRequest } from '@pulso/contracts';
import { apiPost } from '@/lib/api';
import { applySession, logout, sessionStore } from './session-store';

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}

export async function login(credentials: LoginRequest): Promise<AuthSession> {
  const session = await apiPost<AuthSession>('/auth/login', credentials);
  applySession(session);
  return session;
}

export async function register(data: RegisterRequest): Promise<AuthSession> {
  const session = await apiPost<AuthSession>('/auth/register', data);
  applySession(session);
  return session;
}

export { logout };

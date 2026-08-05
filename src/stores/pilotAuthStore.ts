import { create } from 'zustand';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotLoginCredentials,
  type PilotSession,
} from '../services/pilotControlApi';

export type PilotAuthStatus =
  'idle' | 'hydrating' | 'anonymous' | 'authenticating' | 'authenticated' | 'service_error';

export interface PilotAuthStoreState {
  status: PilotAuthStatus;
  session: PilotSession | null;
  error: string | null;
  requestId: string | null;
  login: (credentials: PilotLoginCredentials) => Promise<PilotSession | null>;
  hydrate: () => Promise<PilotSession | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function errorDetails(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof PilotControlApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: 'Pilot 认证发生未知错误。', requestId: null };
}

export const usePilotAuthStore = create<PilotAuthStoreState>((set) => ({
  status: 'idle',
  session: null,
  error: null,
  requestId: null,

  login: async (credentials) => {
    set({ status: 'authenticating', session: null, error: null, requestId: null });
    try {
      const session = await pilotControlApi.login(credentials);
      set({ status: 'authenticated', session, error: null, requestId: null });
      return session;
    } catch (error) {
      const details = errorDetails(error);
      set({
        status: 'anonymous',
        session: null,
        error: details.message,
        requestId: details.requestId,
      });
      return null;
    }
  },

  hydrate: async () => {
    set({ status: 'hydrating', session: null, error: null, requestId: null });
    try {
      const session = await pilotControlApi.hydrate();
      set({ status: 'authenticated', session, error: null, requestId: null });
      return session;
    } catch (error) {
      const details = errorDetails(error);
      const anonymous = error instanceof PilotControlApiError && error.status === 401;
      set({
        status: anonymous ? 'anonymous' : 'service_error',
        session: null,
        error: anonymous ? null : details.message,
        requestId: anonymous ? null : details.requestId,
      });
      return null;
    }
  },

  logout: async () => {
    let details: { message: string; requestId: string | null } | null = null;
    try {
      await pilotControlApi.logout();
    } catch (error) {
      details = errorDetails(error);
    }
    set({
      status: 'anonymous',
      session: null,
      error: details?.message ?? null,
      requestId: details?.requestId ?? null,
    });
  },

  clearError: () => set({ error: null, requestId: null }),
}));

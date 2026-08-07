import { create } from 'zustand';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotLoginCredentials,
  type PilotSession,
} from '../services/pilotControlApi';
import {
  usePilotProjectContextStore,
  type PilotProjectContextResult,
} from './pilotProjectContextStore';

export type PilotAuthStatus =
  'idle' | 'hydrating' | 'anonymous' | 'authenticating' | 'authenticated' | 'service_error';

export interface PilotAuthStoreState {
  status: PilotAuthStatus;
  session: PilotSession | null;
  error: string | null;
  requestId: string | null;
  login: (credentials: PilotLoginCredentials) => Promise<PilotSession | null>;
  hydrate: () => Promise<PilotSession | null>;
  refreshProjectContext: () => Promise<PilotProjectContextResult | null>;
  selectProject: (projectId: string) => Promise<PilotProjectContextResult | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function errorDetails(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof PilotControlApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: 'Pilot 认证发生未知错误。', requestId: null };
}

async function loadProjectContext(session: PilotSession): Promise<PilotProjectContextResult> {
  return usePilotProjectContextStore.getState().load(session);
}

function clearSessionForUnauthorized(
  result: PilotProjectContextResult,
  set: (state: Partial<PilotAuthStoreState>) => void,
): boolean {
  if (result.status !== 'unauthorized') return false;
  set({ status: 'anonymous', session: null, error: null, requestId: null });
  return true;
}

export const usePilotAuthStore = create<PilotAuthStoreState>((set, get) => ({
  status: 'idle',
  session: null,
  error: null,
  requestId: null,

  login: async (credentials) => {
    usePilotProjectContextStore.getState().reset();
    set({ status: 'authenticating', session: null, error: null, requestId: null });
    try {
      const session = await pilotControlApi.login(credentials);
      set({ status: 'authenticated', session, error: null, requestId: null });
      const projectResult = await loadProjectContext(session);
      if (clearSessionForUnauthorized(projectResult, set)) return null;
      return session;
    } catch (error) {
      const details = errorDetails(error);
      usePilotProjectContextStore.getState().reset();
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
    usePilotProjectContextStore.getState().reset();
    set({ status: 'hydrating', session: null, error: null, requestId: null });
    try {
      const session = await pilotControlApi.hydrate();
      set({ status: 'authenticated', session, error: null, requestId: null });
      const projectResult = await loadProjectContext(session);
      if (clearSessionForUnauthorized(projectResult, set)) return null;
      return session;
    } catch (error) {
      const details = errorDetails(error);
      const anonymous = error instanceof PilotControlApiError && error.status === 401;
      usePilotProjectContextStore.getState().reset();
      set({
        status: anonymous ? 'anonymous' : 'service_error',
        session: null,
        error: anonymous ? null : details.message,
        requestId: anonymous ? null : details.requestId,
      });
      return null;
    }
  },

  refreshProjectContext: async () => {
    const session = get().session;
    if (!session) {
      usePilotProjectContextStore.getState().reset();
      return null;
    }
    const result = await loadProjectContext(session);
    clearSessionForUnauthorized(result, set);
    return result;
  },

  selectProject: async (projectId) => {
    const session = get().session;
    if (!session) {
      usePilotProjectContextStore.getState().reset();
      return null;
    }
    const result = await usePilotProjectContextStore.getState().select(session, projectId);
    clearSessionForUnauthorized(result, set);
    return result;
  },

  logout: async () => {
    let details: { message: string; requestId: string | null } | null = null;
    try {
      await pilotControlApi.logout();
    } catch (error) {
      details = errorDetails(error);
    }
    usePilotProjectContextStore.getState().reset();
    set({
      status: 'anonymous',
      session: null,
      error: details?.message ?? null,
      requestId: details?.requestId ?? null,
    });
  },

  clearError: () => set({ error: null, requestId: null }),
}));

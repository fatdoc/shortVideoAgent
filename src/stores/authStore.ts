import { create } from 'zustand';
import type {
  DemoIdentity,
  DemoLoginCredentials,
  DemoMembershipIdentity,
  DemoOrganizationIdentity,
  DemoWorkbench,
} from '../domain/demoIdentity';
import {
  DemoAuthError,
  hydrateDemoSession,
  loginWithDemoAccount,
  logoutDemoAccount,
} from '../services/demoAuth';

export type DemoAuthStatus =
  | 'idle'
  | 'hydrating'
  | 'anonymous'
  | 'authenticated';

export interface DemoAuthStoreState {
  status: DemoAuthStatus;
  identity: DemoIdentity | null;
  currentIdentity: DemoIdentity | null;
  activeOrganization: DemoOrganizationIdentity | null;
  activeMembership: DemoMembershipIdentity | null;
  allowedWorkbenches: readonly DemoWorkbench[];
  defaultRoute: string | null;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: DemoLoginCredentials) => DemoIdentity | null;
  logout: () => void;
  hydrate: () => DemoIdentity | null;
  clearError: () => void;
}

type AuthIdentitySlice = Pick<
  DemoAuthStoreState,
  | 'identity'
  | 'currentIdentity'
  | 'activeOrganization'
  | 'activeMembership'
  | 'allowedWorkbenches'
  | 'defaultRoute'
  | 'isAuthenticated'
>;

function identitySlice(identity: DemoIdentity | null): AuthIdentitySlice {
  return {
    identity,
    currentIdentity: identity,
    activeOrganization: identity?.activeOrganization ?? null,
    activeMembership: identity?.activeMembership ?? null,
    allowedWorkbenches: identity?.allowedWorkbenches ?? [],
    defaultRoute: identity?.defaultRoute ?? null,
    isAuthenticated: identity !== null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof DemoAuthError) return error.message;
  return error instanceof Error ? error.message : 'Demo 登录失败。';
}

export const useAuthStore = create<DemoAuthStoreState>((set) => ({
  status: 'idle',
  ...identitySlice(null),
  error: null,

  login: (credentials) => {
    try {
      const identity = loginWithDemoAccount(credentials);
      set({
        status: 'authenticated',
        ...identitySlice(identity),
        error: null,
      });
      return identity;
    } catch (error) {
      logoutDemoAccount();
      set({
        status: 'anonymous',
        ...identitySlice(null),
        error: errorMessage(error),
      });
      return null;
    }
  },

  logout: () => {
    logoutDemoAccount();
    set({
      status: 'anonymous',
      ...identitySlice(null),
      error: null,
    });
  },

  hydrate: () => {
    set({ status: 'hydrating', error: null });
    const identity = hydrateDemoSession();
    set({
      status: identity ? 'authenticated' : 'anonymous',
      ...identitySlice(identity),
      error: null,
    });
    return identity;
  },

  clearError: () => set({ error: null }),
}));

export const selectCurrentIdentity = (
  state: DemoAuthStoreState,
): DemoIdentity | null => state.currentIdentity;

export const selectAllowedWorkbenches = (
  state: DemoAuthStoreState,
): readonly DemoWorkbench[] => state.allowedWorkbenches;

export const selectDefaultRoute = (
  state: DemoAuthStoreState,
): string | null => state.defaultRoute;

export const selectActiveOrganization = (
  state: DemoAuthStoreState,
): DemoOrganizationIdentity | null => state.activeOrganization;

export const selectActiveMembership = (
  state: DemoAuthStoreState,
): DemoMembershipIdentity | null => state.activeMembership;

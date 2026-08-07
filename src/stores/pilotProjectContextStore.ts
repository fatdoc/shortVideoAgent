import { create } from 'zustand';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotProject,
  type PilotSession,
} from '../services/pilotControlApi';

export type PilotProjectContextStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'tenant_context_required'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'service_error';

export interface PilotProjectContext {
  tenantId: string;
  projectId: string;
  projectName: string;
  sessionMembershipId: string;
  roleCodes: PilotSession['roles'];
}

export interface PilotProjectContextResult {
  status: Exclude<PilotProjectContextStatus, 'idle' | 'loading'>;
}

export interface PilotProjectContextStoreState {
  status: PilotProjectContextStatus;
  projects: PilotProject[];
  activeProjectId: string | null;
  context: PilotProjectContext | null;
  error: string | null;
  requestId: string | null;
  load: (session: PilotSession) => Promise<PilotProjectContextResult>;
  select: (session: PilotSession, projectId: string) => Promise<PilotProjectContextResult>;
  reset: () => void;
}

const INITIAL_STATE: Pick<
  PilotProjectContextStoreState,
  'status' | 'projects' | 'activeProjectId' | 'context' | 'error' | 'requestId'
> = {
  status: 'idle',
  projects: [],
  activeProjectId: null,
  context: null,
  error: null,
  requestId: null,
};

function validTenantSession(session: PilotSession): session is PilotSession & {
  tenant: { id: string; displayName: string };
  activeContext: PilotSession['activeContext'] & {
    organizationType: 'TENANT';
    tenantId: string;
  };
} {
  return (
    session.activeContext.organizationType === 'TENANT' &&
    session.tenant !== null &&
    session.activeContext.tenantId !== null &&
    session.tenant.id === session.activeContext.tenantId &&
    session.activeContext.organizationId === session.activeContext.tenantId &&
    (session.roles.includes('tenant_admin') || session.roles.includes('content_operator'))
  );
}

function contextFor(
  session: PilotSession & {
    tenant: { id: string; displayName: string };
    activeContext: PilotSession['activeContext'] & { tenantId: string };
  },
  project: PilotProject,
): PilotProjectContext {
  return {
    tenantId: session.activeContext.tenantId,
    projectId: project.id,
    projectName: project.name,
    sessionMembershipId: session.activeContext.membershipId,
    roleCodes: [...session.roles],
  };
}

function failure(error: unknown): {
  status: Extract<
    PilotProjectContextStatus,
    'unauthorized' | 'forbidden' | 'not_found' | 'service_error'
  >;
  error: string;
  requestId: string | null;
} {
  if (error instanceof PilotControlApiError) {
    const status =
      error.status === 401
        ? 'unauthorized'
        : error.status === 403
          ? 'forbidden'
          : error.status === 404
            ? 'not_found'
            : 'service_error';
    return { status, error: error.message, requestId: error.requestId };
  }
  return { status: 'service_error', error: 'Pilot 项目上下文发生未知错误。', requestId: null };
}

export const usePilotProjectContextStore = create<PilotProjectContextStoreState>((set, get) => ({
  ...INITIAL_STATE,

  load: async (session) => {
    if (!validTenantSession(session)) {
      set({ ...INITIAL_STATE, status: 'tenant_context_required' });
      return { status: 'tenant_context_required' };
    }

    const previousProjectId = get().activeProjectId;
    set({ ...INITIAL_STATE, status: 'loading' });
    try {
      const projects = [...(await pilotControlApi.listProjects())].sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      if (projects.length === 0) {
        set({ ...INITIAL_STATE, status: 'empty', projects: [] });
        return { status: 'empty' };
      }

      const activeProject =
        projects.find((project) => project.id === previousProjectId) ?? projects[0];
      if (!activeProject) {
        set({ ...INITIAL_STATE, status: 'empty', projects: [] });
        return { status: 'empty' };
      }

      set({
        status: 'ready',
        projects,
        activeProjectId: activeProject.id,
        context: contextFor(session, activeProject),
        error: null,
        requestId: null,
      });
      return { status: 'ready' };
    } catch (error) {
      const details = failure(error);
      set({ ...INITIAL_STATE, ...details });
      return { status: details.status };
    }
  },

  select: async (session, projectId) => {
    if (!validTenantSession(session)) {
      set({ ...INITIAL_STATE, status: 'tenant_context_required' });
      return { status: 'tenant_context_required' };
    }

    const visibleProject = get().projects.find((project) => project.id === projectId);
    if (!visibleProject) {
      set({ ...INITIAL_STATE, status: 'not_found' });
      return { status: 'not_found' };
    }

    set({ ...get(), status: 'loading', error: null, requestId: null });
    try {
      const confirmed = await pilotControlApi.readProject(projectId);
      if (confirmed.id !== projectId) {
        set({ ...INITIAL_STATE, status: 'not_found' });
        return { status: 'not_found' };
      }
      const projects = get().projects.map((project) =>
        project.id === confirmed.id ? confirmed : project,
      );
      set({
        status: 'ready',
        projects,
        activeProjectId: confirmed.id,
        context: contextFor(session, confirmed),
        error: null,
        requestId: null,
      });
      return { status: 'ready' };
    } catch (error) {
      const details = failure(error);
      set({ ...INITIAL_STATE, ...details });
      return { status: details.status };
    }
  },

  reset: () => set(INITIAL_STATE),
}));

import { get, writable } from 'svelte/store';
import { apiGet, apiPut } from '$lib/utils/api';
import {
  getWorkspaceTemplateFallbackMessage,
  normalizeWorkspaceTemplateCatalogResponse,
  type WorkspaceTemplateAssignmentPayload,
  type WorkspaceTemplateCatalogItem,
} from '$lib/utils/workspace-template-catalog';

type WorkspaceTemplateCatalogState = {
  loadingCatalog: boolean;
  loadingAssignment: boolean;
  updatingAssignment: boolean;
  items: WorkspaceTemplateCatalogItem[];
  defaultTemplateKey: string;
  assignmentByWorkspaceId: Record<string, WorkspaceTemplateAssignmentPayload>;
  assignmentWarningByWorkspaceId: Record<string, string | null>;
  error: string | null;
};

export const workspaceTemplateCatalog = writable<WorkspaceTemplateCatalogState>({
  loadingCatalog: false,
  loadingAssignment: false,
  updatingAssignment: false,
  items: [],
  defaultTemplateKey: '',
  assignmentByWorkspaceId: {},
  assignmentWarningByWorkspaceId: {},
  error: null,
});

export async function loadWorkspaceTemplateCatalog(): Promise<void> {
  workspaceTemplateCatalog.update((state) => ({
    ...state,
    loadingCatalog: true,
    error: null,
  }));

  try {
    const payload = await apiGet('/workspace-templates');
    const normalized = normalizeWorkspaceTemplateCatalogResponse(payload);

    workspaceTemplateCatalog.update((state) => ({
      ...state,
      loadingCatalog: false,
      items: normalized.items,
      defaultTemplateKey: normalized.default_template_key,
      error: null,
    }));
  } catch (error: any) {
    workspaceTemplateCatalog.update((state) => ({
      ...state,
      loadingCatalog: false,
      error: error?.message ?? 'Failed to load workspace template catalog.',
    }));
  }
}

export async function loadWorkspaceTemplateAssignment(workspaceId: string): Promise<void> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) return;

  workspaceTemplateCatalog.update((state) => ({
    ...state,
    loadingAssignment: true,
    error: null,
  }));

  try {
    const payload = await apiGet<WorkspaceTemplateAssignmentPayload>(
      `/workspaces/${encodeURIComponent(normalizedWorkspaceId)}/template`
    );
    const warning = getWorkspaceTemplateFallbackMessage(payload);

    workspaceTemplateCatalog.update((state) => ({
      ...state,
      loadingAssignment: false,
      assignmentByWorkspaceId: {
        ...state.assignmentByWorkspaceId,
        [normalizedWorkspaceId]: payload,
      },
      assignmentWarningByWorkspaceId: {
        ...state.assignmentWarningByWorkspaceId,
        [normalizedWorkspaceId]: warning,
      },
      error: null,
    }));
  } catch (error: any) {
    workspaceTemplateCatalog.update((state) => ({
      ...state,
      loadingAssignment: false,
      error: error?.message ?? 'Failed to load workspace template assignment.',
    }));
  }
}

export async function updateWorkspaceTemplateAssignment(
  workspaceId: string,
  templateKey: string
): Promise<WorkspaceTemplateAssignmentPayload> {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedTemplateKey = templateKey.trim();
  if (!normalizedWorkspaceId || !normalizedTemplateKey) {
    throw new Error('workspaceId and templateKey are required.');
  }

  workspaceTemplateCatalog.update((state) => ({
    ...state,
    updatingAssignment: true,
    error: null,
  }));

  try {
    const payload = await apiPut<WorkspaceTemplateAssignmentPayload>(
      `/workspaces/${encodeURIComponent(normalizedWorkspaceId)}/template`,
      {
        template_key: normalizedTemplateKey,
      }
    );
    const warning = getWorkspaceTemplateFallbackMessage(payload);

    workspaceTemplateCatalog.update((state) => ({
      ...state,
      updatingAssignment: false,
      assignmentByWorkspaceId: {
        ...state.assignmentByWorkspaceId,
        [normalizedWorkspaceId]: payload,
      },
      assignmentWarningByWorkspaceId: {
        ...state.assignmentWarningByWorkspaceId,
        [normalizedWorkspaceId]: warning,
      },
      error: null,
    }));

    return payload;
  } catch (error: any) {
    workspaceTemplateCatalog.update((state) => ({
      ...state,
      updatingAssignment: false,
      error: error?.message ?? 'Failed to update workspace template assignment.',
    }));
    throw error;
  }
}

export function getWorkspaceTemplateAssignmentFromStore(workspaceId: string) {
  const state = get(workspaceTemplateCatalog);
  return state.assignmentByWorkspaceId[workspaceId] ?? null;
}

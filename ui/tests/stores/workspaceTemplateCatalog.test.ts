import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { clearUser } from '../../src/lib/stores/session';
import {
  loadWorkspaceTemplateAssignment,
  loadWorkspaceTemplateCatalog,
  updateWorkspaceTemplateAssignment,
  workspaceTemplateCatalog,
} from '../../src/lib/stores/workspaceTemplateCatalog';
import { mockFetchJsonOnce, resetFetchMock } from '../test-setup';

describe('workspaceTemplateCatalog store', () => {
  beforeEach(() => {
    resetFetchMock();
    clearUser();
    workspaceTemplateCatalog.set({
      loadingCatalog: false,
      loadingAssignment: false,
      updatingAssignment: false,
      items: [],
      defaultTemplateKey: '',
      assignmentByWorkspaceId: {},
      assignmentWarningByWorkspaceId: {},
      error: null,
    });
  });

  it('loads workspace template catalog', async () => {
    mockFetchJsonOnce({
      items: [
        {
          template_key: 'ai-ideas',
          template_version: '1.0.0',
          status: 'ready',
          is_default: true,
          capabilities: ['usecase_generation'],
          workflow_refs: ['ai-usecase-generation'],
          agent_refs: ['matrix-generator'],
        },
        {
          template_key: 'todo',
          template_version: '1.0.0',
          status: 'ready',
          is_default: false,
          capabilities: ['todo_planning'],
          workflow_refs: ['todo-planning-core'],
          agent_refs: ['plan-agent'],
        },
      ],
      default_template_key: 'ai-ideas',
    });

    await loadWorkspaceTemplateCatalog();

    const state = get(workspaceTemplateCatalog);
    expect(state.loadingCatalog).toBe(false);
    expect(state.error).toBeNull();
    expect(state.items.map((item) => item.template_key)).toEqual(['ai-ideas', 'todo']);
    expect(state.defaultTemplateKey).toBe('ai-ideas');
  });

  it('loads workspace assignment and stores fallback warning', async () => {
    mockFetchJsonOnce({
      workspace_id: 'ws-1',
      requested_template_key: 'legacy-template',
      active_template_key: 'ai-ideas',
      template_version: '1.0.0',
      status: 'fallback',
      fallback_reason: 'template_unavailable',
      warning: null,
      assignment: {
        assigned_at: '2026-02-26T10:00:00.000Z',
        assigned_by_user_id: 'user-1',
        snapshot_policy: 'non_retroactive',
        applies_to_existing_artifacts: false,
        applies_to_new_artifacts: true,
      },
      template: {
        template_key: 'ai-ideas',
        template_version: '1.0.0',
        status: 'ready',
        is_default: true,
        capabilities: ['usecase_generation'],
        workflow_refs: ['ai-usecase-generation'],
        agent_refs: ['matrix-generator'],
      },
    });

    await loadWorkspaceTemplateAssignment('ws-1');
    const state = get(workspaceTemplateCatalog);

    expect(state.loadingAssignment).toBe(false);
    expect(state.assignmentByWorkspaceId['ws-1']?.active_template_key).toBe('ai-ideas');
    expect(state.assignmentWarningByWorkspaceId['ws-1']).toContain('unavailable');
  });

  it('updates workspace template assignment via PUT', async () => {
    mockFetchJsonOnce({
      workspace_id: 'ws-1',
      requested_template_key: 'todo',
      active_template_key: 'todo',
      template_version: '1.0.0',
      status: 'ready',
      fallback_reason: null,
      warning: null,
      assignment: {
        assigned_at: '2026-02-26T11:00:00.000Z',
        assigned_by_user_id: 'user-1',
        snapshot_policy: 'non_retroactive',
        applies_to_existing_artifacts: false,
        applies_to_new_artifacts: true,
      },
      template: {
        template_key: 'todo',
        template_version: '1.0.0',
        status: 'ready',
        is_default: false,
        capabilities: ['todo_planning'],
        workflow_refs: ['todo-planning-core'],
        agent_refs: ['plan-agent'],
      },
    });

    const payload = await updateWorkspaceTemplateAssignment('ws-1', 'todo');
    const state = get(workspaceTemplateCatalog);

    expect(payload.active_template_key).toBe('todo');
    expect(state.assignmentByWorkspaceId['ws-1']?.active_template_key).toBe('todo');
    expect(state.updatingAssignment).toBe(false);

    const fetchMock = global.fetch as any;
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.method).toBe('PUT');
    expect(requestInit.body).toContain('"template_key":"todo"');
  });
});

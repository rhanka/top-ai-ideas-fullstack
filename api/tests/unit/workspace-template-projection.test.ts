import { describe, expect, it } from 'vitest';
import {
  resolveWorkspaceTemplateProjection,
  type WorkspaceTemplateCatalogPayload,
} from '../../src/services/workspace-template-catalog';

function buildCatalog(
  overrides?: Partial<WorkspaceTemplateCatalogPayload>
): WorkspaceTemplateCatalogPayload {
  return {
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
    br03_contracts: {
      workflow_config: { endpoint: '/api/v1/workflow-config', status: 'available' },
      agent_config: { endpoint: '/api/v1/agent-config', status: 'available' },
    },
    ...overrides,
  };
}

describe('workspace template projection', () => {
  it('uses default template when no assignment exists', () => {
    const projection = resolveWorkspaceTemplateProjection({
      workspaceId: 'ws-1',
      catalog: buildCatalog(),
      assignment: null,
    });

    expect(projection.status).toBe('ready');
    expect(projection.active_template_key).toBe('ai-ideas');
    expect(projection.fallback_reason).toBeNull();
    expect(projection.assignment.snapshot_policy).toBe('non_retroactive');
    expect(projection.assignment.applies_to_existing_artifacts).toBe(false);
    expect(projection.assignment.applies_to_new_artifacts).toBe(true);
  });

  it('keeps requested template when assignment exists and template is ready', () => {
    const projection = resolveWorkspaceTemplateProjection({
      workspaceId: 'ws-1',
      catalog: buildCatalog(),
      assignment: {
        template_key: 'todo',
        assigned_at: '2026-02-26T10:00:00.000Z',
        assigned_by_user_id: 'user-1',
        snapshot_policy: 'non_retroactive',
      },
    });

    expect(projection.status).toBe('ready');
    expect(projection.active_template_key).toBe('todo');
    expect(projection.fallback_reason).toBeNull();
    expect(projection.assignment.assigned_at).toBe('2026-02-26T10:00:00.000Z');
    expect(projection.assignment.assigned_by_user_id).toBe('user-1');
  });

  it('falls back to default template when assigned template is unavailable', () => {
    const projection = resolveWorkspaceTemplateProjection({
      workspaceId: 'ws-1',
      catalog: buildCatalog(),
      assignment: {
        template_key: 'legacy-template',
        assigned_at: '2026-02-26T10:00:00.000Z',
        assigned_by_user_id: 'user-1',
        snapshot_policy: 'non_retroactive',
      },
    });

    expect(projection.status).toBe('fallback');
    expect(projection.active_template_key).toBe('ai-ideas');
    expect(projection.fallback_reason).toBe('template_unavailable');
    expect(projection.warning).toContain('legacy-template');
  });

  it('falls back to default template when assigned template is disabled', () => {
    const catalog = buildCatalog({
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
          status: 'disabled',
          is_default: false,
          capabilities: ['todo_planning'],
          workflow_refs: ['todo-planning-core'],
          agent_refs: ['plan-agent'],
        },
      ],
    });

    const projection = resolveWorkspaceTemplateProjection({
      workspaceId: 'ws-1',
      catalog,
      assignment: {
        template_key: 'todo',
        assigned_at: '2026-02-26T10:00:00.000Z',
        assigned_by_user_id: 'user-1',
        snapshot_policy: 'non_retroactive',
      },
    });

    expect(projection.status).toBe('fallback');
    expect(projection.active_template_key).toBe('ai-ideas');
    expect(projection.fallback_reason).toBe('template_disabled');
    expect(projection.warning).toContain('todo');
  });
});

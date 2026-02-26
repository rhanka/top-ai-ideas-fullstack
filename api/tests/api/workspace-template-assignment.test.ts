import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../../src/app';
import { db } from '../../src/db/client';
import { settings, workspaceMemberships } from '../../src/db/schema';
import { settingsService } from '../../src/services/settings';
import {
  workspaceTemplateAssignmentSettingsKey,
} from '../../src/services/workspace-template-catalog';
import {
  authenticatedRequest,
  cleanupAuthData,
  createAuthenticatedUser,
} from '../utils/auth-helper';

describe('Workspace template assignment API', () => {
  let editor: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let viewer: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let workspaceId: string;
  let assignmentKey: string;

  beforeEach(async () => {
    editor = await createAuthenticatedUser('editor');
    viewer = await createAuthenticatedUser('guest');
    workspaceId = editor.workspaceId!;
    assignmentKey = workspaceTemplateAssignmentSettingsKey(workspaceId);
  });

  afterEach(async () => {
    await db.delete(settings).where(eq(settings.key, assignmentKey));
    await cleanupAuthData();
  });

  it('returns default template assignment for a workspace with no explicit assignment', async () => {
    const response = await authenticatedRequest(
      app,
      'GET',
      `/api/v1/workspaces/${workspaceId}/template`,
      editor.sessionToken!
    );
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.workspace_id).toBe(workspaceId);
    expect(payload.status).toBe('ready');
    expect(payload.active_template_key).toBe('ai-ideas');
    expect(payload.assignment.snapshot_policy).toBe('non_retroactive');
    expect(payload.assignment.applies_to_existing_artifacts).toBe(false);
    expect(payload.assignment.applies_to_new_artifacts).toBe(true);
  });

  it('allows editor assignment update and denies viewer updates', async () => {
    await db.insert(workspaceMemberships).values({
      workspaceId,
      userId: viewer.id,
      role: 'viewer',
      createdAt: new Date(),
    });

    const deny = await authenticatedRequest(
      app,
      'PUT',
      `/api/v1/workspaces/${workspaceId}/template`,
      viewer.sessionToken!,
      { template_key: 'todo' }
    );
    expect(deny.status).toBe(403);

    const update = await authenticatedRequest(
      app,
      'PUT',
      `/api/v1/workspaces/${workspaceId}/template`,
      editor.sessionToken!,
      { template_key: 'todo' }
    );
    expect(update.status).toBe(200);

    const updatedPayload = await update.json();
    expect(updatedPayload.status).toBe('ready');
    expect(updatedPayload.requested_template_key).toBe('todo');
    expect(updatedPayload.active_template_key).toBe('todo');
    expect(updatedPayload.fallback_reason).toBeNull();

    const readByViewer = await authenticatedRequest(
      app,
      'GET',
      `/api/v1/workspaces/${workspaceId}/template`,
      viewer.sessionToken!
    );
    expect(readByViewer.status).toBe(200);
    const viewerPayload = await readByViewer.json();
    expect(viewerPayload.active_template_key).toBe('todo');
  });

  it('falls back deterministically to default when stored assignment is unavailable', async () => {
    await settingsService.set(
      assignmentKey,
      JSON.stringify({
        template_key: 'legacy-template',
        assigned_at: '2026-02-26T10:00:00.000Z',
        assigned_by_user_id: editor.id,
        snapshot_policy: 'non_retroactive',
      }),
      'Test stale assignment'
    );

    const response = await authenticatedRequest(
      app,
      'GET',
      `/api/v1/workspaces/${workspaceId}/template`,
      editor.sessionToken!
    );
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.status).toBe('fallback');
    expect(payload.requested_template_key).toBe('legacy-template');
    expect(payload.active_template_key).toBe('ai-ideas');
    expect(payload.fallback_reason).toBe('template_unavailable');
    expect(typeof payload.warning).toBe('string');
  });
});

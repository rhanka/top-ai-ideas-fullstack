import { expect, test } from '@playwright/test';
import { withWorkspaceStorageState } from '../helpers/workspace-scope';

test.describe('Workspace template catalog', () => {
  test('shows assignment metadata and lets editor update template', async ({ browser }) => {
    const workspaceId = 'e2e-ws-a';
    const context = await browser.newContext({
      storageState: await withWorkspaceStorageState('./.auth/user-a.json', workspaceId),
    });
    const page = await context.newPage();

    let activeTemplate = 'ai-ideas';
    let assignedAt = '2026-02-26T10:00:00.000Z';

    await page.route('**/api/v1/workspace-templates', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      });
    });

    await page.route('**/api/v1/workspaces/*/template', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as { template_key?: string };
        if (body?.template_key === 'todo') activeTemplate = 'todo';
        if (body?.template_key === 'ai-ideas') activeTemplate = 'ai-ideas';
        assignedAt = new Date().toISOString();
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspace_id: workspaceId,
          requested_template_key: activeTemplate,
          active_template_key: activeTemplate,
          template_version: '1.0.0',
          status: 'ready',
          fallback_reason: null,
          warning: null,
          assignment: {
            assigned_at: assignedAt,
            assigned_by_user_id: 'e2e-user-a',
            snapshot_policy: 'non_retroactive',
            applies_to_existing_artifacts: false,
            applies_to_new_artifacts: true,
          },
          template: {
            template_key: activeTemplate,
            template_version: '1.0.0',
            status: 'ready',
            is_default: activeTemplate === 'ai-ideas',
            capabilities: activeTemplate === 'ai-ideas' ? ['usecase_generation'] : ['todo_planning'],
            workflow_refs: activeTemplate === 'ai-ideas' ? ['ai-usecase-generation'] : ['todo-planning-core'],
            agent_refs: activeTemplate === 'ai-ideas' ? ['matrix-generator'] : ['plan-agent'],
          },
        }),
      });
    });

    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('workspace-template-card')).toBeVisible();
    await expect(page.getByTestId('workspace-template-active-key')).toHaveText('ai-ideas');

    await page.getByTestId('workspace-template-select').selectOption('todo');
    await page.getByTestId('workspace-template-save').click();

    await expect(page.getByTestId('workspace-template-active-key')).toHaveText('todo');
    await context.close();
  });
});

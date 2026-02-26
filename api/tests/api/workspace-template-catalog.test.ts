import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import {
  authenticatedRequest,
  cleanupAuthData,
  createAuthenticatedUser,
} from '../utils/auth-helper';

describe('Workspace template catalog API', () => {
  let user: Awaited<ReturnType<typeof createAuthenticatedUser>>;

  beforeEach(async () => {
    user = await createAuthenticatedUser('editor');
  });

  afterEach(async () => {
    await cleanupAuthData();
  });

  it('returns workspace template catalog with default and BR-03 contract status', async () => {
    const response = await authenticatedRequest(
      app,
      'GET',
      '/api/v1/workspace-templates',
      user.sessionToken!
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(2);
    expect(typeof data.default_template_key).toBe('string');

    const templateKeys = data.items.map((item: { template_key: string }) => item.template_key);
    expect(templateKeys).toContain('ai-ideas');
    expect(templateKeys).toContain('todo');

    const activeDefaults = data.items.filter((item: { is_default: boolean }) => item.is_default);
    expect(activeDefaults.length).toBe(1);
    expect(activeDefaults[0].template_key).toBe(data.default_template_key);

    expect(data.br03_contracts.workflow_config.endpoint).toBe('/api/v1/workflow-config');
    expect(data.br03_contracts.agent_config.endpoint).toBe('/api/v1/agent-config');
    expect(['available', 'unavailable']).toContain(data.br03_contracts.workflow_config.status);
    expect(['available', 'unavailable']).toContain(data.br03_contracts.agent_config.status);
  });
});

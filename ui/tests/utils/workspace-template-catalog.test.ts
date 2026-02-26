import { describe, expect, it } from 'vitest';
import {
  getWorkspaceTemplateFallbackMessage,
  normalizeWorkspaceTemplateCatalogResponse,
} from '../../src/lib/utils/workspace-template-catalog';

describe('workspace template catalog utils', () => {
  it('normalizes catalog payload and resolves default template key', () => {
    const normalized = normalizeWorkspaceTemplateCatalogResponse({
      items: [
        {
          template_key: ' ai-ideas ',
          template_version: ' 1.0.0 ',
          status: 'ready',
          is_default: true,
          capabilities: [' usecase_generation '],
          workflow_refs: [' ai-usecase-generation '],
          agent_refs: [' matrix-generator '],
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

    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0].template_key).toBe('ai-ideas');
    expect(normalized.items[0].template_version).toBe('1.0.0');
    expect(normalized.default_template_key).toBe('ai-ideas');
  });

  it('builds deterministic fallback messages when warning is missing', () => {
    expect(
      getWorkspaceTemplateFallbackMessage({
        fallback_reason: 'template_unavailable',
        warning: null,
      })
    ).toContain('unavailable');

    expect(
      getWorkspaceTemplateFallbackMessage({
        fallback_reason: 'template_disabled',
        warning: null,
      })
    ).toContain('disabled');

    expect(
      getWorkspaceTemplateFallbackMessage({
        fallback_reason: null,
        warning: null,
      })
    ).toBeNull();
  });

  it('prefers explicit warning from API payload', () => {
    const warning = getWorkspaceTemplateFallbackMessage({
      fallback_reason: 'template_unavailable',
      warning: 'Custom warning from API.',
    });
    expect(warning).toBe('Custom warning from API.');
  });
});

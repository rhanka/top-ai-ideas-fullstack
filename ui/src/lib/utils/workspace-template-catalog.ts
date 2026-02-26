export type WorkspaceTemplateStatus = 'ready' | 'disabled';

export interface WorkspaceTemplateCatalogItem {
  template_key: string;
  template_version: string;
  status: WorkspaceTemplateStatus;
  is_default: boolean;
  capabilities: string[];
  workflow_refs: string[];
  agent_refs: string[];
}

export interface WorkspaceTemplateCatalogPayload {
  items: WorkspaceTemplateCatalogItem[];
  default_template_key: string;
}

export interface WorkspaceTemplateAssignmentPayload {
  workspace_id: string;
  requested_template_key: string;
  active_template_key: string;
  template_version: string;
  status: 'ready' | 'fallback';
  fallback_reason: 'template_unavailable' | 'template_disabled' | null;
  warning: string | null;
  assignment: {
    assigned_at: string | null;
    assigned_by_user_id: string | null;
    snapshot_policy: 'non_retroactive';
    applies_to_existing_artifacts: boolean;
    applies_to_new_artifacts: boolean;
  };
  template: WorkspaceTemplateCatalogItem;
}

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export function normalizeWorkspaceTemplateCatalogResponse(
  raw: Partial<WorkspaceTemplateCatalogPayload>
): WorkspaceTemplateCatalogPayload {
  const items = Array.isArray(raw?.items)
    ? raw.items
        .map((item) => {
          const templateKey = asTrimmedString(item?.template_key);
          const templateVersion = asTrimmedString(item?.template_version);
          const status = item?.status === 'disabled' ? 'disabled' : 'ready';
          if (!templateKey || !templateVersion) return null;
          return {
            template_key: templateKey,
            template_version: templateVersion,
            status,
            is_default: Boolean(item?.is_default),
            capabilities: asStringArray(item?.capabilities),
            workflow_refs: asStringArray(item?.workflow_refs),
            agent_refs: asStringArray(item?.agent_refs),
          } as WorkspaceTemplateCatalogItem;
        })
        .filter((item): item is WorkspaceTemplateCatalogItem => Boolean(item))
    : [];

  const defaultTemplateKey = asTrimmedString(raw?.default_template_key);
  const resolvedDefault =
    (defaultTemplateKey && items.find((item) => item.template_key === defaultTemplateKey)?.template_key) ||
    items.find((item) => item.is_default)?.template_key ||
    items[0]?.template_key ||
    '';

  return {
    items,
    default_template_key: resolvedDefault,
  };
}

export function getWorkspaceTemplateFallbackMessage(
  payload: Pick<WorkspaceTemplateAssignmentPayload, 'fallback_reason' | 'warning'>
): string | null {
  const explicitWarning = asTrimmedString(payload.warning);
  if (explicitWarning) return explicitWarning;

  if (payload.fallback_reason === 'template_unavailable') {
    return 'Assigned template is unavailable. Default template applied.';
  }
  if (payload.fallback_reason === 'template_disabled') {
    return 'Assigned template is disabled. Default template applied.';
  }
  return null;
}

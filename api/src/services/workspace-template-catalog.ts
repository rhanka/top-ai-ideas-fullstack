import { settingsService } from './settings';

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

export interface WorkspaceTemplateContractStatus {
  endpoint: '/api/v1/workflow-config' | '/api/v1/agent-config';
  status: 'available' | 'unavailable';
}

export interface WorkspaceTemplateCatalogPayload {
  items: WorkspaceTemplateCatalogItem[];
  default_template_key: string;
  br03_contracts: {
    workflow_config: WorkspaceTemplateContractStatus;
    agent_config: WorkspaceTemplateContractStatus;
  };
}

interface WorkspaceTemplateAssignmentRecord {
  template_key: string;
  assigned_at: string;
  assigned_by_user_id: string;
  snapshot_policy: 'non_retroactive';
}

export interface WorkspaceTemplateAssignmentProjection {
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
    applies_to_existing_artifacts: false;
    applies_to_new_artifacts: true;
  };
  template: WorkspaceTemplateCatalogItem;
  br03_contracts: WorkspaceTemplateCatalogPayload['br03_contracts'];
}

export const WORKSPACE_TEMPLATE_ASSIGNMENT_KEY_PREFIX = 'workspace_template_assignment_v1:';
const BR03_WORKFLOW_CONFIG_SNAPSHOT_KEY = 'br03_workflow_config_snapshot_v1';
const BR03_AGENT_CONFIG_SNAPSHOT_KEY = 'br03_agent_config_snapshot_v1';

export const WORKSPACE_TEMPLATE_CATALOG: WorkspaceTemplateCatalogItem[] = [
  {
    template_key: 'ai-ideas',
    template_version: '1.0.0',
    status: 'ready',
    is_default: true,
    capabilities: ['usecase_generation', 'matrix', 'executive_summary'],
    workflow_refs: ['ai-usecase-generation'],
    agent_refs: ['matrix-generator', 'usecase-generator', 'synthesis-agent'],
  },
  {
    template_key: 'todo',
    template_version: '1.0.0',
    status: 'ready',
    is_default: false,
    capabilities: ['todo_planning', 'task_tracking', 'guardrails'],
    workflow_refs: ['todo-planning-core'],
    agent_refs: ['plan-agent', 'review-agent', 'conductor-agent'],
  },
];

export function workspaceTemplateAssignmentSettingsKey(workspaceId: string): string {
  return `${WORKSPACE_TEMPLATE_ASSIGNMENT_KEY_PREFIX}${workspaceId}`;
}

function stableCatalog(items: WorkspaceTemplateCatalogItem[]): WorkspaceTemplateCatalogItem[] {
  return [...items].sort((a, b) => a.template_key.localeCompare(b.template_key));
}

function selectDefaultTemplate(
  items: WorkspaceTemplateCatalogItem[],
  explicitDefaultKey?: string | null
): WorkspaceTemplateCatalogItem {
  const sorted = stableCatalog(items);
  const readyItems = sorted.filter((item) => item.status === 'ready');
  const explicitReadyDefault = explicitDefaultKey
    ? readyItems.find((item) => item.template_key === explicitDefaultKey) ?? null
    : null;
  if (explicitReadyDefault) return explicitReadyDefault;

  const declaredReadyDefault = readyItems.find((item) => item.is_default) ?? null;
  if (declaredReadyDefault) return declaredReadyDefault;

  if (readyItems[0]) return readyItems[0];
  if (sorted[0]) return sorted[0];
  throw new Error('Workspace template catalog is empty.');
}

function parseAssignmentRecord(raw: string | null): WorkspaceTemplateAssignmentRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceTemplateAssignmentRecord>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.template_key !== 'string' || parsed.template_key.trim().length === 0) return null;
    if (typeof parsed.assigned_at !== 'string' || parsed.assigned_at.trim().length === 0) return null;
    if (typeof parsed.assigned_by_user_id !== 'string' || parsed.assigned_by_user_id.trim().length === 0) {
      return null;
    }
    return {
      template_key: parsed.template_key.trim(),
      assigned_at: parsed.assigned_at.trim(),
      assigned_by_user_id: parsed.assigned_by_user_id.trim(),
      snapshot_policy: 'non_retroactive',
    };
  } catch {
    return null;
  }
}

async function readBr03ContractStatus(): Promise<WorkspaceTemplateCatalogPayload['br03_contracts']> {
  const [workflowSnapshot, agentSnapshot] = await Promise.all([
    settingsService.get(BR03_WORKFLOW_CONFIG_SNAPSHOT_KEY, { fallbackToGlobal: false }),
    settingsService.get(BR03_AGENT_CONFIG_SNAPSHOT_KEY, { fallbackToGlobal: false }),
  ]);

  return {
    workflow_config: {
      endpoint: '/api/v1/workflow-config',
      status: workflowSnapshot ? 'available' : 'unavailable',
    },
    agent_config: {
      endpoint: '/api/v1/agent-config',
      status: agentSnapshot ? 'available' : 'unavailable',
    },
  };
}

export async function getWorkspaceTemplateCatalog(): Promise<WorkspaceTemplateCatalogPayload> {
  const defaultTemplate = selectDefaultTemplate(WORKSPACE_TEMPLATE_CATALOG);
  const br03Contracts = await readBr03ContractStatus();

  return {
    items: stableCatalog(WORKSPACE_TEMPLATE_CATALOG),
    default_template_key: defaultTemplate.template_key,
    br03_contracts: br03Contracts,
  };
}

export async function isKnownWorkspaceTemplate(templateKey: string): Promise<boolean> {
  const normalized = templateKey.trim();
  if (!normalized) return false;
  const catalog = await getWorkspaceTemplateCatalog();
  return catalog.items.some((item) => item.template_key === normalized);
}

export function resolveWorkspaceTemplateProjection(input: {
  workspaceId: string;
  catalog: WorkspaceTemplateCatalogPayload;
  assignment: WorkspaceTemplateAssignmentRecord | null;
}): WorkspaceTemplateAssignmentProjection {
  const defaultTemplate = selectDefaultTemplate(
    input.catalog.items,
    input.catalog.default_template_key
  );

  const requestedTemplateKey = input.assignment?.template_key ?? defaultTemplate.template_key;
  const requestedTemplate = input.catalog.items.find(
    (item) => item.template_key === requestedTemplateKey
  );

  let activeTemplate = requestedTemplate ?? defaultTemplate;
  let fallbackReason: WorkspaceTemplateAssignmentProjection['fallback_reason'] = null;

  if (!requestedTemplate && input.assignment) {
    fallbackReason = 'template_unavailable';
    activeTemplate = defaultTemplate;
  } else if (requestedTemplate && requestedTemplate.status !== 'ready') {
    fallbackReason = 'template_disabled';
    activeTemplate = defaultTemplate;
  }

  const warning =
    fallbackReason === 'template_unavailable'
      ? `Requested template "${requestedTemplateKey}" is unavailable. Default template applied.`
      : fallbackReason === 'template_disabled'
      ? `Requested template "${requestedTemplateKey}" is disabled. Default template applied.`
      : null;

  return {
    workspace_id: input.workspaceId,
    requested_template_key: requestedTemplateKey,
    active_template_key: activeTemplate.template_key,
    template_version: activeTemplate.template_version,
    status: fallbackReason ? 'fallback' : 'ready',
    fallback_reason: fallbackReason,
    warning,
    assignment: {
      assigned_at: input.assignment?.assigned_at ?? null,
      assigned_by_user_id: input.assignment?.assigned_by_user_id ?? null,
      snapshot_policy: 'non_retroactive',
      applies_to_existing_artifacts: false,
      applies_to_new_artifacts: true,
    },
    template: activeTemplate,
    br03_contracts: input.catalog.br03_contracts,
  };
}

export async function getWorkspaceTemplateAssignment(
  workspaceId: string
): Promise<WorkspaceTemplateAssignmentProjection> {
  const [catalog, rawAssignment] = await Promise.all([
    getWorkspaceTemplateCatalog(),
    settingsService.get(workspaceTemplateAssignmentSettingsKey(workspaceId), {
      fallbackToGlobal: false,
    }),
  ]);
  const parsedAssignment = parseAssignmentRecord(rawAssignment);

  return resolveWorkspaceTemplateProjection({
    workspaceId,
    catalog,
    assignment: parsedAssignment,
  });
}

export async function assignWorkspaceTemplate(params: {
  workspaceId: string;
  templateKey: string;
  assignedByUserId: string;
}): Promise<WorkspaceTemplateAssignmentProjection> {
  const nowIso = new Date().toISOString();
  const normalizedTemplateKey = params.templateKey.trim();

  const assignmentRecord: WorkspaceTemplateAssignmentRecord = {
    template_key: normalizedTemplateKey,
    assigned_at: nowIso,
    assigned_by_user_id: params.assignedByUserId.trim(),
    snapshot_policy: 'non_retroactive',
  };

  await settingsService.set(
    workspaceTemplateAssignmentSettingsKey(params.workspaceId),
    JSON.stringify(assignmentRecord),
    'Workspace template assignment (non-retroactive)',
    { fallbackToGlobal: false }
  );

  return getWorkspaceTemplateAssignment(params.workspaceId);
}

export type ChatToolScopeToggle = {
  id: string;
  toolIds: string[];
};

export type W1ScopeViolation =
  | 'multi_tab'
  | 'voice';

export const EXTENSION_NEW_SESSION_ALLOWED_TOOL_IDS = new Set<string>([
  'web_search',
  'web_extract',
  'tab_read',
  'tab_action',
]);

export const isExtensionRestrictedToolsetMode = (input: {
  mode: 'ai' | 'comments';
  hasExtensionRuntime: boolean;
  sessionId: string | null;
  extensionRestrictedToolset: boolean;
}): boolean =>
  input.mode === 'ai' &&
  input.hasExtensionRuntime &&
  (!input.sessionId || input.extensionRestrictedToolset);

export const computeToolToggleDefaults = (input: {
  toolToggles: ChatToolScopeToggle[];
  restrictedMode: boolean;
  allowedToolIds?: ReadonlySet<string>;
}): Record<string, boolean> => {
  const allowedToolIds =
    input.allowedToolIds ?? EXTENSION_NEW_SESSION_ALLOWED_TOOL_IDS;
  const defaults: Record<string, boolean> = {};
  for (const toggle of input.toolToggles) {
    defaults[toggle.id] = input.restrictedMode
      ? toggle.toolIds.some((id) => allowedToolIds.has(id))
      : true;
  }
  return defaults;
};

export const computeVisibleToolToggleIds = (input: {
  toolToggles: ChatToolScopeToggle[];
  restrictedMode: boolean;
  allowedToolIds?: ReadonlySet<string>;
}): string[] => {
  const allowedToolIds =
    input.allowedToolIds ?? EXTENSION_NEW_SESSION_ALLOWED_TOOL_IDS;
  if (!input.restrictedMode) {
    return input.toolToggles.map((toggle) => toggle.id);
  }
  return input.toolToggles
    .filter((toggle) => toggle.toolIds.some((id) => allowedToolIds.has(id)))
    .map((toggle) => toggle.id);
};

export const computeEnabledToolIds = (input: {
  toolToggles: ChatToolScopeToggle[];
  toolEnabledById: Record<string, boolean>;
  restrictedMode: boolean;
  allowedToolIds?: ReadonlySet<string>;
}): string[] => {
  const allowedToolIds =
    input.allowedToolIds ?? EXTENSION_NEW_SESSION_ALLOWED_TOOL_IDS;
  const enabled = new Set<string>();
  for (const toggle of input.toolToggles) {
    if (input.toolEnabledById[toggle.id] !== false) {
      toggle.toolIds.forEach((id) => enabled.add(id));
    }
  }
  const ids = Array.from(enabled);
  if (!input.restrictedMode) return ids;
  return ids.filter((id) => allowedToolIds.has(id));
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const detectW1ScopeViolation = (
  rawArgs: unknown,
): W1ScopeViolation | null => {
  const args = toRecord(rawArgs);
  if (!args) return null;

  const tabIds = Array.isArray(args.tabIds)
    ? args.tabIds.filter((value) => typeof value === 'number')
    : [];
  if (tabIds.length > 1) return 'multi_tab';

  const targetTabs = Array.isArray(args.target_tabs)
    ? args.target_tabs.filter(
        (value) => value && typeof value === 'object' && !Array.isArray(value),
      )
    : [];
  if (targetTabs.length > 1) return 'multi_tab';

  const voiceRequested =
    args.voice === true ||
    args.audio === true ||
    typeof args.voiceCommand === 'string' ||
    String(args.mode ?? '').trim().toLowerCase() === 'voice';

  return voiceRequested ? 'voice' : null;
};

export const getW1ScopeViolationMessage = (
  violation: W1ScopeViolation | null,
): string | null => {
  if (violation === 'multi_tab') {
    return 'W1 single-tab scope rejects multi-tab command payloads.';
  }
  if (violation === 'voice') {
    return 'W1 scope excludes voice command payloads.';
  }
  return null;
};

import { createId } from "../utils/id";

export const CHROME_UPSTREAM_PROTOCOL_VERSION = "v1" as const;

export type ChromeUpstreamLifecycleState =
  | "connecting"
  | "active"
  | "paused"
  | "closing"
  | "closed"
  | "error";

export type ChromeUpstreamAckStatus =
  | "accepted"
  | "rejected"
  | "completed"
  | "failed";

export type ChromeUpstreamErrorCode =
  | "session_not_found"
  | "session_scope_denied"
  | "sequence_conflict"
  | "single_tab_violation"
  | "unsupported_command"
  | "permission_scope_invalid"
  | "non_injectable_target"
  | "command_not_found"
  | "invalid_transition"
  | "invalid_ack";

export type ChromeUpstreamTargetTab = {
  tab_id: number;
  url?: string | null;
  origin?: string | null;
  title?: string | null;
};

export type ChromeUpstreamTransport = {
  primary: "ws";
  fallback: ["sse", "rest"];
  selected: "ws" | "sse_rest_fallback";
};

export type ChromeUpstreamSessionCapabilities = {
  single_tab: true;
  multi_tab: false;
  voice: false;
};

export type ChromeUpstreamPermissionMapping = {
  namespaces: ["tab_read:*", "tab_action:*"];
  action_to_permission: {
    click: "tab_action:click";
    input: "tab_action:input";
    scroll: "tab_action:scroll";
    wait: "tab_action:wait";
  };
};

export type ChromeUpstreamSessionSnapshot = {
  session_id: string;
  protocol_version: typeof CHROME_UPSTREAM_PROTOCOL_VERSION;
  user_id: string;
  workspace_id: string;
  extension_runtime_id: string;
  lifecycle_state: ChromeUpstreamLifecycleState;
  transport: ChromeUpstreamTransport;
  capabilities: ChromeUpstreamSessionCapabilities;
  permission_mapping: ChromeUpstreamPermissionMapping;
  active_tab_id: number | null;
  last_sequence: number;
  created_at: string;
  updated_at: string;
};

export type ChromeUpstreamCommandEnvelope = {
  session_id: string;
  command_id: string;
  sequence: number;
  command_kind: "tool_execute";
  tool_name: string;
  arguments: Record<string, unknown>;
  target_tab: ChromeUpstreamTargetTab;
  issued_at?: string;
};

export type ChromeUpstreamCommandError = {
  code: ChromeUpstreamErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ChromeUpstreamAckEnvelope = {
  session_id: string;
  command_id: string;
  sequence: number;
  status: ChromeUpstreamAckStatus;
  lifecycle_state: ChromeUpstreamLifecycleState;
  permission_scope?: string;
  error?: ChromeUpstreamCommandError;
  timestamps: {
    received_at: string;
    finalized_at?: string;
  };
};

export type ChromeUpstreamSessionEvent = {
  index: number;
  type: "session_state" | "command_ack";
  created_at: string;
  payload: {
    session_id: string;
    lifecycle_state?: ChromeUpstreamLifecycleState;
    ack?: ChromeUpstreamAckEnvelope;
    reason?: string;
  };
};

export type CreateChromeUpstreamSessionInput = {
  user_id: string;
  workspace_id: string;
  extension_runtime_id: string;
  ws_available: boolean;
  target_tab?: ChromeUpstreamTargetTab | null;
};

type RegisterChromeUpstreamCommandInput = {
  user_id: string;
  workspace_id: string;
  envelope: ChromeUpstreamCommandEnvelope;
};

type AcknowledgeChromeUpstreamCommandInput = {
  user_id: string;
  workspace_id: string;
  session_id: string;
  command_id: string;
  sequence: number;
  status: "completed" | "failed" | "rejected";
  error?: ChromeUpstreamCommandError;
};

type CommandRecord = {
  command_id: string;
  sequence: number;
  status: ChromeUpstreamAckStatus;
  permission_scope?: string;
  created_at: string;
  updated_at: string;
};

type SessionRecord = {
  snapshot: ChromeUpstreamSessionSnapshot;
  commands: Map<string, CommandRecord>;
  events: ChromeUpstreamSessionEvent[];
  next_event_index: number;
};

const NON_INJECTABLE_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "devtools://",
  "view-source:",
] as const;

const CAPABILITIES: ChromeUpstreamSessionCapabilities = {
  single_tab: true,
  multi_tab: false,
  voice: false,
};

const PERMISSION_MAPPING: ChromeUpstreamPermissionMapping = {
  namespaces: ["tab_read:*", "tab_action:*"],
  action_to_permission: {
    click: "tab_action:click",
    input: "tab_action:input",
    scroll: "tab_action:scroll",
    wait: "tab_action:wait",
  },
};

const MAX_EVENTS_PER_SESSION = 500;
const sessions = new Map<string, SessionRecord>();

const toIso = (date: Date = new Date()): string => date.toISOString();

const isNonInjectableUrl = (rawUrl?: string | null): boolean => {
  const value = String(rawUrl ?? "").trim();
  if (!value) return false;
  return NON_INJECTABLE_URL_PREFIXES.some((prefix) =>
    value.startsWith(prefix),
  );
};

const normalizeTabActionPermission = (
  action: unknown,
): "click" | "input" | "scroll" | "wait" | null => {
  const value = String(action ?? "").trim().toLowerCase();
  if (value === "type" || value === "input") return "input";
  if (value === "click" || value === "scroll" || value === "wait") {
    return value;
  }
  return null;
};

export const deriveUpstreamPermissionScope = (
  toolNameRaw: string,
  args: Record<string, unknown>,
): string | null => {
  const toolName = String(toolNameRaw ?? "").trim();
  if (!toolName) return null;

  if (toolName === "tab_read") {
    const modeRaw = String(args.mode ?? "").trim();
    const mode =
      modeRaw === "dom" ||
      modeRaw === "screenshot" ||
      modeRaw === "elements" ||
      modeRaw === "info"
        ? modeRaw
        : "info";
    return `tab_read:${mode}`;
  }

  if (toolName === "tab_info") return "tab_read:info";
  if (toolName === "tab_read_dom") return "tab_read:dom";
  if (toolName === "tab_screenshot") return "tab_read:screenshot";

  if (toolName === "tab_action") {
    const steps = Array.isArray(args.actions)
      ? args.actions
      : typeof args.action === "string"
        ? [args]
        : [];
    if (steps.length === 0) return "tab_action:*";
    const actionKinds = new Set<"click" | "input" | "scroll" | "wait">();
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const normalized = normalizeTabActionPermission(
        (step as Record<string, unknown>).action,
      );
      if (normalized) actionKinds.add(normalized);
    }
    if (actionKinds.size !== 1) return "tab_action:*";
    return `tab_action:${Array.from(actionKinds)[0]}`;
  }

  if (toolName === "tab_click") return "tab_action:click";
  if (toolName === "tab_type") return "tab_action:input";
  if (toolName === "tab_scroll") return "tab_action:scroll";

  return null;
};

const scopeUsesSupportedNamespace = (scope: string): boolean =>
  scope.startsWith("tab_read:") || scope.startsWith("tab_action:");

const pushSessionEvent = (
  session: SessionRecord,
  event: Omit<ChromeUpstreamSessionEvent, "index">,
): void => {
  const indexed: ChromeUpstreamSessionEvent = {
    ...event,
    index: session.next_event_index,
  };
  session.next_event_index += 1;
  session.events.push(indexed);
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.splice(0, session.events.length - MAX_EVENTS_PER_SESSION);
  }
};

const touchSession = (
  session: SessionRecord,
  state?: ChromeUpstreamLifecycleState,
  reason?: string,
): void => {
  const now = toIso();
  if (state && session.snapshot.lifecycle_state !== state) {
    session.snapshot.lifecycle_state = state;
    pushSessionEvent(session, {
      type: "session_state",
      created_at: now,
      payload: {
        session_id: session.snapshot.session_id,
        lifecycle_state: state,
        reason,
      },
    });
  }
  session.snapshot.updated_at = now;
};

const findSessionForActor = (
  session_id: string,
  user_id: string,
  workspace_id: string,
): SessionRecord | null => {
  const session = sessions.get(session_id);
  if (!session) return null;
  if (session.snapshot.user_id !== user_id) return null;
  if (session.snapshot.workspace_id !== workspace_id) return null;
  return session;
};

const buildRejectedAck = (
  session_id: string,
  command_id: string,
  sequence: number,
  lifecycle_state: ChromeUpstreamLifecycleState,
  error: ChromeUpstreamCommandError,
): ChromeUpstreamAckEnvelope => ({
  session_id,
  command_id,
  sequence,
  status: "rejected",
  lifecycle_state,
  error,
  timestamps: {
    received_at: toIso(),
    finalized_at: toIso(),
  },
});

export const createChromeUpstreamSession = (
  input: CreateChromeUpstreamSessionInput,
): ChromeUpstreamSessionSnapshot => {
  const now = toIso();
  const session_id = createId();
  const transport: ChromeUpstreamTransport = {
    primary: "ws",
    fallback: ["sse", "rest"],
    selected: input.ws_available ? "ws" : "sse_rest_fallback",
  };

  const snapshot: ChromeUpstreamSessionSnapshot = {
    session_id,
    protocol_version: CHROME_UPSTREAM_PROTOCOL_VERSION,
    user_id: input.user_id,
    workspace_id: input.workspace_id,
    extension_runtime_id: input.extension_runtime_id,
    lifecycle_state: "active",
    transport,
    capabilities: CAPABILITIES,
    permission_mapping: PERMISSION_MAPPING,
    active_tab_id:
      typeof input.target_tab?.tab_id === "number"
        ? input.target_tab.tab_id
        : null,
    last_sequence: 0,
    created_at: now,
    updated_at: now,
  };

  const session: SessionRecord = {
    snapshot,
    commands: new Map<string, CommandRecord>(),
    events: [],
    next_event_index: 1,
  };

  pushSessionEvent(session, {
    type: "session_state",
    created_at: now,
    payload: {
      session_id,
      lifecycle_state: "active",
      reason: "session_started",
    },
  });

  sessions.set(session_id, session);
  return { ...snapshot };
};

export const getChromeUpstreamSession = (
  session_id: string,
  user_id: string,
  workspace_id: string,
): ChromeUpstreamSessionSnapshot | null => {
  const session = findSessionForActor(session_id, user_id, workspace_id);
  if (!session) return null;
  return { ...session.snapshot };
};

export const listChromeUpstreamSessionEvents = (options: {
  session_id: string;
  user_id: string;
  workspace_id: string;
  limit?: number;
}): ChromeUpstreamSessionEvent[] | null => {
  const session = findSessionForActor(
    options.session_id,
    options.user_id,
    options.workspace_id,
  );
  if (!session) return null;

  const limit = Number.isFinite(options.limit)
    ? Math.min(Math.max(Number(options.limit), 1), 500)
    : 200;
  return session.events.slice(-limit).map((event) => ({
    ...event,
    payload: { ...event.payload },
  }));
};

export const registerChromeUpstreamCommand = (
  input: RegisterChromeUpstreamCommandInput,
): ChromeUpstreamAckEnvelope => {
  const envelope = input.envelope;
  const session = findSessionForActor(
    envelope.session_id,
    input.user_id,
    input.workspace_id,
  );

  if (!session) {
    return buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      "error",
      {
        code: "session_not_found",
        message:
          "Upstream session not found for current user/workspace context.",
      },
    );
  }

  if (
    session.snapshot.lifecycle_state === "closing" ||
    session.snapshot.lifecycle_state === "closed"
  ) {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "invalid_transition",
        message: "Session is closing or closed.",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  const expectedSequence = session.snapshot.last_sequence + 1;
  if (envelope.sequence !== expectedSequence) {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "sequence_conflict",
        message: `Invalid command sequence: expected ${expectedSequence}.`,
        details: {
          expected_sequence: expectedSequence,
          received_sequence: envelope.sequence,
        },
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  if (
    session.snapshot.active_tab_id !== null &&
    session.snapshot.active_tab_id !== envelope.target_tab.tab_id
  ) {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "single_tab_violation",
        message:
          "W1 single-tab baseline rejects commands targeting a different tab.",
        details: {
          active_tab_id: session.snapshot.active_tab_id,
          requested_tab_id: envelope.target_tab.tab_id,
        },
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  if (isNonInjectableUrl(envelope.target_tab.url)) {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "non_injectable_target",
        message: "Target tab URL is not injectable in browser runtime.",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  if (envelope.command_kind !== "tool_execute") {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "unsupported_command",
        message: `Unsupported command kind: ${envelope.command_kind}`,
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  const permission_scope = deriveUpstreamPermissionScope(
    envelope.tool_name,
    envelope.arguments,
  );
  if (!permission_scope || !scopeUsesSupportedNamespace(permission_scope)) {
    const ack = buildRejectedAck(
      envelope.session_id,
      envelope.command_id,
      envelope.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "permission_scope_invalid",
        message:
          "Command does not map to allowed permission namespaces (tab_read:* / tab_action:*).",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: envelope.session_id, ack },
    });
    return ack;
  }

  const now = toIso();
  const ack: ChromeUpstreamAckEnvelope = {
    session_id: envelope.session_id,
    command_id: envelope.command_id,
    sequence: envelope.sequence,
    status: "accepted",
    lifecycle_state: session.snapshot.lifecycle_state,
    permission_scope,
    timestamps: {
      received_at: now,
    },
  };

  session.snapshot.active_tab_id = envelope.target_tab.tab_id;
  session.snapshot.last_sequence = envelope.sequence;
  touchSession(session);

  session.commands.set(envelope.command_id, {
    command_id: envelope.command_id,
    sequence: envelope.sequence,
    status: ack.status,
    permission_scope,
    created_at: now,
    updated_at: now,
  });

  pushSessionEvent(session, {
    type: "command_ack",
    created_at: now,
    payload: { session_id: envelope.session_id, ack },
  });

  return ack;
};

export const acknowledgeChromeUpstreamCommand = (
  input: AcknowledgeChromeUpstreamCommandInput,
): ChromeUpstreamAckEnvelope => {
  const session = findSessionForActor(
    input.session_id,
    input.user_id,
    input.workspace_id,
  );

  if (!session) {
    return buildRejectedAck(
      input.session_id,
      input.command_id,
      input.sequence,
      "error",
      {
        code: "session_not_found",
        message:
          "Upstream session not found for current user/workspace context.",
      },
    );
  }

  const command = session.commands.get(input.command_id);
  if (!command) {
    const ack = buildRejectedAck(
      input.session_id,
      input.command_id,
      input.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "command_not_found",
        message: "Command is unknown for this session.",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: input.session_id, ack },
    });
    return ack;
  }

  if (command.sequence !== input.sequence) {
    const ack = buildRejectedAck(
      input.session_id,
      input.command_id,
      input.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "sequence_conflict",
        message:
          "Command sequence mismatch between command envelope and terminal ack.",
        details: {
          expected_sequence: command.sequence,
          received_sequence: input.sequence,
        },
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: input.session_id, ack },
    });
    return ack;
  }

  if (
    command.status === "completed" ||
    command.status === "failed" ||
    command.status === "rejected"
  ) {
    const ack = buildRejectedAck(
      input.session_id,
      input.command_id,
      input.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "invalid_transition",
        message: "Terminal command status already recorded.",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: input.session_id, ack },
    });
    return ack;
  }

  if (
    (input.status === "failed" || input.status === "rejected") &&
    !input.error
  ) {
    const ack = buildRejectedAck(
      input.session_id,
      input.command_id,
      input.sequence,
      session.snapshot.lifecycle_state,
      {
        code: "invalid_ack",
        message:
          "Terminal failed/rejected acknowledgements must include an error payload.",
      },
    );
    pushSessionEvent(session, {
      type: "command_ack",
      created_at: ack.timestamps.received_at,
      payload: { session_id: input.session_id, ack },
    });
    return ack;
  }

  const now = toIso();
  command.status = input.status;
  command.updated_at = now;
  touchSession(session, input.status === "failed" ? "error" : undefined);

  const ack: ChromeUpstreamAckEnvelope = {
    session_id: input.session_id,
    command_id: input.command_id,
    sequence: input.sequence,
    status: input.status,
    lifecycle_state: session.snapshot.lifecycle_state,
    permission_scope: command.permission_scope,
    error: input.error,
    timestamps: {
      received_at: now,
      finalized_at: now,
    },
  };

  pushSessionEvent(session, {
    type: "command_ack",
    created_at: now,
    payload: { session_id: input.session_id, ack },
  });

  return ack;
};

export const closeChromeUpstreamSession = (options: {
  session_id: string;
  user_id: string;
  workspace_id: string;
  reason?: string;
}): ChromeUpstreamSessionSnapshot | null => {
  const session = findSessionForActor(
    options.session_id,
    options.user_id,
    options.workspace_id,
  );
  if (!session) return null;
  touchSession(session, "closed", options.reason ?? "closed_by_client");
  return { ...session.snapshot };
};

export const resetChromeUpstreamSessionsForTests = (): void => {
  sessions.clear();
};

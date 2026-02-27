type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type WebSocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (
    type: 'open' | 'error' | 'close',
    listener: (event: Event) => void,
  ) => void;
  removeEventListener: (
    type: 'open' | 'error' | 'close',
    listener: (event: Event) => void,
  ) => void;
};

type WebSocketFactory = (url: string) => WebSocketLike;

const NON_INJECTABLE_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'view-source:',
] as const;

const CHROME_UPSTREAM_PROTOCOL_VERSION = 'v1' as const;

export type UpstreamTargetTab = {
  tab_id: number;
  url?: string | null;
  origin?: string | null;
  title?: string | null;
};

export type UpstreamSessionSnapshot = {
  session_id: string;
  protocol_version: typeof CHROME_UPSTREAM_PROTOCOL_VERSION;
  lifecycle_state:
    | 'connecting'
    | 'active'
    | 'paused'
    | 'closing'
    | 'closed'
    | 'error';
  transport: {
    primary: 'ws';
    fallback: ['sse', 'rest'];
    selected: 'ws' | 'sse_rest_fallback';
  };
  active_tab_id: number | null;
  last_sequence: number;
};

export type UpstreamCommandEnvelope = {
  session_id: string;
  command_id: string;
  sequence: number;
  command_kind: 'tool_execute';
  tool_name: string;
  arguments: Record<string, unknown>;
  target_tab: UpstreamTargetTab;
  issued_at: string;
};

export type UpstreamCommandAck = {
  session_id: string;
  command_id: string;
  sequence: number;
  status: 'accepted' | 'rejected' | 'completed' | 'failed';
  lifecycle_state: string;
  permission_scope?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamps: {
    received_at: string;
    finalized_at?: string;
  };
};

export type UpstreamSessionState = {
  session: UpstreamSessionSnapshot | null;
  lifecycle_state: 'idle' | UpstreamSessionSnapshot['lifecycle_state'];
  selected_transport: 'none' | 'ws' | 'sse_rest_fallback';
  ws_connected: boolean;
  next_sequence: number;
  last_error: string | null;
};

export type OpenUpstreamSessionInput = {
  api_base_url: string;
  access_token: string;
  extension_runtime_id: string;
  ws_base_url?: string;
  target_tab?: UpstreamTargetTab;
};

export type SendUpstreamCommandInput = {
  command_id?: string;
  tool_name: string;
  arguments?: Record<string, unknown>;
  target_tab: UpstreamTargetTab;
};

export type ReportUpstreamAckInput = {
  command_id: string;
  sequence: number;
  status: 'completed' | 'failed' | 'rejected';
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

type Dependencies = {
  fetcher: FetchLike;
  ws_factory: WebSocketFactory;
  now: () => Date;
  random_id: () => string;
};

const defaultDependencies: Dependencies = {
  fetcher: (input, init) => fetch(input, init),
  ws_factory: (url) => new WebSocket(url) as unknown as WebSocketLike,
  now: () => new Date(),
  random_id: () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
};

const trimSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const isInjectableTabUrl = (rawUrl?: string | null): boolean => {
  const value = String(rawUrl ?? '').trim();
  if (!value) return true;
  return !NON_INJECTABLE_URL_PREFIXES.some((prefix) => value.startsWith(prefix));
};

const resolveWsBaseUrl = (
  wsBaseUrlRaw: string | undefined,
  apiBaseUrlRaw: string,
): string | null => {
  const wsBaseUrl = String(wsBaseUrlRaw ?? '').trim();
  if (wsBaseUrl) {
    try {
      const parsed = new URL(wsBaseUrl);
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null;
      return trimSlash(parsed.toString());
    } catch {
      return null;
    }
  }

  try {
    const parsedApi = new URL(apiBaseUrlRaw);
    const wsProtocol = parsedApi.protocol === 'https:' ? 'wss:' : 'ws:';
    const pathname = parsedApi.pathname.replace(/\/api\/v1\/?$/, '') || '/';
    const normalizedPath = pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;
    return `${wsProtocol}//${parsedApi.host}${normalizedPath}`;
  } catch {
    return null;
  }
};

export class ChromeUpstreamSessionClient {
  private readonly deps: Dependencies;
  private ws: WebSocketLike | null = null;
  private apiBaseUrl: string | null = null;
  private accessToken: string | null = null;
  private state: UpstreamSessionState = {
    session: null,
    lifecycle_state: 'idle',
    selected_transport: 'none',
    ws_connected: false,
    next_sequence: 1,
    last_error: null,
  };

  constructor(overrides?: Partial<Dependencies>) {
    this.deps = { ...defaultDependencies, ...overrides };
  }

  getState(): UpstreamSessionState {
    return {
      ...this.state,
      session: this.state.session ? { ...this.state.session } : null,
    };
  }

  private closeWs() {
    if (!this.ws) return;
    try {
      this.ws.close();
    } catch {
      // noop
    }
    this.ws = null;
    this.state.ws_connected = false;
    if (this.state.selected_transport === 'ws') {
      this.state.selected_transport = 'sse_rest_fallback';
    }
  }

  async openSession(input: OpenUpstreamSessionInput): Promise<UpstreamSessionState> {
    const apiBaseUrl = trimSlash(input.api_base_url);
    this.apiBaseUrl = apiBaseUrl;
    this.accessToken = input.access_token;
    this.state.lifecycle_state = 'connecting';
    this.state.last_error = null;

    const wsBaseUrl = resolveWsBaseUrl(input.ws_base_url, apiBaseUrl);
    const wsAvailable = Boolean(wsBaseUrl);

    const payload = {
      extension_runtime_id: input.extension_runtime_id,
      ws_available: wsAvailable,
      target_tab: input.target_tab,
    };

    const response = await this.deps.fetcher(`${apiBaseUrl}/chrome-extension/upstream/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.state.lifecycle_state = 'error';
      this.state.last_error = `Unable to create upstream session: HTTP ${response.status}`;
      return this.getState();
    }

    const body = (await response.json()) as {
      session?: UpstreamSessionSnapshot;
    };
    if (!body?.session?.session_id) {
      this.state.lifecycle_state = 'error';
      this.state.last_error = 'Upstream session response is missing session payload.';
      return this.getState();
    }

    this.state.session = body.session;
    this.state.lifecycle_state = body.session.lifecycle_state;
    this.state.selected_transport = body.session.transport.selected;
    this.state.next_sequence = body.session.last_sequence + 1;
    this.state.last_error = null;

    this.closeWs();
    if (wsBaseUrl && body.session.transport.primary === 'ws') {
      const wsUrl = `${wsBaseUrl}/chrome-extension/upstream/ws?session_id=${encodeURIComponent(
        body.session.session_id,
      )}&protocol=${CHROME_UPSTREAM_PROTOCOL_VERSION}`;
      try {
        const ws = this.deps.ws_factory(wsUrl);
        const onOpen = () => {
          this.state.ws_connected = true;
          this.state.selected_transport = 'ws';
        };
        const onCloseOrError = () => {
          if (this.ws !== ws) return;
          this.state.ws_connected = false;
          this.state.selected_transport = 'sse_rest_fallback';
        };
        ws.addEventListener('open', onOpen);
        ws.addEventListener('close', onCloseOrError);
        ws.addEventListener('error', onCloseOrError);
        this.ws = ws;
      } catch {
        this.state.ws_connected = false;
        this.state.selected_transport = 'sse_rest_fallback';
      }
    }

    return this.getState();
  }

  private ensureSessionContext(): {
    session: UpstreamSessionSnapshot;
    apiBaseUrl: string;
    accessToken: string;
  } {
    const session = this.state.session;
    if (!session || !this.apiBaseUrl || !this.accessToken) {
      throw new Error('Upstream session is not initialized.');
    }
    return {
      session,
      apiBaseUrl: this.apiBaseUrl,
      accessToken: this.accessToken,
    };
  }

  private buildCommandEnvelope(
    input: SendUpstreamCommandInput,
  ): UpstreamCommandEnvelope {
    const { session } = this.ensureSessionContext();
    const command_id = String(input.command_id ?? '').trim() || this.deps.random_id();
    const sequence = this.state.next_sequence;

    return {
      session_id: session.session_id,
      command_id,
      sequence,
      command_kind: 'tool_execute',
      tool_name: input.tool_name,
      arguments: input.arguments ?? {},
      target_tab: input.target_tab,
      issued_at: this.deps.now().toISOString(),
    };
  }

  async sendCommand(input: SendUpstreamCommandInput): Promise<UpstreamCommandAck> {
    const { session, apiBaseUrl, accessToken } = this.ensureSessionContext();
    if (!isInjectableTabUrl(input.target_tab.url)) {
      throw new Error('Target tab URL is non-injectable in extension runtime.');
    }
    if (
      session.active_tab_id !== null &&
      session.active_tab_id !== input.target_tab.tab_id
    ) {
      throw new Error('Single-tab upstream baseline forbids switching target tab.');
    }

    const envelope = this.buildCommandEnvelope(input);

    if (this.ws && this.state.ws_connected && this.state.selected_transport === 'ws') {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'upstream_command',
            envelope,
          }),
        );
      } catch {
        this.state.ws_connected = false;
        this.state.selected_transport = 'sse_rest_fallback';
      }
    }

    const response = await this.deps.fetcher(
      `${apiBaseUrl}/chrome-extension/upstream/session/${encodeURIComponent(
        session.session_id,
      )}/command`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
      },
    );

    const body = (await response.json()) as {
      ack?: UpstreamCommandAck;
    };
    if (!body?.ack) {
      throw new Error('Upstream command endpoint returned no ack payload.');
    }

    this.state.next_sequence = Math.max(this.state.next_sequence, envelope.sequence + 1);
    if (body.ack.status === 'accepted') {
      session.active_tab_id = input.target_tab.tab_id;
      session.last_sequence = envelope.sequence;
      this.state.lifecycle_state = 'active';
    } else if (body.ack.status === 'failed') {
      this.state.lifecycle_state = 'error';
      this.state.last_error = body.ack.error?.message ?? 'Command execution failed.';
    }

    return body.ack;
  }

  async reportCommandAck(input: ReportUpstreamAckInput): Promise<UpstreamCommandAck> {
    const { session, apiBaseUrl, accessToken } = this.ensureSessionContext();
    const payload = {
      session_id: session.session_id,
      command_id: input.command_id,
      sequence: input.sequence,
      status: input.status,
      error: input.error,
    };

    const response = await this.deps.fetcher(
      `${apiBaseUrl}/chrome-extension/upstream/session/${encodeURIComponent(
        session.session_id,
      )}/ack`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ack?: UpstreamCommandAck;
    };
    if (!body?.ack) {
      throw new Error('Upstream ack endpoint returned no ack payload.');
    }

    if (body.ack.status === 'failed') {
      this.state.lifecycle_state = 'error';
      this.state.last_error = body.ack.error?.message ?? 'Upstream command failed.';
    }
    return body.ack;
  }

  async closeSession(reason?: string): Promise<void> {
    const { session, apiBaseUrl, accessToken } = this.ensureSessionContext();
    await this.deps.fetcher(
      `${apiBaseUrl}/chrome-extension/upstream/session/${encodeURIComponent(
        session.session_id,
      )}/close`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );
    this.closeWs();
    this.state.lifecycle_state = 'closed';
    this.state.selected_transport = 'none';
    this.state.session = null;
    this.state.next_sequence = 1;
  }
}

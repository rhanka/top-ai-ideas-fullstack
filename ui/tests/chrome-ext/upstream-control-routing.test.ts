import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadExtensionConfigMock,
  saveExtensionConfigMock,
  getValidAccessTokenMock,
  sendCommandMock,
  normalizeRuntimePermissionOriginMock,
  bootstrapToolPermissionSyncMock,
} = vi.hoisted(() => ({
  loadExtensionConfigMock: vi.fn(),
  saveExtensionConfigMock: vi.fn(),
  getValidAccessTokenMock: vi.fn(),
  sendCommandMock: vi.fn(),
  normalizeRuntimePermissionOriginMock: vi.fn(),
  bootstrapToolPermissionSyncMock: vi.fn(),
}));

vi.mock('../../chrome-ext/extension-config', () => ({
  loadExtensionConfig: loadExtensionConfigMock,
  saveExtensionConfig: saveExtensionConfigMock,
}));

vi.mock('../../chrome-ext/extension-auth', () => ({
  connectExtensionAuth: vi.fn(),
  getExtensionAuthStatus: vi.fn(),
  getValidAccessToken: getValidAccessTokenMock,
  logoutExtensionAuth: vi.fn(),
}));

vi.mock('../../chrome-ext/tool-executor', () => ({
  createToolExecutors: vi.fn(() => ({})),
}));

vi.mock('../../chrome-ext/tool-permissions', () => ({
  applyToolPermissionDecision: vi.fn(),
  bootstrapToolPermissionSync: bootstrapToolPermissionSyncMock,
  evaluateToolPermission: vi.fn(),
  listToolPermissionPolicies: vi.fn(async () => []),
  normalizePermissionOrigin: vi.fn((value: string) => value),
  normalizeRuntimePermissionOrigin: normalizeRuntimePermissionOriginMock,
  upsertToolPermissionPolicy: vi.fn(),
  deleteToolPermissionPolicy: vi.fn(),
}));

vi.mock('../../chrome-ext/upstream-session', () => ({
  ChromeUpstreamSessionClient: class ChromeUpstreamSessionClientMock {
    openSession = vi.fn();
    sendCommand = sendCommandMock;
    reportCommandAck = vi.fn();
    closeSession = vi.fn();
    getState = vi.fn(() => ({
      session: null,
      lifecycle_state: 'idle',
      selected_transport: 'none',
      ws_connected: false,
      next_sequence: 1,
      last_error: null,
    }));
  },
}));

type OnMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

const importBackground = async () => {
  vi.resetModules();

  let onMessageListener: OnMessageListener | null = null;
  const tabsQueryMock = vi.fn(async () => []);
  const tabsGetMock = vi.fn(async () => null);

  (globalThis as any).chrome = {
    runtime: {
      id: 'ext-test-runtime',
      onConnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn((listener: OnMessageListener) => {
          onMessageListener = listener;
        }),
      },
    },
    sidePanel: {
      setPanelBehavior: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
    },
    tabs: {
      query: tabsQueryMock,
      get: tabsGetMock,
      create: vi.fn(async () => undefined),
    },
  };

  await import('../../chrome-ext/background');

  if (!onMessageListener) {
    throw new Error('background onMessage listener was not registered');
  }

  const invoke = async (
    message: unknown,
    sender: chrome.runtime.MessageSender = {},
  ): Promise<any> =>
    new Promise((resolve, reject) => {
      try {
        const keepAlive = onMessageListener!(
          message,
          sender,
          (response: unknown) => resolve(response),
        );
        if (keepAlive !== true) {
          reject(new Error('Expected async listener to return true.'));
        }
      } catch (error) {
        reject(error);
      }
    });

  return {
    invoke,
    tabsQueryMock,
    tabsGetMock,
  };
};

describe('chrome-ext upstream control routing', () => {
  beforeEach(() => {
    loadExtensionConfigMock.mockReset();
    saveExtensionConfigMock.mockReset();
    getValidAccessTokenMock.mockReset();
    sendCommandMock.mockReset();
    normalizeRuntimePermissionOriginMock.mockReset();
    bootstrapToolPermissionSyncMock.mockReset();

    loadExtensionConfigMock.mockResolvedValue({
      apiBaseUrl: 'http://localhost:8787/api/v1',
      appBaseUrl: 'http://localhost:5106',
      wsBaseUrl: 'ws://localhost:8787',
      profile: 'dev',
    });
    normalizeRuntimePermissionOriginMock.mockImplementation((url: string) => {
      try {
        return new URL(url).origin;
      } catch {
        return null;
      }
    });
    sendCommandMock.mockResolvedValue({
      session_id: 'sess-1',
      command_id: 'cmd-1',
      sequence: 1,
      status: 'accepted',
      lifecycle_state: 'active',
      permission_scope: 'tab_read:info',
      timestamps: {
        received_at: '2026-02-26T19:00:00.000Z',
      },
    });
  });

  it('routes explicit upstream command payloads to the upstream session client', async () => {
    const { invoke } = await importBackground();

    const response = await invoke(
      {
        type: 'upstream_session_command',
        payload: {
          command_id: 'cmd-explicit',
          tool_name: 'tab_read',
          arguments: { mode: 'info' },
          target_tab: {
            tab_id: 31,
            url: 'https://example.com/workspace',
            origin: 'https://example.com',
            title: 'Workspace',
          },
        },
      },
      {},
    );

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sendCommandMock).toHaveBeenCalledWith({
      command_id: 'cmd-explicit',
      tool_name: 'tab_read',
      arguments: { mode: 'info' },
      target_tab: {
        tab_id: 31,
        url: 'https://example.com/workspace',
        origin: 'https://example.com',
        title: 'Workspace',
      },
    });
    expect(response.ok).toBe(true);
    expect(response.ack.status).toBe('accepted');
  });

  it('resolves fallback target tab when no target_tab is provided', async () => {
    const { invoke, tabsQueryMock } = await importBackground();
    tabsQueryMock.mockImplementation(async (queryInfo: chrome.tabs.QueryInfo) => {
      if (queryInfo.lastFocusedWindow) {
        return [
          {
            id: 52,
            windowId: 9,
            url: 'https://fallback.example/page',
            title: 'Fallback tab',
          } as chrome.tabs.Tab,
        ];
      }
      return [];
    });

    const response = await invoke(
      {
        type: 'upstream_session_command',
        payload: {
          tool_name: 'tab_action',
          arguments: {
            actions: [{ action: 'click', selector: '#run' }],
          },
        },
      },
      {},
    );

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(sendCommandMock).toHaveBeenCalledWith({
      command_id: undefined,
      tool_name: 'tab_action',
      arguments: {
        actions: [{ action: 'click', selector: '#run' }],
      },
      target_tab: {
        tab_id: 52,
        url: 'https://fallback.example/page',
        origin: 'https://fallback.example',
        title: 'Fallback tab',
      },
    });
    expect(response.ok).toBe(true);
  });

  it('returns a clear validation error when tool_name is missing', async () => {
    const { invoke } = await importBackground();

    const response = await invoke(
      {
        type: 'upstream_session_command',
        payload: {
          command_id: 'cmd-no-tool',
        },
      },
      {},
    );

    expect(sendCommandMock).not.toHaveBeenCalled();
    expect(response).toEqual({
      ok: false,
      error: 'tool_name is required for upstream command.',
    });
  });
});

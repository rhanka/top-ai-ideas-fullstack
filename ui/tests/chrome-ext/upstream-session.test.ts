import { describe, expect, it, vi } from 'vitest';
import { ChromeUpstreamSessionClient } from '../../chrome-ext/upstream-session';

class MockWebSocket {
  readyState = 1;
  sent: string[] = [];
  private listeners = new Map<
    'open' | 'error' | 'close',
    Array<(event: Event) => void>
  >();
  private shouldThrowOnSend = false;

  setSendFailure(enabled: boolean) {
    this.shouldThrowOnSend = enabled;
  }

  send(data: string) {
    if (this.shouldThrowOnSend) {
      throw new Error('ws send failed');
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  addEventListener(
    type: 'open' | 'error' | 'close',
    listener: (event: Event) => void,
  ) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }

  removeEventListener(
    type: 'open' | 'error' | 'close',
    listener: (event: Event) => void,
  ) {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      arr.filter((item) => item !== listener),
    );
  }

  emit(type: 'open' | 'error' | 'close') {
    const arr = this.listeners.get(type) ?? [];
    for (const listener of arr) {
      listener({ type } as Event);
    }
  }
}

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('chrome-ext upstream-session client', () => {
  it('opens a session, attempts WS transport, and sends command envelope', async () => {
    const fetcher = vi.fn();
    const ws = new MockWebSocket();
    const wsFactory = vi.fn(() => ws);

    fetcher.mockResolvedValueOnce(
      jsonResponse(201, {
        session: {
          session_id: 'sess-1',
          protocol_version: 'v1',
          lifecycle_state: 'active',
          transport: {
            primary: 'ws',
            fallback: ['sse', 'rest'],
            selected: 'ws',
          },
          active_tab_id: null,
          last_sequence: 0,
        },
      }),
    );
    fetcher.mockResolvedValueOnce(
      jsonResponse(202, {
        ack: {
          session_id: 'sess-1',
          command_id: 'cmd-1',
          sequence: 1,
          status: 'accepted',
          lifecycle_state: 'active',
          permission_scope: 'tab_read:info',
          timestamps: { received_at: '2026-02-26T10:00:00.000Z' },
        },
      }),
    );

    const client = new ChromeUpstreamSessionClient({
      fetcher: fetcher as any,
      ws_factory: wsFactory as any,
      now: () => new Date('2026-02-26T10:00:00.000Z'),
      random_id: () => 'cmd-generated',
    });

    const opened = await client.openSession({
      api_base_url: 'https://api.example.com/api/v1',
      access_token: 'token-1',
      extension_runtime_id: 'ext-1',
      ws_base_url: 'wss://api.example.com',
    });

    expect(opened.lifecycle_state).toBe('active');
    expect(opened.selected_transport).toBe('ws');
    expect(wsFactory).toHaveBeenCalledTimes(1);
    expect(wsFactory.mock.calls[0][0]).toContain('session_id=sess-1');

    ws.emit('open');
    expect(client.getState().ws_connected).toBe(true);

    const ack = await client.sendCommand({
      command_id: 'cmd-1',
      tool_name: 'tab_read',
      arguments: { mode: 'info' },
      target_tab: { tab_id: 77, url: 'https://example.com' },
    });

    expect(ack.status).toBe('accepted');
    expect(ws.sent.length).toBe(1);
    const wsPayload = JSON.parse(ws.sent[0]);
    expect(wsPayload.type).toBe('upstream_command');
    expect(wsPayload.envelope.sequence).toBe(1);
    expect(wsPayload.envelope.target_tab.tab_id).toBe(77);

    const postBody = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(postBody.session_id).toBe('sess-1');
    expect(postBody.command_id).toBe('cmd-1');
    expect(postBody.sequence).toBe(1);
  });

  it('falls back to REST mode when WS send fails and enforces single-tab guard', async () => {
    const fetcher = vi.fn();
    const ws = new MockWebSocket();
    const wsFactory = vi.fn(() => ws);

    fetcher.mockResolvedValueOnce(
      jsonResponse(201, {
        session: {
          session_id: 'sess-2',
          protocol_version: 'v1',
          lifecycle_state: 'active',
          transport: {
            primary: 'ws',
            fallback: ['sse', 'rest'],
            selected: 'ws',
          },
          active_tab_id: null,
          last_sequence: 0,
        },
      }),
    );
    fetcher.mockResolvedValueOnce(
      jsonResponse(202, {
        ack: {
          session_id: 'sess-2',
          command_id: 'cmd-2',
          sequence: 1,
          status: 'accepted',
          lifecycle_state: 'active',
          permission_scope: 'tab_action:click',
          timestamps: { received_at: '2026-02-26T10:01:00.000Z' },
        },
      }),
    );

    const client = new ChromeUpstreamSessionClient({
      fetcher: fetcher as any,
      ws_factory: wsFactory as any,
      now: () => new Date('2026-02-26T10:01:00.000Z'),
      random_id: () => 'cmd-fallback',
    });

    await client.openSession({
      api_base_url: 'https://api.example.com/api/v1',
      access_token: 'token-2',
      extension_runtime_id: 'ext-2',
      ws_base_url: 'wss://api.example.com',
    });
    ws.emit('open');
    ws.setSendFailure(true);

    const ack = await client.sendCommand({
      command_id: 'cmd-2',
      tool_name: 'tab_action',
      arguments: { actions: [{ action: 'click', selector: '#run' }] },
      target_tab: { tab_id: 88, url: 'https://example.com' },
    });
    expect(ack.status).toBe('accepted');
    expect(client.getState().selected_transport).toBe('sse_rest_fallback');

    await expect(
      client.sendCommand({
        tool_name: 'tab_read',
        arguments: { mode: 'dom' },
        target_tab: { tab_id: 89, url: 'https://example.com/other' },
      }),
    ).rejects.toThrow(/single-tab/i);
  });

  it('closes the session and resets local state', async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValueOnce(
      jsonResponse(201, {
        session: {
          session_id: 'sess-3',
          protocol_version: 'v1',
          lifecycle_state: 'active',
          transport: {
            primary: 'ws',
            fallback: ['sse', 'rest'],
            selected: 'sse_rest_fallback',
          },
          active_tab_id: null,
          last_sequence: 0,
        },
      }),
    );
    fetcher.mockResolvedValueOnce(
      jsonResponse(200, {
        session: {
          session_id: 'sess-3',
          lifecycle_state: 'closed',
        },
      }),
    );

    const client = new ChromeUpstreamSessionClient({
      fetcher: fetcher as any,
      ws_factory: vi.fn(() => new MockWebSocket()) as any,
    });

    await client.openSession({
      api_base_url: 'https://api.example.com/api/v1',
      access_token: 'token-3',
      extension_runtime_id: 'ext-3',
      ws_base_url: '',
    });
    await client.closeSession('done');

    const state = client.getState();
    expect(state.lifecycle_state).toBe('closed');
    expect(state.session).toBeNull();
    expect(state.selected_transport).toBe('none');
    expect(state.next_sequence).toBe(1);
  });
});

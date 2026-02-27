import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamHub } from '../../src/lib/stores/streamHub';

vi.mock('../../src/lib/stores/session', () => ({
  session: {
    subscribe: vi.fn((fn: (value: any) => void) => {
      fn({
        user: { id: 'user-upstream-control', role: 'editor' },
        loading: false,
      });
      return () => {};
    }),
  },
  isAuthenticated: {
    subscribe: vi.fn((fn: (value: boolean) => void) => {
      fn(true);
      return () => {};
    }),
  },
}));

class MockEventSource {
  url: string;
  withCredentials: boolean;
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  readyState = 1;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((item) => item !== listener),
    );
  }

  close() {
    this.readyState = 2;
  }

  emit(type: string, payload: unknown) {
    const current = this.listeners.get(type) ?? [];
    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });
    for (const listener of current) listener(event);
  }
}

describe('upstream-control store', () => {
  let eventSourceInstance: MockEventSource | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    streamHub.reset();
    (globalThis as any).EventSource = vi.fn(
      (url: string, options?: { withCredentials?: boolean }) => {
        eventSourceInstance = new MockEventSource(url, options);
        return eventSourceInstance;
      },
    );
  });

  afterEach(() => {
    streamHub.delete('up-main');
    streamHub.delete('up-stream');
    streamHub.delete('up-replay');
    streamHub.reset();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('dispatches upstream_session_state events to active subscribers', async () => {
    const onEvent = vi.fn();
    streamHub.set('up-main', onEvent);
    await vi.advanceTimersByTimeAsync(200);

    expect((globalThis as any).EventSource).toHaveBeenCalled();

    eventSourceInstance?.emit('upstream_session_state', {
      streamId: 'stream-up-1',
      sequence: 11,
      data: {
        lifecycle_state: 'active',
        selected_transport: 'ws',
      },
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upstream_session_state',
        streamId: 'stream-up-1',
        sequence: 11,
        data: expect.objectContaining({
          lifecycle_state: 'active',
        }),
      }),
    );
  });

  it('replays only the latest upstream session snapshot for a stream', async () => {
    const onEvent = vi.fn();
    streamHub.set('up-main', onEvent);
    await vi.advanceTimersByTimeAsync(200);
    onEvent.mockClear();

    eventSourceInstance?.emit('upstream_session_state', {
      streamId: 'stream-up-2',
      sequence: 1,
      data: { lifecycle_state: 'connecting' },
    });
    eventSourceInstance?.emit('upstream_session_state', {
      streamId: 'stream-up-2',
      sequence: 2,
      data: { lifecycle_state: 'active' },
    });
    await vi.advanceTimersByTimeAsync(10);

    const replay = vi.fn();
    streamHub.setStream('up-stream', 'stream-up-2', replay);
    await vi.advanceTimersByTimeAsync(10);

    const replayed = replay.mock.calls
      .map((call) => call[0])
      .filter(
        (event: any) =>
          event?.type === 'upstream_session_state' &&
          event?.streamId === 'stream-up-2',
      );

    expect(replayed).toHaveLength(1);
    expect(replayed[0]).toEqual(
      expect.objectContaining({
        sequence: 2,
        data: expect.objectContaining({
          lifecycle_state: 'active',
        }),
      }),
    );
  });

  it('ignores malformed upstream ack payloads and replays valid acks', async () => {
    const onEvent = vi.fn();
    streamHub.set('up-main', onEvent);
    await vi.advanceTimersByTimeAsync(200);
    onEvent.mockClear();

    eventSourceInstance?.emit('upstream_command_ack', {
      data: { status: 'accepted' },
    });
    eventSourceInstance?.emit('upstream_command_ack', {
      streamId: 'stream-up-3',
      sequence: 9,
      data: { status: 'accepted', command_id: 'cmd-9' },
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upstream_command_ack',
        streamId: 'stream-up-3',
        sequence: 9,
      }),
    );

    const replay = vi.fn();
    streamHub.setStream('up-replay', 'stream-up-3', replay);
    await vi.advanceTimersByTimeAsync(10);

    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upstream_command_ack',
        streamId: 'stream-up-3',
        sequence: 9,
      }),
    );
  });
});

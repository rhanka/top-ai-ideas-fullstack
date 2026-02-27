import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resetChromeUpstreamSessionsForTests } from '../../src/services/chrome-upstream-protocol';
import {
  authenticatedRequest,
  cleanupAuthData,
  createAuthenticatedUser,
} from '../utils/auth-helper';

describe('Chrome upstream session protocol API', () => {
  let user: any;

  beforeEach(async () => {
    resetChromeUpstreamSessionsForTests();
    user = await createAuthenticatedUser('editor');
  });

  afterEach(async () => {
    resetChromeUpstreamSessionsForTests();
    await cleanupAuthData();
  });

  it('creates and fetches a v1 upstream session with ws primary metadata', async () => {
    const createResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/chrome-extension/upstream/session',
      user.sessionToken!,
      {
        extension_runtime_id: 'ext-runtime-1',
        ws_available: true,
        target_tab: {
          tab_id: 99,
          url: 'https://example.com/dashboard',
        },
      },
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const session = created.session;
    expect(session).toBeDefined();
    expect(session.protocol_version).toBe('v1');
    expect(session.transport).toEqual({
      primary: 'ws',
      fallback: ['sse', 'rest'],
      selected: 'ws',
    });
    expect(session.capabilities).toEqual({
      single_tab: true,
      multi_tab: false,
      voice: false,
    });
    expect(session.permission_mapping.namespaces).toEqual([
      'tab_read:*',
      'tab_action:*',
    ]);
    expect(session.active_tab_id).toBe(99);

    const readResponse = await authenticatedRequest(
      app,
      'GET',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        session.session_id,
      )}`,
      user.sessionToken!,
    );
    expect(readResponse.status).toBe(200);
    const readPayload = await readResponse.json();
    expect(readPayload.session.session_id).toBe(session.session_id);
  });

  it('accepts command envelopes then records terminal acknowledgements', async () => {
    const createResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/chrome-extension/upstream/session',
      user.sessionToken!,
      {
        extension_runtime_id: 'ext-runtime-2',
        ws_available: false,
      },
    );
    const created = await createResponse.json();
    const sessionId = String(created?.session?.session_id ?? '');
    expect(sessionId.length).toBeGreaterThan(0);
    expect(created.session.transport.selected).toBe('sse_rest_fallback');

    const commandResponse = await authenticatedRequest(
      app,
      'POST',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: 'cmd-1',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_action',
        arguments: {
          actions: [{ action: 'click', selector: '#run' }],
        },
        target_tab: {
          tab_id: 321,
          url: 'https://example.com',
        },
      },
    );
    expect(commandResponse.status).toBe(202);
    const commandPayload = await commandResponse.json();
    expect(commandPayload.ack.status).toBe('accepted');
    expect(commandPayload.ack.permission_scope).toBe('tab_action:click');

    const ackResponse = await authenticatedRequest(
      app,
      'POST',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/ack`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: 'cmd-1',
        sequence: 1,
        status: 'completed',
      },
    );
    expect(ackResponse.status).toBe(200);
    const ackPayload = await ackResponse.json();
    expect(ackPayload.ack.status).toBe('completed');
    expect(ackPayload.ack.timestamps.finalized_at).toBeDefined();

    const eventsResponse = await authenticatedRequest(
      app,
      'GET',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/events`,
      user.sessionToken!,
    );
    expect(eventsResponse.status).toBe(200);
    const eventsPayload = await eventsResponse.json();
    expect(Array.isArray(eventsPayload.events)).toBe(true);
    expect(eventsPayload.events.length).toBeGreaterThanOrEqual(3);
    const ackEvents = eventsPayload.events.filter(
      (event: any) => event.type === 'command_ack',
    );
    expect(ackEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects sequence conflicts and single-tab violations', async () => {
    const createResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/chrome-extension/upstream/session',
      user.sessionToken!,
      {
        extension_runtime_id: 'ext-runtime-3',
        ws_available: true,
        target_tab: {
          tab_id: 901,
          url: 'https://example.com/home',
        },
      },
    );
    const created = await createResponse.json();
    const sessionId = String(created?.session?.session_id ?? '');

    const firstCommand = await authenticatedRequest(
      app,
      'POST',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: 'cmd-seq-1',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'info' },
        target_tab: { tab_id: 901, url: 'https://example.com/home' },
      },
    );
    expect(firstCommand.status).toBe(202);

    const sequenceConflict = await authenticatedRequest(
      app,
      'POST',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: 'cmd-seq-1-dup',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'dom' },
        target_tab: { tab_id: 901, url: 'https://example.com/home' },
      },
    );
    expect(sequenceConflict.status).toBe(409);
    const conflictPayload = await sequenceConflict.json();
    expect(conflictPayload.ack.status).toBe('rejected');
    expect(conflictPayload.ack.error.code).toBe('sequence_conflict');

    const tabViolation = await authenticatedRequest(
      app,
      'POST',
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(
        sessionId,
      )}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: 'cmd-tab-switch',
        sequence: 2,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'dom' },
        target_tab: { tab_id: 902, url: 'https://example.com/another' },
      },
    );
    expect(tabViolation.status).toBe(409);
    const tabPayload = await tabViolation.json();
    expect(tabPayload.ack.status).toBe('rejected');
    expect(tabPayload.ack.error.code).toBe('single_tab_violation');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  acknowledgeChromeUpstreamCommand,
  createChromeUpstreamSession,
  deriveUpstreamPermissionScope,
  getChromeUpstreamSession,
  registerChromeUpstreamCommand,
  resetChromeUpstreamSessionsForTests,
} from '../../src/services/chrome-upstream-protocol';

describe('chrome-upstream-protocol service', () => {
  beforeEach(() => {
    resetChromeUpstreamSessionsForTests();
  });

  it('derives permission scopes with FL2 tab namespace mapping', () => {
    expect(
      deriveUpstreamPermissionScope('tab_read', { mode: 'dom' }),
    ).toBe('tab_read:dom');
    expect(
      deriveUpstreamPermissionScope('tab_action', {
        actions: [{ action: 'click' }],
      }),
    ).toBe('tab_action:click');
    expect(
      deriveUpstreamPermissionScope('tab_action', {
        actions: [{ action: 'click' }, { action: 'scroll' }],
      }),
    ).toBe('tab_action:*');
    expect(deriveUpstreamPermissionScope('unknown_tool', {})).toBeNull();
  });

  it('creates a v1 session with ws primary and fallback metadata', () => {
    const session = createChromeUpstreamSession({
      user_id: 'u-1',
      workspace_id: 'ws-1',
      extension_runtime_id: 'ext-1',
      ws_available: true,
      target_tab: {
        tab_id: 42,
        url: 'https://example.com',
      },
    });

    expect(session.protocol_version).toBe('v1');
    expect(session.transport.primary).toBe('ws');
    expect(session.transport.fallback).toEqual(['sse', 'rest']);
    expect(session.transport.selected).toBe('ws');
    expect(session.capabilities).toEqual({
      single_tab: true,
      multi_tab: false,
      voice: false,
    });
    expect(session.active_tab_id).toBe(42);
  });

  it('accepts commands with deterministic sequence and single-tab target', () => {
    const session = createChromeUpstreamSession({
      user_id: 'u-2',
      workspace_id: 'ws-2',
      extension_runtime_id: 'ext-2',
      ws_available: false,
    });

    const firstAck = registerChromeUpstreamCommand({
      user_id: 'u-2',
      workspace_id: 'ws-2',
      envelope: {
        session_id: session.session_id,
        command_id: 'cmd-1',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'info' },
        target_tab: { tab_id: 501, url: 'https://example.com' },
      },
    });

    expect(firstAck.status).toBe('accepted');
    expect(firstAck.permission_scope).toBe('tab_read:info');

    const snapshot = getChromeUpstreamSession(
      session.session_id,
      'u-2',
      'ws-2',
    );
    expect(snapshot?.last_sequence).toBe(1);
    expect(snapshot?.active_tab_id).toBe(501);

    const secondAck = registerChromeUpstreamCommand({
      user_id: 'u-2',
      workspace_id: 'ws-2',
      envelope: {
        session_id: session.session_id,
        command_id: 'cmd-2',
        sequence: 2,
        command_kind: 'tool_execute',
        tool_name: 'tab_action',
        arguments: {
          actions: [{ action: 'click', selector: '#submit' }],
        },
        target_tab: { tab_id: 501, url: 'https://example.com/account' },
      },
    });

    expect(secondAck.status).toBe('accepted');
    expect(secondAck.permission_scope).toBe('tab_action:click');
  });

  it('rejects command when target tab violates single-tab baseline', () => {
    const session = createChromeUpstreamSession({
      user_id: 'u-3',
      workspace_id: 'ws-3',
      extension_runtime_id: 'ext-3',
      ws_available: true,
      target_tab: { tab_id: 11, url: 'https://example.com' },
    });

    const ack = registerChromeUpstreamCommand({
      user_id: 'u-3',
      workspace_id: 'ws-3',
      envelope: {
        session_id: session.session_id,
        command_id: 'cmd-switch',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'dom' },
        target_tab: { tab_id: 12, url: 'https://example.com/other' },
      },
    });

    expect(ack.status).toBe('rejected');
    expect(ack.error?.code).toBe('single_tab_violation');
  });

  it('rejects non-injectable tab targets and invalid terminal acks', () => {
    const session = createChromeUpstreamSession({
      user_id: 'u-4',
      workspace_id: 'ws-4',
      extension_runtime_id: 'ext-4',
      ws_available: true,
    });

    const rejected = registerChromeUpstreamCommand({
      user_id: 'u-4',
      workspace_id: 'ws-4',
      envelope: {
        session_id: session.session_id,
        command_id: 'cmd-chrome-url',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'info' },
        target_tab: { tab_id: 8, url: 'chrome://extensions' },
      },
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.error?.code).toBe('non_injectable_target');

    const accepted = registerChromeUpstreamCommand({
      user_id: 'u-4',
      workspace_id: 'ws-4',
      envelope: {
        session_id: session.session_id,
        command_id: 'cmd-ok',
        sequence: 1,
        command_kind: 'tool_execute',
        tool_name: 'tab_read',
        arguments: { mode: 'info' },
        target_tab: { tab_id: 8, url: 'https://example.org' },
      },
    });

    expect(accepted.status).toBe('accepted');

    const invalidTerminal = acknowledgeChromeUpstreamCommand({
      user_id: 'u-4',
      workspace_id: 'ws-4',
      session_id: session.session_id,
      command_id: 'cmd-ok',
      sequence: 1,
      status: 'failed',
    });

    expect(invalidTerminal.status).toBe('rejected');
    expect(invalidTerminal.error?.code).toBe('invalid_ack');

    const completed = acknowledgeChromeUpstreamCommand({
      user_id: 'u-4',
      workspace_id: 'ws-4',
      session_id: session.session_id,
      command_id: 'cmd-ok',
      sequence: 1,
      status: 'completed',
    });

    expect(completed.status).toBe('completed');
  });
});

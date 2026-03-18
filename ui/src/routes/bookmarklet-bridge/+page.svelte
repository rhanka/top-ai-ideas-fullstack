<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { apiGet, apiPost, apiDelete } from '$lib/utils/api';
  import { streamHub, type StreamHubEvent } from '$lib/stores/streamHub';

  /**
   * Bridge iframe page — completely invisible.
   * Runs on the webapp domain (same-origin), has session auth via cookies.
   *
   * Responsibilities:
   * 1. Validate nonce from URL query param.
   * 2. Register tab in API after receiving register message from injected script.
   * 3. Keepalive interval (15s).
   * 4. Listen to SSE for pending tool calls (awaiting_external_result on tab_read/tab_action).
   * 5. Forward commands to injected script via postMessage.
   * 6. Forward tool results back to API.
   * 7. Cleanup on beforeunload.
   */

  let tabId: string | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let parentOrigin: string | null = null;
  let streamHubKey: string | null = null;
  // Track which tool call IDs we've already forwarded to avoid duplicates
  const forwardedToolCallIds = new Set<string>();

  // --- Nonce validation ---
  async function validateNonce(): Promise<void> {
    if (!browser) return;
    const nonce = $page.url.searchParams.get('nonce');
    if (!nonce) return; // Development mode: no nonce is fine
    try {
      // Consume the nonce — if invalid, we still proceed (non-blocking)
      await apiGet(`/bookmarklet/nonce/validate?nonce=${encodeURIComponent(nonce)}`);
    } catch {
      // Nonce validation failure is non-blocking
    }
  }

  // --- Tab registration ---
  async function registerTab(url: string, title: string): Promise<void> {
    try {
      const res = await apiPost<{ ok: boolean; tab_id: string }>(
        '/chrome-extension/tabs/register',
        { url, title, source: 'bookmarklet' },
      );
      tabId = res.tab_id;
      startKeepalive();
      startStreamListeningWithTracking();
      // Notify injected script that we're connected
      sendToParent({ type: 'connected', tabId });
    } catch (e) {
      console.error('[bridge] Tab registration failed:', e);
    }
  }

  // --- Keepalive ---
  function startKeepalive(): void {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(async () => {
      if (!tabId) return;
      try {
        await apiPost('/chrome-extension/tabs/keepalive', { tab_id: tabId });
      } catch {
        // Keepalive failure is non-fatal
      }
    }, 15_000);
  }

  // --- Stream listening for pending tool calls ---
  function startStreamListening(): void {
    const key = `bridge-${tabId}-${Date.now()}`;
    streamHubKey = key;
    streamHub.set(key, handleStreamEvent);
  }

  function handleStreamEvent(event: StreamHubEvent): void {
    if (event.type !== 'status') return;
    const data = (event as any)?.data;
    if (!data) return;
    const state = String(data.state ?? '').trim();

    // The chat-service writes 'awaiting_local_tool_results' with pending tool calls
    // that include tab_read/tab_action. The bridge picks up these and forwards them.
    if (state !== 'awaiting_local_tool_results') return;

    const pendingCalls = Array.isArray(data.pending_local_tool_calls)
      ? data.pending_local_tool_calls
      : [];

    for (const call of pendingCalls) {
      const toolCallId = String(call?.tool_call_id ?? '').trim();
      const name = String(call?.name ?? '').trim();

      if (!toolCallId || (name !== 'tab_read' && name !== 'tab_action')) continue;
      if (forwardedToolCallIds.has(toolCallId)) continue;

      forwardedToolCallIds.add(toolCallId);

      // Parse args
      let args: Record<string, unknown> = {};
      if (call.args && typeof call.args === 'object') {
        args = call.args;
      } else if (typeof call.args === 'string') {
        try { args = JSON.parse(call.args); } catch { /* ignore */ }
      }

      // Forward command to injected script
      sendToParent({
        type: 'command',
        callId: toolCallId,
        toolName: name,
        args,
      });
    }
  }

  // --- PostMessage communication ---
  function sendToParent(message: Record<string, unknown>): void {
    if (!browser || !parentOrigin) return;
    try {
      window.parent.postMessage(message, parentOrigin);
    } catch {
      // Cross-origin might fail in edge cases
    }
  }

  function handleMessage(event: MessageEvent): void {
    // Only accept messages from the parent frame's origin
    if (!parentOrigin) {
      // First message sets the parent origin (the external page)
      if (event.data?.type === 'register') {
        parentOrigin = event.origin;
      } else {
        return;
      }
    }

    if (event.origin !== parentOrigin) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'register') {
      const url = String(data.url ?? '');
      const title = String(data.title ?? '');
      void registerTab(url, title);
      return;
    }

    if (data.type === 'tool_result') {
      const callId = String(data.callId ?? '');
      if (!callId) return;
      void postToolResult(callId, data.result);
      return;
    }

    if (data.type === 'screenshot_result') {
      const callId = String(data.callId ?? '');
      if (!callId) return;
      void postToolResult(callId, { dataUrl: data.dataUrl });
      return;
    }
  }

  // --- Post tool result to API ---
  async function postToolResult(
    toolCallId: string,
    result: unknown,
  ): Promise<void> {
    // We need the assistant message ID. The stream events carry it as the streamId.
    // Find the last streamId associated with this toolCallId.
    // The streamId in the status event corresponds to the assistant message ID.
    const messageId = findAssistantMessageIdForToolCall(toolCallId);
    if (!messageId) {
      console.error('[bridge] Cannot find assistant message ID for tool call:', toolCallId);
      return;
    }

    try {
      await apiPost(`/chat/messages/${messageId}/tool-results`, {
        toolCallId,
        result: typeof result === 'string' ? result : JSON.stringify(result),
      });
    } catch (e) {
      console.error('[bridge] Failed to post tool result:', e);
    }
  }

  // Map tool call IDs to their assistant message (stream) IDs
  const toolCallToStreamId = new Map<string, string>();

  function findAssistantMessageIdForToolCall(toolCallId: string): string | null {
    return toolCallToStreamId.get(toolCallId) ?? null;
  }

  // Enhanced stream event handler that also tracks toolCallId -> streamId mapping
  function handleStreamEventWithTracking(event: StreamHubEvent): void {
    if (event.type === 'status') {
      const data = (event as any)?.data;
      const streamId = String((event as any)?.streamId ?? '').trim();
      if (data && streamId) {
        const pendingCalls = Array.isArray(data.pending_local_tool_calls)
          ? data.pending_local_tool_calls
          : [];
        for (const call of pendingCalls) {
          const toolCallId = String(call?.tool_call_id ?? '').trim();
          if (toolCallId) {
            toolCallToStreamId.set(toolCallId, streamId);
          }
        }
      }
    }
    handleStreamEvent(event);
  }

  // Override startStreamListening to use the tracking version
  function startStreamListeningWithTracking(): void {
    const key = `bridge-${tabId}-${Date.now()}`;
    streamHubKey = key;
    streamHub.set(key, handleStreamEventWithTracking);
  }

  // --- Cleanup ---
  async function cleanup(): Promise<void> {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
    if (streamHubKey) {
      streamHub.delete(streamHubKey);
      streamHubKey = null;
    }
    if (tabId) {
      try {
        await apiDelete(`/chrome-extension/tabs/${tabId}`);
      } catch {
        // Best-effort cleanup
      }
      tabId = null;
    }
  }

  function handleBeforeUnload(): void {
    // Sync cleanup — use sendBeacon for tab unregistration
    if (tabId && browser) {
      try {
        const baseUrl = window.location.origin;
        navigator.sendBeacon(
          `${baseUrl}/api/v1/chrome-extension/tabs/${tabId}`,
          '',
        );
      } catch {
        // Best-effort
      }
    }
  }

  onMount(() => {
    if (!browser) return;
    void validateNonce();
    window.addEventListener('message', handleMessage);
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    void cleanup();
  });
</script>

<!-- Bridge iframe: completely invisible, no UI -->
<svelte:head>
  <title>Top AI Bridge</title>
</svelte:head>

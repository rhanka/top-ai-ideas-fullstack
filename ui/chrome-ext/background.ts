// Service Worker for Top AI Ideas Extension
import {
    loadExtensionConfig,
    saveExtensionConfig,
    type ExtensionProfile,
} from './extension-config';
import {
    connectExtensionAuth,
    getExtensionAuthStatus,
    getValidAccessToken,
    logoutExtensionAuth,
} from './extension-auth';
import {
    createToolExecutors,
    type ToolExecutionContext,
} from './tool-executor';
import {
    applyToolPermissionDecision,
    bootstrapToolPermissionSync,
    evaluateToolPermission,
    listToolPermissionPolicies,
    normalizePermissionOrigin,
    normalizeRuntimePermissionOrigin,
    upsertToolPermissionPolicy,
    deleteToolPermissionPolicy,
} from './tool-permissions';
import { ChromeUpstreamSessionClient } from './upstream-session';

const toolExecutors = createToolExecutors();
const upstreamSessionClient = new ChromeUpstreamSessionClient();

const ALLOWED_PROXY_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    'top-ai-ideas-api.sent-tech.ca',
]);

const NON_INJECTABLE_URL_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
];

type ProxyFetchPayload = {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    bodyText?: string;
    authMode?: 'extension' | 'cookie' | 'none';
};

type ExtensionConfigPayload = {
    profile?: ExtensionProfile;
    apiBaseUrl?: string;
    appBaseUrl?: string;
    wsBaseUrl?: string;
};

type UpstreamTerminalErrorCode =
    | 'session_not_found'
    | 'session_scope_denied'
    | 'sequence_conflict'
    | 'single_tab_violation'
    | 'unsupported_command'
    | 'permission_scope_invalid'
    | 'non_injectable_target'
    | 'command_not_found'
    | 'invalid_transition'
    | 'invalid_ack';

type UpstreamCommandContext = {
    commandId: string;
    sequence: number;
};

const canInjectTabUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    return !NON_INJECTABLE_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
};

const resolveTargetTabForPermission = async (
    args: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
): Promise<chrome.tabs.Tab | null> => {
    const tabIdFromArgs =
        typeof args.tabId === 'number' && Number.isFinite(args.tabId)
            ? args.tabId
            : null;

    if (tabIdFromArgs !== null) {
        const tab = await chrome.tabs.get(tabIdFromArgs).catch(() => null);
        if (tab && canInjectTabUrl(tab.url)) return tab;
    }

    if (typeof sender.tab?.id === 'number') {
        const tab = await chrome.tabs.get(sender.tab.id).catch(() => null);
        if (tab && canInjectTabUrl(tab.url)) return tab;
    }

    const candidates: chrome.tabs.Tab[] = [];
    if (typeof sender.tab?.windowId === 'number') {
        candidates.push(
            ...(await chrome.tabs.query({
                active: true,
                windowId: sender.tab.windowId,
            })),
        );
    }
    candidates.push(
        ...(await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        })),
    );
    candidates.push(
        ...(await chrome.tabs.query({
            active: true,
            currentWindow: true,
        })),
    );
    candidates.push(
        ...(await chrome.tabs.query({
            active: true,
        })),
    );

    const seen = new Set<number>();
    for (const tab of candidates) {
        if (typeof tab.id !== 'number' || seen.has(tab.id)) continue;
        seen.add(tab.id);
        if (!canInjectTabUrl(tab.url)) continue;
        return tab;
    }

    return null;
};

const toUpstreamTargetTab = (tab: chrome.tabs.Tab): {
    tab_id: number;
    url?: string | null;
    origin?: string | null;
    title?: string | null;
} | null => {
    if (typeof tab.id !== 'number') return null;
    return {
        tab_id: tab.id,
        url: tab.url ?? null,
        origin: normalizeRuntimePermissionOrigin(tab.url ?? '') ?? null,
        title: tab.title ?? null,
    };
};

const mapExecutionErrorToUpstreamCode = (
    reason: string,
): UpstreamTerminalErrorCode => {
    if (/unsupported tab url/i.test(reason)) return 'non_injectable_target';
    if (/no active injectable tab/i.test(reason)) return 'session_scope_denied';
    if (/single-tab/i.test(reason)) return 'single_tab_violation';
    return 'invalid_ack';
};

const isUpstreamScopeError = (reason: string): boolean =>
    /single-tab|multi-tab|voice|non-injectable/i.test(
        reason,
    );

const getW1ScopeRejectionReason = (
    args: Record<string, unknown>,
): string | null => {
    const tabIds = Array.isArray(args.tabIds)
        ? args.tabIds.filter(
            (value) => typeof value === 'number' && Number.isFinite(value),
        )
        : [];
    if (tabIds.length > 1) {
        return 'W1 single-tab mode rejects multi-tab commands (tabIds > 1).';
    }

    const targetTabs = Array.isArray(args.target_tabs)
        ? args.target_tabs.filter(
            (value) => value && typeof value === 'object',
        )
        : [];
    if (targetTabs.length > 1) {
        return 'W1 single-tab mode rejects multi-tab commands (target_tabs > 1).';
    }

    const voiceRequested =
        args.voice === true ||
        args.audio === true ||
        typeof args.voiceCommand === 'string' ||
        String(args.mode ?? '').trim().toLowerCase() === 'voice';
    if (voiceRequested) {
        return 'W1 scope excludes voice automation commands.';
    }

    return null;
};

const ensureUpstreamSession = async (
    targetTab: chrome.tabs.Tab,
): Promise<boolean> => {
    const currentState = upstreamSessionClient.getState();
    if (
        currentState.session &&
        currentState.lifecycle_state !== 'idle' &&
        currentState.lifecycle_state !== 'closed' &&
        currentState.lifecycle_state !== 'error'
    ) {
        return true;
    }

    const target = toUpstreamTargetTab(targetTab);
    if (!target) return false;

    const config = await loadExtensionConfig();
    const sessionUrl = `${config.apiBaseUrl.replace(/\/$/, '')}/chrome-extension/upstream/session`;
    if (!isAllowedProxyUrl(sessionUrl)) return false;

    const token = await getValidAccessToken(config, {
        allowRefresh: true,
    });
    if (!token) return false;

    const state = await upstreamSessionClient.openSession({
        api_base_url: config.apiBaseUrl,
        access_token: token,
        extension_runtime_id: chrome.runtime.id ?? 'unknown-extension-runtime',
        ws_base_url: config.wsBaseUrl,
        target_tab: target,
    });

    return Boolean(state.session) && state.lifecycle_state !== 'error';
};

const dispatchUpstreamCommandForToolExecution = async (input: {
    toolName: string;
    args: Record<string, unknown>;
    targetTab: chrome.tabs.Tab;
}): Promise<UpstreamCommandContext | null> => {
    const target = toUpstreamTargetTab(input.targetTab);
    if (!target) return null;

    const upstreamReady = await ensureUpstreamSession(input.targetTab);
    if (!upstreamReady) return null;

    try {
        const ack = await upstreamSessionClient.sendCommand({
            tool_name: input.toolName,
            arguments: input.args,
            target_tab: target,
        });
        if (ack.status !== 'accepted') {
            const rejectionCode = String(ack.error?.code ?? '').trim();
            const isW1ScopeReject =
                rejectionCode === 'single_tab_violation' ||
                rejectionCode === 'unsupported_command' ||
                rejectionCode === 'non_injectable_target';
            if (isW1ScopeReject) {
                throw new Error(
                    ack.error?.message ??
                        `Upstream command rejected with status ${ack.status}.`,
                );
            }
            console.warn(
                `Upstream rejected command (${rejectionCode || ack.status}); fallback to local execution.`,
            );
            return null;
        }
        return {
            commandId: ack.command_id,
            sequence: ack.sequence,
        };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (isUpstreamScopeError(reason)) {
            throw error;
        }
        console.warn(
            `Upstream dispatch unavailable, fallback to local execution: ${reason}`,
        );
        return null;
    }
};

const reportUpstreamTerminalAck = async (input: {
    command: UpstreamCommandContext | null;
    status: 'completed' | 'failed' | 'rejected';
    reason?: string;
}): Promise<void> => {
    if (!input.command) return;

    await upstreamSessionClient.reportCommandAck({
        command_id: input.command.commandId,
        sequence: input.command.sequence,
        status: input.status,
        error:
            input.status === 'completed'
                ? undefined
                : {
                    code: mapExecutionErrorToUpstreamCode(
                        input.reason ?? 'Local tool execution failed.',
                    ),
                    message: input.reason ?? 'Local tool execution failed.',
                },
    });
};

const derivePermissionToolName = (
    toolName: string,
    args: Record<string, unknown>,
): string => {
    const normalizeTabActionPermission = (
        action: unknown,
    ): 'click' | 'input' | 'scroll' | 'wait' | null => {
        const value = String(action ?? '').trim().toLowerCase();
        if (value === 'type' || value === 'input') return 'input';
        if (
            value === 'click' ||
            value === 'scroll' ||
            value === 'wait'
        ) {
            return value;
        }
        return null;
    };

    const deriveTabActionPermission = (): string => {
        const steps = Array.isArray(args.actions)
            ? args.actions
            : typeof args.action === 'string'
                ? [args]
                : [];
        if (!Array.isArray(steps) || steps.length === 0) {
            return 'tab_action:*';
        }
        const actionKinds = new Set<'click' | 'input' | 'scroll' | 'wait'>();
        for (const step of steps) {
            if (!step || typeof step !== 'object') continue;
            const normalized = normalizeTabActionPermission(
                (step as Record<string, unknown>).action,
            );
            if (normalized) actionKinds.add(normalized);
        }
        if (actionKinds.size !== 1) return 'tab_action:*';
        return `tab_action:${Array.from(actionKinds)[0]}`;
    };

    if (toolName === 'tab_read') {
        const modeRaw = String(args.mode ?? '').trim();
        const mode =
            modeRaw === 'dom' ||
            modeRaw === 'screenshot' ||
            modeRaw === 'elements' ||
            modeRaw === 'info'
                ? modeRaw
                : 'info';
        return `tab_read:${mode}`;
    }
    if (toolName === 'tab_info') return 'tab_read:info';
    if (toolName === 'tab_read_dom') return 'tab_read:dom';
    if (toolName === 'tab_screenshot') return 'tab_read:screenshot';
    if (toolName === 'tab_action') return deriveTabActionPermission();
    if (toolName === 'tab_click') return 'tab_action:click';
    if (toolName === 'tab_type') return 'tab_action:input';
    if (toolName === 'tab_scroll') return 'tab_action:scroll';
    return toolName;
};

const isAllowedProxyUrl = (rawUrl: string): boolean => {
    try {
        const parsed = new URL(rawUrl);
        return ALLOWED_PROXY_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
};

const sanitizeHeaders = (
    headers: Record<string, string> | undefined,
): Record<string, string> => {
    const safe: Record<string, string> = {};
    if (!headers) return safe;
    for (const [key, value] of Object.entries(headers)) {
        if (!key) continue;
        const lower = key.toLowerCase();
        if (lower === 'host' || lower === 'origin' || lower === 'referer') continue;
        safe[key] = value;
    }
    return safe;
};

type StreamProxyStartPayload = {
    baseUrl: string;
    workspaceId: string | null;
    streamIds: string[];
};

const STREAM_PROXY_PORT_NAME = 'topai-stream-proxy';

const normalizeStreamProxyPayload = (
    raw: any,
): StreamProxyStartPayload | null => {
    const baseUrlRaw = String(raw?.baseUrl ?? '').trim().replace(/\/$/, '');
    if (!baseUrlRaw || !isAllowedProxyUrl(`${baseUrlRaw}/health`)) return null;

    const workspaceIdRaw = raw?.workspaceId;
    const workspaceId =
        typeof workspaceIdRaw === 'string' && workspaceIdRaw.trim().length > 0
            ? workspaceIdRaw.trim()
            : null;

    const streamIds = Array.isArray(raw?.streamIds)
        ? Array.from(
            new Set(
                raw.streamIds
                    .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
                    .filter((id: string) => id.length > 0 && id.length <= 255),
            ),
        )
        : [];

    return {
        baseUrl: baseUrlRaw,
        workspaceId,
        streamIds,
    };
};

const streamProxyStates = new WeakMap<
    chrome.runtime.Port,
    {
        abortController: AbortController | null;
        closed: boolean;
        restartTimer: ReturnType<typeof setTimeout> | null;
        lastPayload: StreamProxyStartPayload | null;
    }
>();

const stopStreamProxy = (port: chrome.runtime.Port) => {
    const state = streamProxyStates.get(port);
    if (!state) return;
    if (state.restartTimer) {
        clearTimeout(state.restartTimer);
        state.restartTimer = null;
    }
    state.abortController?.abort();
    state.abortController = null;
};

const postToStreamPort = (
    port: chrome.runtime.Port,
    message: unknown,
) => {
    try {
        port.postMessage(message);
    } catch {
        // Port may already be disconnected.
    }
};

const runStreamProxy = async (
    port: chrome.runtime.Port,
    payload: StreamProxyStartPayload,
): Promise<void> => {
    const state = streamProxyStates.get(port);
    if (!state || state.closed) return;
    stopStreamProxy(port);

    const controller = new AbortController();
    state.abortController = controller;
    state.lastPayload = payload;

    try {
        const config = await loadExtensionConfig();
        const token = await getValidAccessToken(config, {
            allowRefresh: true,
        });
        if (!token) {
            postToStreamPort(port, {
                type: 'sse_error',
                error: 'Extension is not authenticated.',
            });
            return;
        }

        const url = new URL(`${payload.baseUrl}/streams/sse`);
        if (payload.workspaceId) {
            url.searchParams.set('workspace_id', payload.workspaceId);
        }
        for (const streamId of payload.streamIds) {
            url.searchParams.append('streamIds', streamId);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
            },
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
        });

        if (!response.ok || !response.body) {
            postToStreamPort(port, {
                type: 'sse_error',
                error: `SSE proxy failed: HTTP ${response.status}`,
            });
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventType = 'message';
        let dataLines: string[] = [];

        const flushEvent = () => {
            if (dataLines.length === 0) return;
            const dataText = dataLines.join('\n');
            dataLines = [];
            const finalEventType = eventType || 'message';
            eventType = 'message';
            try {
                const payloadValue = JSON.parse(dataText);
                postToStreamPort(port, {
                    type: 'sse_event',
                    eventType: finalEventType,
                    payload: payloadValue,
                });
            } catch {
                postToStreamPort(port, {
                    type: 'sse_event',
                    eventType: finalEventType,
                    payload: { data: dataText },
                });
            }
        };

        const processLine = (line: string) => {
            if (line === '') {
                flushEvent();
                return;
            }
            if (line.startsWith(':')) return;
            if (line.startsWith('event:')) {
                eventType = line.slice(6).trim() || 'message';
                return;
            }
            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                processLine(line);
            }
        }

        buffer += decoder.decode();
        if (buffer) {
            const tailLines = buffer.split(/\r?\n/);
            for (const line of tailLines) {
                processLine(line);
            }
        }
        flushEvent();

        if (!controller.signal.aborted) {
            postToStreamPort(port, { type: 'sse_closed' });
        }
    } catch (error) {
        if (controller.signal.aborted) return;
        postToStreamPort(port, {
            type: 'sse_error',
            error: error instanceof Error ? error.message : String(error),
        });
    } finally {
        const latest = streamProxyStates.get(port);
        if (!latest) return;
        if (latest.abortController === controller) {
            latest.abortController = null;
        }
    }
};

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PROXY_PORT_NAME) return;

    streamProxyStates.set(port, {
        abortController: null,
        closed: false,
        restartTimer: null,
        lastPayload: null,
    });

    port.onMessage.addListener((message) => {
        if (message?.type === 'stream_proxy_stop') {
            stopStreamProxy(port);
            return;
        }
        if (message?.type !== 'stream_proxy_start') return;
        const payload = normalizeStreamProxyPayload(message?.payload);
        if (!payload) {
            postToStreamPort(port, {
                type: 'sse_error',
                error: 'Invalid SSE proxy start payload.',
            });
            return;
        }
        void runStreamProxy(port, payload);
    });

    port.onDisconnect.addListener(() => {
        const state = streamProxyStates.get(port);
        if (state) {
            state.closed = true;
        }
        stopStreamProxy(port);
        streamProxyStates.delete(port);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'extension_auth_status') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                const status = await getExtensionAuthStatus(config, {
                    allowRefresh: true,
                });
                sendResponse({
                    ok: true,
                    status,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_auth_connect') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                const result = await connectExtensionAuth(config);
                sendResponse({
                    ok: result.ok,
                    ...result,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    code: 'CONNECT_FAILED',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_auth_logout') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                await logoutExtensionAuth(config);
                sendResponse({
                    ok: true,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_auth_open_login') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                const loginUrl = `${config.appBaseUrl.replace(/\/$/, '')}/auth/login`;
                await chrome.tabs.create({ url: loginUrl });
                sendResponse({
                    ok: true,
                    loginUrl,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'upstream_session_open') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                const sessionUrl = `${config.apiBaseUrl.replace(/\/$/, '')}/chrome-extension/upstream/session`;
                if (!isAllowedProxyUrl(sessionUrl)) {
                    sendResponse({
                        ok: false,
                        error: `Blocked upstream session URL: ${sessionUrl}`,
                    });
                    return;
                }

                const token = await getValidAccessToken(config, {
                    allowRefresh: true,
                });
                if (!token) {
                    sendResponse({
                        ok: false,
                        error:
                            'Extension is not authenticated. Use Connect in extension settings.',
                    });
                    return;
                }

                const payload = (message?.payload ?? {}) as Record<string, unknown>;
                let targetTab:
                    | {
                        tab_id: number;
                        url?: string | null;
                        origin?: string | null;
                        title?: string | null;
                    }
                    | undefined;

                const rawTarget = payload.target_tab as Record<string, unknown> | undefined;
                if (
                    rawTarget &&
                    typeof rawTarget.tab_id === 'number' &&
                    Number.isFinite(rawTarget.tab_id)
                ) {
                    targetTab = {
                        tab_id: rawTarget.tab_id,
                        url:
                            typeof rawTarget.url === 'string'
                                ? rawTarget.url
                                : null,
                        origin:
                            typeof rawTarget.origin === 'string'
                                ? rawTarget.origin
                                : null,
                        title:
                            typeof rawTarget.title === 'string'
                                ? rawTarget.title
                                : null,
                    };
                } else {
                    const resolvedTab = await resolveTargetTabForPermission(
                        payload,
                        sender,
                    );
                    const normalized = resolvedTab
                        ? toUpstreamTargetTab(resolvedTab)
                        : null;
                    if (normalized) targetTab = normalized;
                }

                const state = await upstreamSessionClient.openSession({
                    api_base_url: config.apiBaseUrl,
                    access_token: token,
                    extension_runtime_id: chrome.runtime.id ?? 'unknown-extension-runtime',
                    ws_base_url: config.wsBaseUrl,
                    target_tab: targetTab,
                });

                sendResponse({
                    ok: state.lifecycle_state !== 'error',
                    state,
                    error: state.last_error ?? undefined,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'upstream_session_state_get') {
        sendResponse({
            ok: true,
            state: upstreamSessionClient.getState(),
        });
        return true;
    }

    if (message?.type === 'upstream_session_command') {
        void (async () => {
            try {
                const payload = (message?.payload ?? {}) as Record<string, unknown>;
                const commandId =
                    typeof payload.command_id === 'string'
                        ? payload.command_id.trim()
                        : '';
                const toolName =
                    typeof payload.tool_name === 'string'
                        ? payload.tool_name.trim()
                        : '';
                if (!toolName) {
                    sendResponse({
                        ok: false,
                        error: 'tool_name is required for upstream command.',
                    });
                    return;
                }

                let targetTab:
                    | {
                        tab_id: number;
                        url?: string | null;
                        origin?: string | null;
                        title?: string | null;
                    }
                    | null = null;
                const rawTarget = payload.target_tab as Record<string, unknown> | undefined;
                if (
                    rawTarget &&
                    typeof rawTarget.tab_id === 'number' &&
                    Number.isFinite(rawTarget.tab_id)
                ) {
                    targetTab = {
                        tab_id: rawTarget.tab_id,
                        url:
                            typeof rawTarget.url === 'string'
                                ? rawTarget.url
                                : null,
                        origin:
                            typeof rawTarget.origin === 'string'
                                ? rawTarget.origin
                                : null,
                        title:
                            typeof rawTarget.title === 'string'
                                ? rawTarget.title
                                : null,
                    };
                } else {
                    const resolvedTab = await resolveTargetTabForPermission(
                        payload,
                        sender,
                    );
                    targetTab = resolvedTab ? toUpstreamTargetTab(resolvedTab) : null;
                }

                if (!targetTab) {
                    sendResponse({
                        ok: false,
                        error:
                            'No active injectable tab found for upstream command.',
                    });
                    return;
                }

                const args =
                    payload.arguments &&
                    typeof payload.arguments === 'object' &&
                    !Array.isArray(payload.arguments)
                        ? (payload.arguments as Record<string, unknown>)
                        : {};

                const ack = await upstreamSessionClient.sendCommand({
                    command_id: commandId || undefined,
                    tool_name: toolName,
                    arguments: args,
                    target_tab: targetTab,
                });

                sendResponse({
                    ok: ack.status === 'accepted',
                    ack,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'upstream_session_ack') {
        void (async () => {
            try {
                const payload = (message?.payload ?? {}) as Record<string, unknown>;
                const commandId =
                    typeof payload.command_id === 'string'
                        ? payload.command_id.trim()
                        : '';
                const sequence =
                    typeof payload.sequence === 'number' &&
                    Number.isFinite(payload.sequence)
                        ? payload.sequence
                        : Number.NaN;
                const status =
                    payload.status === 'completed' ||
                    payload.status === 'failed' ||
                    payload.status === 'rejected'
                        ? payload.status
                        : null;
                if (!commandId || !Number.isFinite(sequence) || !status) {
                    sendResponse({
                        ok: false,
                        error:
                            'command_id, sequence and status (completed|failed|rejected) are required.',
                    });
                    return;
                }

                const errorPayload =
                    payload.error &&
                    typeof payload.error === 'object' &&
                    !Array.isArray(payload.error)
                        ? (payload.error as {
                            code: string;
                            message: string;
                            details?: Record<string, unknown>;
                        })
                        : undefined;

                const ack = await upstreamSessionClient.reportCommandAck({
                    command_id: commandId,
                    sequence,
                    status,
                    error: errorPayload,
                });

                sendResponse({
                    ok: true,
                    ack,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'upstream_session_close') {
        void (async () => {
            try {
                const payload = (message?.payload ?? {}) as Record<string, unknown>;
                const reason =
                    typeof payload.reason === 'string' ? payload.reason : undefined;
                await upstreamSessionClient.closeSession(reason);
                sendResponse({
                    ok: true,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_tool_permissions_list') {
        void (async () => {
            try {
                const items = await listToolPermissionPolicies();
                sendResponse({
                    ok: true,
                    items,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_tool_permissions_upsert') {
        void (async () => {
            try {
                const rawToolName = String(message?.payload?.toolName ?? '').trim();
                const rawOrigin = String(message?.payload?.origin ?? '').trim();
                const rawPolicy = String(message?.payload?.policy ?? '').trim();
                if (!rawToolName) {
                    sendResponse({
                        ok: false,
                        error: 'toolName is required.',
                    });
                    return;
                }
                const origin = normalizePermissionOrigin(rawOrigin);
                if (!origin) {
                    sendResponse({
                        ok: false,
                        error:
                            'origin must be a valid origin pattern (*, https://*, *.example.com, https://*.example.com) or exact URL.',
                    });
                    return;
                }
                if (rawPolicy !== 'allow' && rawPolicy !== 'deny') {
                    sendResponse({
                        ok: false,
                        error: 'policy must be allow or deny.',
                    });
                    return;
                }

                const item = await upsertToolPermissionPolicy({
                    toolName: rawToolName,
                    origin,
                    policy: rawPolicy,
                });
                sendResponse({
                    ok: true,
                    item,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_tool_permissions_delete') {
        void (async () => {
            try {
                const rawToolName = String(message?.payload?.toolName ?? '').trim();
                const rawOrigin = String(message?.payload?.origin ?? '').trim();
                if (!rawToolName) {
                    sendResponse({
                        ok: false,
                        error: 'toolName is required.',
                    });
                    return;
                }
                const origin = normalizePermissionOrigin(rawOrigin);
                if (!origin) {
                    sendResponse({
                        ok: false,
                        error:
                            'origin must be a valid origin pattern (*, https://*, *.example.com, https://*.example.com) or exact URL.',
                    });
                    return;
                }
                await deleteToolPermissionPolicy({
                    toolName: rawToolName,
                    origin,
                });
                sendResponse({
                    ok: true,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'tool_permission_decide') {
        void (async () => {
            try {
                const requestId = String(message?.payload?.requestId ?? '').trim();
                const decision = String(message?.payload?.decision ?? '').trim();
                if (!requestId) {
                    sendResponse({
                        ok: false,
                        error: 'requestId is required.',
                    });
                    return;
                }
                if (
                    decision !== 'allow_once' &&
                    decision !== 'deny_once' &&
                    decision !== 'allow_always' &&
                    decision !== 'deny_always'
                ) {
                    sendResponse({
                        ok: false,
                        error: 'Invalid tool permission decision.',
                    });
                    return;
                }
                await applyToolPermissionDecision({
                    requestId,
                    decision,
                });
                sendResponse({
                    ok: true,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_active_tab_context_get') {
        void (async () => {
            try {
                const args = (message?.payload ?? {}) as Record<string, unknown>;
                const tab = await resolveTargetTabForPermission(args, sender);
                if (!tab?.url || typeof tab.id !== 'number') {
                    sendResponse({
                        ok: false,
                        error: 'No active tab found.',
                    });
                    return;
                }
                const origin = normalizeRuntimePermissionOrigin(tab.url);
                sendResponse({
                    ok: true,
                    tab: {
                        tabId: tab.id,
                        url: tab.url,
                        origin,
                        title: tab.title ?? null,
                    },
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_config_get') {
        void (async () => {
            try {
                const config = await loadExtensionConfig();
                sendResponse({
                    ok: true,
                    config,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_config_set') {
        const payload = message?.payload as ExtensionConfigPayload | undefined;
        void (async () => {
            try {
                const currentConfig = await loadExtensionConfig();
                const profile: ExtensionProfile =
                    payload?.profile === 'prod'
                        ? 'prod'
                        : payload?.profile === 'uat'
                            ? 'uat'
                            : currentConfig.profile;
                const config = await saveExtensionConfig({
                    profile,
                    apiBaseUrl: payload?.apiBaseUrl ?? '',
                    appBaseUrl: payload?.appBaseUrl ?? '',
                    wsBaseUrl: payload?.wsBaseUrl ?? '',
                });
                sendResponse({
                    ok: true,
                    config,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();
        return true;
    }

    if (message?.type === 'extension_config_test') {
        const payload = message?.payload as ExtensionConfigPayload | undefined;
        const apiBaseUrl = (payload?.apiBaseUrl ?? '').trim();
        const healthUrl = `${apiBaseUrl.replace(/\/$/, '')}/health`;
        if (!isAllowedProxyUrl(healthUrl)) {
            sendResponse({
                ok: false,
                error: `Blocked proxy URL: ${healthUrl}`,
            });
            return true;
        }

        void (async () => {
            try {
                const response = await fetch(healthUrl, {
                    method: 'GET',
                    credentials: 'include',
                });
                sendResponse({
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();

        return true;
    }

    if (message?.type === 'open_side_panel') {
        const tabId = sender.tab?.id;
        const windowId = sender.tab?.windowId;

        if (typeof tabId !== 'number' && typeof windowId !== 'number') {
            sendResponse({ error: 'Missing sender tab context for side panel opening.' });
            return true;
        }

        // Keep the API call in the direct message handler path to preserve user gesture.
        const openRequest =
            typeof tabId === 'number'
                ? chrome.sidePanel.open({ tabId })
                : chrome.sidePanel.open({ windowId: windowId as number });

        void openRequest
            .then(() => {
                sendResponse({ ok: true });
            })
            .catch((error) => {
                sendResponse({
                    error: error instanceof Error ? error.message : String(error),
                });
            });

        return true;
    }

    if (message?.type === 'proxy_api_fetch') {
        const payload = message?.payload as ProxyFetchPayload | undefined;
        const rawUrl = payload?.url ?? '';
        if (!isAllowedProxyUrl(rawUrl)) {
            sendResponse({
                ok: false,
                error: `Blocked proxy URL: ${rawUrl}`,
            });
            return true;
        }

        void (async () => {
            try {
                const authMode = payload?.authMode ?? 'extension';
                const config = await loadExtensionConfig();
                const headers = sanitizeHeaders(payload?.headers);
                const isHealthEndpoint = rawUrl.endsWith('/health');
                if (authMode === 'extension' && !isHealthEndpoint) {
                    const token = await getValidAccessToken(config, {
                        allowRefresh: true,
                    });
                    if (!token) {
                        sendResponse({
                            ok: false,
                            error: 'Extension is not authenticated. Use Connect in extension settings.',
                        });
                        return;
                    }
                    headers.Authorization = `Bearer ${token}`;
                }
                const response = await fetch(rawUrl, {
                    method: payload?.method ?? 'GET',
                    headers,
                    body: payload?.bodyText,
                    credentials: authMode === 'cookie' ? 'include' : 'omit',
                });
                const bodyText = await response.text();
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
                sendResponse({
                    ok: true,
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    bodyText,
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })();

        return true;
    }

    if (message?.type === 'tool_execute') {
        const toolName = String(message?.name ?? '').trim();
        const executor = toolExecutors[toolName];
        if (!executor) {
            sendResponse({ ok: false, error: `Unknown local tool: ${toolName}` });
            return true;
        }

        void (async () => {
            let upstreamCommand: UpstreamCommandContext | null = null;
            try {
                const args = (message?.args ?? {}) as Record<string, unknown>;
                const w1ScopeRejection = getW1ScopeRejectionReason(args);
                if (w1ScopeRejection) {
                    sendResponse({
                        ok: false,
                        error: w1ScopeRejection,
                    });
                    return;
                }
                const targetTab = await resolveTargetTabForPermission(args, sender);
                if (!targetTab?.url || typeof targetTab.id !== 'number') {
                    sendResponse({
                        ok: false,
                        error:
                            'No active injectable tab found for local tool execution. ' +
                            'Select a normal web page tab or pass args.tabId explicitly.',
                    });
                    return;
                }
                if (!canInjectTabUrl(targetTab.url)) {
                    sendResponse({
                        ok: false,
                        error: `Unsupported tab URL for automation: ${targetTab.url}`,
                    });
                    return;
                }
                const origin = normalizeRuntimePermissionOrigin(targetTab.url);
                if (!origin) {
                    sendResponse({
                        ok: false,
                        error: `Unable to determine origin from tab URL: ${targetTab.url}`,
                    });
                    return;
                }

                const permissionToolName = derivePermissionToolName(toolName, args);
                const permissionCheck = await evaluateToolPermission({
                    toolName: permissionToolName,
                    origin,
                    tabId: targetTab.id,
                    tabUrl: targetTab.url,
                    tabTitle: targetTab.title ?? undefined,
                    details:
                        toolName === 'tab_read'
                            ? { mode: String(args.mode ?? 'info') }
                            : toolName === 'tab_action'
                                ? {
                                    actionCount: Array.isArray(args.actions)
                                        ? args.actions.length
                                        : 1,
                                }
                                : undefined,
                });

                if (!permissionCheck.allowed) {
                    if ('request' in permissionCheck) {
                        sendResponse({
                            ok: false,
                            error: 'permission_required',
                            permissionRequest: permissionCheck.request,
                        });
                        return;
                    }
                    sendResponse({
                        ok: false,
                        error: permissionCheck.reason,
                    });
                    return;
                }

                const context: ToolExecutionContext = {
                    senderTabId: sender.tab?.id,
                    senderWindowId: sender.tab?.windowId,
                };
                upstreamCommand = await dispatchUpstreamCommandForToolExecution({
                    toolName,
                    args,
                    targetTab,
                });
                const result = await executor(
                    {
                        ...args,
                        tabId:
                            typeof args.tabId === 'number' && Number.isFinite(args.tabId)
                                ? args.tabId
                                : targetTab.id,
                    },
                    context,
                );
                try {
                    await reportUpstreamTerminalAck({
                        command: upstreamCommand,
                        status: 'completed',
                    });
                } catch (ackError) {
                    const reason =
                        ackError instanceof Error
                            ? ackError.message
                            : String(ackError);
                    console.warn(
                        `Failed to report upstream completion ack: ${reason}`,
                    );
                }
                sendResponse({ ok: true, result });
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                try {
                    await reportUpstreamTerminalAck({
                        command: upstreamCommand,
                        status: 'failed',
                        reason,
                    });
                } catch {
                    // noop: keep local error as primary response path.
                }
                sendResponse({
                    ok: false,
                    error: reason,
                });
            }
        })();
        return true; // async response
    }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

void bootstrapToolPermissionSync();

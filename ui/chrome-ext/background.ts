// Service Worker for Top AI Ideas Extension
// Thin launcher: side panel management, config, auth, script injection, tab registration.
// Tool execution (tab_read, tab_action) is handled by the shared injected
// script + bridge iframe. The sidepanel loads the webapp directly via iframe.
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
import { generateInjectedScript } from '$lib/upstream/injected-script';

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

type ExtensionConfigPayload = {
    profile?: ExtensionProfile;
    apiBaseUrl?: string;
    appBaseUrl?: string;
    wsBaseUrl?: string;
};

const canInjectTabUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    return !NON_INJECTABLE_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
};

const isAllowedProxyUrl = (rawUrl: string): boolean => {
    try {
        const parsed = new URL(rawUrl);
        return ALLOWED_PROXY_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
};

// ---------------------------------------------------------------------------
// Message handlers (auth, config, panel)
// ---------------------------------------------------------------------------

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

});

// ---------------------------------------------------------------------------
// Script injection: inject shared injected script on active pages
// ---------------------------------------------------------------------------

const injectSharedScript = async (tabId: number): Promise<void> => {
    try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab || !canInjectTabUrl(tab.url)) return;

        const config = await loadExtensionConfig();
        const webappOrigin = config.appBaseUrl.replace(/\/$/, '');
        if (!webappOrigin) return;

        const scriptCode = generateInjectedScript(webappOrigin);

        await chrome.scripting.executeScript({
            target: { tabId },
            func: (code: string) => {
                new Function(code)();
            },
            args: [scriptCode],
        });
    } catch (error) {
        // Silently ignore injection failures (e.g. restricted pages).
        console.debug('Script injection skipped for tab', tabId, error);
    }
};

// ---------------------------------------------------------------------------
// Tab registration: register/keepalive/unregister with API tab registry
// ---------------------------------------------------------------------------

const TAB_KEEPALIVE_INTERVAL_MS = 15_000;
const registeredTabs = new Map<number, ReturnType<typeof setInterval>>();

const apiTabFetch = async (
    path: string,
    body: Record<string, unknown>,
): Promise<boolean> => {
    try {
        const config = await loadExtensionConfig();
        const token = await getValidAccessToken(config, { allowRefresh: true });
        if (!token) return false;
        const apiBase = config.apiBaseUrl.replace(/\/$/, '');
        const response = await fetch(`${apiBase}/api/v1/chrome-extension${path}`, {
            method: path.startsWith('/tabs/') && !path.includes('keepalive')
                ? (body._method as string ?? 'POST')
                : 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            credentials: 'omit',
            body: JSON.stringify(body),
        });
        return response.ok;
    } catch {
        return false;
    }
};

const registerTabOnServer = async (
    tabId: number,
    url: string,
    title: string,
): Promise<void> => {
    const tabIdStr = String(tabId);
    await apiTabFetch('/tabs/register', {
        tab_id: tabIdStr,
        url,
        title,
        source: 'chrome_plugin',
    });

    // Set up keepalive if not already running
    if (!registeredTabs.has(tabId)) {
        const intervalId = setInterval(() => {
            void apiTabFetch('/tabs/keepalive', { tab_id: tabIdStr });
        }, TAB_KEEPALIVE_INTERVAL_MS);
        registeredTabs.set(tabId, intervalId);
    }
};

const unregisterTabOnServer = async (tabId: number): Promise<void> => {
    const intervalId = registeredTabs.get(tabId);
    if (intervalId) {
        clearInterval(intervalId);
        registeredTabs.delete(tabId);
    }
    try {
        const config = await loadExtensionConfig();
        const token = await getValidAccessToken(config, { allowRefresh: true });
        if (!token) return;
        const apiBase = config.apiBaseUrl.replace(/\/$/, '');
        await fetch(`${apiBase}/api/v1/chrome-extension/tabs/${tabId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'omit',
        });
    } catch {
        // Best effort
    }
};

// Inject + register on tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
        const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
        if (!tab || !canInjectTabUrl(tab.url)) return;
        await injectSharedScript(activeInfo.tabId);
        await registerTabOnServer(activeInfo.tabId, tab.url ?? '', tab.title ?? '');
    })();
});

// Re-inject + re-register on navigation complete
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!canInjectTabUrl(tab.url)) return;
    void (async () => {
        await injectSharedScript(tabId);
        await registerTabOnServer(tabId, tab.url ?? '', tab.title ?? '');
    })();
});

// Unregister on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    void unregisterTabOnServer(tabId);
});

// ---------------------------------------------------------------------------
// Side panel behavior
// ---------------------------------------------------------------------------

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Export canInjectTabUrl for use by other modules (e.g. tab registration).
export { canInjectTabUrl };

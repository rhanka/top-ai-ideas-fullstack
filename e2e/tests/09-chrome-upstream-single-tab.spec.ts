import { test, expect } from '@playwright/test';

test.describe.serial('Chrome upstream single-tab', () => {
  const chatButtonSelector =
    'button[title="Chat / Jobs"], button[title="Chat / Jobs IA"], button[aria-label="Chat / Jobs"], button[aria-label="Chat / Jobs IA"]';
  const composerSelector = '[role="textbox"][aria-label="Composer"]';

  async function mockExtensionRuntime(page: any) {
    await page.addInitScript(() => {
      const state = {
        activeTab: {
          tabId: 101,
          url: 'https://example.com/search?q=top-ai',
          origin: 'https://example.com',
          title: 'Example Search',
        },
        config: {
          profile: 'uat',
          apiBaseUrl: 'http://localhost:8787/api/v1',
          appBaseUrl: 'http://localhost:5173',
          wsBaseUrl: '',
          updatedAt: Date.now(),
        },
      };

      const sendMessage = async (message: any) => {
        const type = String(message?.type ?? '');
        if (type === 'extension_active_tab_context_get') return { ok: true, tab: state.activeTab };
        if (type === 'extension_auth_status') {
          return {
            ok: true,
            status: {
              connected: true,
              user: {
                id: 'e2e-extension-user',
                email: 'e2e-extension@example.com',
                displayName: 'E2E Extension',
                role: 'admin_app',
              },
            },
          };
        }
        if (type === 'extension_auth_connect') return { ok: true };
        if (type === 'extension_auth_logout' || type === 'extension_auth_open_login') return { ok: true };
        if (type === 'extension_config_get') return { ok: true, config: state.config };
        if (type === 'extension_config_set') return { ok: true, config: state.config };
        if (type === 'extension_config_test') return { ok: true, status: 200 };
        if (type === 'extension_tool_permissions_list') return { ok: true, items: [] };
        if (type === 'extension_tool_permissions_upsert' || type === 'extension_tool_permissions_delete') {
          return { ok: true };
        }
        if (type === 'tool_permission_decide') return { ok: true };
        if (type === 'tool_execute') return { ok: true, result: { status: 'completed' } };
        if (type === 'open_side_panel') return { ok: true };
        return { ok: true };
      };

      const existingChrome = (globalThis as any).chrome ?? {};
      const existingRuntime = existingChrome.runtime ?? {};
      (globalThis as any).chrome = {
        ...existingChrome,
        runtime: {
          ...existingRuntime,
          id: 'e2e-extension-runtime',
          sendMessage,
        },
      };
    });
  }

  async function sendMessageAndCaptureRequest(page: any, message: string) {
    const composer = page.locator(composerSelector);
    await expect(composer).toBeVisible({ timeout: 10_000 });
    const editable = page
      .locator(
        '[role="textbox"][aria-label="Composer"][contenteditable="true"]:visible, [role="textbox"][aria-label="Composer"]:visible [contenteditable="true"]:visible'
      )
      .first();
    await expect(editable).toBeVisible({ timeout: 10_000 });
    await editable.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(message);
    const [req, res] = await Promise.all([
      page.waitForRequest((request: any) => request.method() === 'POST' && request.url().includes('/api/v1/chat/messages')),
      page.waitForResponse((response: any) => {
        const request = response.request();
        return request.method() === 'POST' && response.url().includes('/api/v1/chat/messages');
      }),
      page.keyboard.press('Enter')
    ]);
    await res.body().catch(() => null);
    return JSON.parse(req.postData() || '{}');
  }

  test('keeps W1 single-tab tool scope in extension runtime', async ({ page }) => {
    await mockExtensionRuntime(page);
    await page.goto('/folders');
    await page.waitForLoadState('domcontentloaded');

    const chatButton = page.locator(chatButtonSelector);
    await expect(chatButton).toBeVisible({ timeout: 10_000 });
    await chatButton.click();

    const menuButton = page.locator('button[aria-label="Ouvrir le menu"]');
    await expect(menuButton).toBeVisible({ timeout: 10_000 });
    await menuButton.click();

    const menu = page.locator('div.absolute').filter({ hasText: 'Contexte(s)' }).first();
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu).toContainText('Onglet actif:');
    await expect(menu.locator('button', { hasText: 'Onglet (lecture)' })).toBeVisible({ timeout: 10_000 });
    await expect(menu.locator('button', { hasText: 'Onglet (actions)' })).toBeVisible({ timeout: 10_000 });

    const requestBody = await sendMessageAndCaptureRequest(page, 'Réponds avec OK_SINGLE_TAB');
    const toolNames = (requestBody?.localToolDefinitions ?? [])
      .map((entry: { name?: string }) => String(entry?.name ?? ''))
      .sort();
    expect(toolNames).toEqual(['tab_action', 'tab_read']);
  });
});

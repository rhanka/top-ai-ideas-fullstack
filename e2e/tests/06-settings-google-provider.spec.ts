import { expect, test } from '@playwright/test';

test.describe('Google provider settings', () => {
  test.use({ storageState: './.auth/state.json' });

  test('admin can follow a mocked Google SSO flow from settings', async ({ page }) => {
    let providerState = {
      providerId: 'google',
      label: 'Google Cloud',
      ready: false,
      connectionStatus: 'disconnected',
      enrollmentId: null,
      enrollmentUrl: null,
      enrollmentCode: null,
      enrollmentExpiresAt: null,
      managedBy: 'none',
      accountLabel: 'mock-admin@google.com',
      updatedAt: null,
      updatedByUserId: null,
      canConfigure: true,
    };

    await page.route(/\/api\/v1\/settings\/provider-connections(?:\/google\/enrollment\/(?:start|complete|disconnect))?(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;

      if (pathname.endsWith('/google/enrollment/start')) {
        providerState = {
          ...providerState,
          connectionStatus: 'pending',
          enrollmentId: 'enroll_1',
          enrollmentUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          accountLabel: 'admin@google.com',
          updatedAt: '2026-03-09T20:00:00.000Z',
          updatedByUserId: 'admin-user',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ provider: providerState }),
        });
        return;
      }

      if (pathname.endsWith('/google/enrollment/complete')) {
        providerState = {
          ...providerState,
          ready: true,
          connectionStatus: 'connected',
          enrollmentId: null,
          enrollmentUrl: null,
          enrollmentCode: null,
          managedBy: 'admin_settings',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ provider: providerState }),
        });
        return;
      }

      if (pathname.endsWith('/google/enrollment/disconnect')) {
        providerState = {
          ...providerState,
          ready: false,
          connectionStatus: 'disconnected',
          enrollmentId: null,
          enrollmentUrl: null,
          enrollmentCode: null,
          managedBy: 'none',
          accountLabel: null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ provider: providerState }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: [
            providerState,
            {
              providerId: 'openai',
              label: 'OpenAI',
              ready: false,
              connectionStatus: 'disconnected',
              enrollmentId: null,
              enrollmentUrl: null,
              enrollmentCode: null,
              enrollmentExpiresAt: null,
              managedBy: 'none',
              accountLabel: null,
              updatedAt: null,
              updatedByUserId: null,
              canConfigure: false,
            },
          ],
        }),
      });
    });

    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Connexions providers|Provider connections/i })).toBeVisible();

    await page.getByLabel(/Google Cloud \/ Workspace/i).fill('admin@google.com');
    await page.getByRole('button', { name: /Connect Google Workspace \/ Cloud|Connecter Google Workspace \/ Cloud/i }).click();

    // In the mock, a window.open call is made, but playwright handles this gracefully by opening a popup or just ignoring.
    // The UI should show the pending state and the input to paste URL.
    await expect(
      page.getByRole('button', { name: /Restart sign-in|Recommencer/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Cancel|Annuler/i }),
    ).toBeVisible();

    // Paste the URL
    await page.getByLabel(/Pasted URL|URL copiée/i).fill('http://127.0.0.1:8709/callback?code=fakecode');
    await page.getByRole('button', { name: /Submit URL|Valider l'URL/i }).click();

    await expect(page.getByText('Prêt', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: /Disconnect|Déconnecter le compte/i }).click();
    await expect(page.getByText('Non prêt', { exact: true }).first()).toBeVisible();
  });
});

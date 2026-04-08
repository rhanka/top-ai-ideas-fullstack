const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../ui/src/routes/settings/+page.svelte');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  "startCodexProviderEnrollment,",
  "startCodexProviderEnrollment,\n    startGoogleProviderEnrollment,\n    completeGoogleProviderEnrollment,\n    disconnectGoogleProviderEnrollment,"
);

// 2. Add state
const googleState = `
  let isSavingGoogleProviderConnection = false;
  let googleConnectionAccountLabel = '';
  let googleConnectionPastedUrl = '';
  let googleProviderConnection: ProviderConnectionState | null = null;
  $: googleProviderConnection =
    providerConnections.find((provider) => provider.providerId === 'google') ||
    null;
`;
content = content.replace("let isSavingCodexProviderConnection = false;", "let isSavingCodexProviderConnection = false;" + googleState);

// 3. Add to loadProviderConnections
content = content.replace(
  "codexConnectionAccountLabel =",
  "googleConnectionAccountLabel = providerConnections.find((provider) => provider.providerId === 'google')?.accountLabel || '';\n      codexConnectionAccountLabel ="
);

// 4. Add methods
const googleMethods = `
  const syncGoogleProviderInList = (updatedProvider: ProviderConnectionState) => {
    providerConnections = providerConnections.map((provider) =>
      provider.providerId === 'google' ? updatedProvider : provider,
    );
    if (!providerConnections.some((provider) => provider.providerId === 'google')) {
      providerConnections = [updatedProvider, ...providerConnections];
    }
    googleConnectionAccountLabel = updatedProvider.accountLabel || '';
  };

  const startGoogleProviderConnection = async () => {
    isSavingGoogleProviderConnection = true;
    providerConnectionsError = '';
    try {
      const updatedProvider = await startGoogleProviderEnrollment({
        accountLabel: googleConnectionAccountLabel.trim() || null,
      });
      syncGoogleProviderInList(updatedProvider);
      addToast({
        type: 'success',
        message: get(_)('settings.providerConnections.toasts.googleEnrollmentStarted'),
      });
      if (updatedProvider.enrollmentUrl) {
         window.open(updatedProvider.enrollmentUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to update google provider connection:', error);
      providerConnectionsError =
        error instanceof Error
          ? error.message
          : get(_)('settings.providerConnections.errors.save');
    } finally {
      isSavingGoogleProviderConnection = false;
    }
  };

  const completeGoogleProviderConnection = async () => {
    const google = googleProviderConnection;
    if (!google?.enrollmentId) {
      providerConnectionsError = get(_)('settings.providerConnections.errors.missingEnrollment');
      return;
    }
    if (!googleConnectionPastedUrl) {
       providerConnectionsError = 'Please paste the URL';
       return;
    }
    isSavingGoogleProviderConnection = true;
    providerConnectionsError = '';
    try {
      const updatedProvider = await completeGoogleProviderEnrollment({
        enrollmentId: google.enrollmentId,
        pastedUrl: googleConnectionPastedUrl.trim(),
        accountLabel: googleConnectionAccountLabel.trim() || null,
      });
      syncGoogleProviderInList(updatedProvider);
      googleConnectionPastedUrl = '';
      if (updatedProvider.connectionStatus === 'connected') {
        addToast({
          type: 'success',
          message: get(_)('settings.providerConnections.toasts.googleConnected'),
        });
      }
    } catch (error) {
      console.error('Failed to complete google provider enrollment:', error);
      providerConnectionsError =
          error instanceof Error
            ? error.message
            : get(_)('settings.providerConnections.errors.save');
    } finally {
      isSavingGoogleProviderConnection = false;
    }
  };

  const disconnectGoogleProviderConnection = async () => {
    isSavingGoogleProviderConnection = true;
    providerConnectionsError = '';
    try {
      const updatedProvider = await disconnectGoogleProviderEnrollment();
      syncGoogleProviderInList(updatedProvider);
      addToast({
        type: 'success',
        message: get(_)('settings.providerConnections.toasts.googleDisconnected'),
      });
    } catch (error) {
      console.error('Failed to disconnect google provider connection:', error);
      providerConnectionsError =
        error instanceof Error
          ? error.message
          : get(_)('settings.providerConnections.errors.save');
    } finally {
      isSavingGoogleProviderConnection = false;
    }
  };
`;
content = content.replace("const disconnectCodexProviderConnection = async () => {", googleMethods + "\n  const disconnectCodexProviderConnection = async () => {");

// 5. Add DOM UI
const googleUI = `
      {#if googleProviderConnection?.canConfigure}
        <div class="space-y-2 rounded border border-slate-200 p-3 mt-4">
          <h3 class="text-sm font-semibold text-slate-800">Google Cloud (Vertex AI) SSO</h3>
          <p class="text-xs text-slate-600 mb-2">{$_('settings.providerConnections.google.description')}</p>
          <label for="google-provider-account" class="block text-sm font-medium text-slate-700">
            {$_('settings.providerConnections.google.accountLabel')}
          </label>
          <input
            id="google-provider-account"
            type="text"
            bind:value={googleConnectionAccountLabel}
            placeholder={$_('settings.providerConnections.google.accountPlaceholder')}
            class="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            disabled={isSavingGoogleProviderConnection}
          />
          <div class="flex flex-wrap gap-2 mt-2">
            {#if !googleProviderConnection || googleProviderConnection.connectionStatus === 'disconnected'}
              <button
                type="button"
                class={settingsPrimaryButtonClass}
                on:click={startGoogleProviderConnection}
                disabled={isSavingGoogleProviderConnection}
              >
                {$_('settings.providerConnections.google.startEnrollment')}
              </button>
            {/if}
            {#if googleProviderConnection?.connectionStatus === 'pending'}
              <button
                type="button"
                class={settingsPrimaryButtonClass}
                on:click={startGoogleProviderConnection}
                disabled={isSavingGoogleProviderConnection}
              >
                {$_('settings.providerConnections.google.regenerateEnrollment')}
              </button>
              <button
                type="button"
                class={settingsSecondaryButtonClass}
                on:click={disconnectGoogleProviderConnection}
                disabled={isSavingGoogleProviderConnection}
              >
                {$_('settings.providerConnections.google.cancelEnrollment')}
              </button>
            {/if}
            {#if googleProviderConnection?.connectionStatus === 'connected'}
              <button
                type="button"
                class={settingsSecondaryButtonClass}
                on:click={disconnectGoogleProviderConnection}
                disabled={isSavingGoogleProviderConnection}
              >
                {$_('settings.providerConnections.google.disconnect')}
              </button>
            {/if}
          </div>
          {#if googleProviderConnection?.connectionStatus === 'pending'}
            <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p class="text-sm text-blue-800 mb-2">
                {$_('settings.providerConnections.google.pendingHint')}
              </p>
              <label for="google-pasted-url" class="block text-xs font-medium text-slate-700 mb-1">
                {$_('settings.providerConnections.google.pastedUrlLabel')}
              </label>
              <input
                id="google-pasted-url"
                type="text"
                bind:value={googleConnectionPastedUrl}
                placeholder={$_('settings.providerConnections.google.pastedUrlPlaceholder')}
                class="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 mb-2"
                disabled={isSavingGoogleProviderConnection}
              />
              <button
                type="button"
                class={settingsPrimaryButtonClass}
                on:click={completeGoogleProviderConnection}
                disabled={isSavingGoogleProviderConnection || !googleConnectionPastedUrl}
              >
                {$_('settings.providerConnections.google.completeEnrollment')}
              </button>
            </div>
          {/if}
        </div>
      {/if}
`;

content = content.replace("{/if}\n    {/if}\n\n    {#if providerConnectionsError}", googleUI + "\n    {/if}\n    {/if}\n\n    {#if providerConnectionsError}");

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI Svelte patch complete.');

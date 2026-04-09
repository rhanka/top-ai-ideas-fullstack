# SPEC_EVOL: Google SSO Integration (Seat-Based Quota)

## 1. Context and Objective

The objective is to integrate Google SSO to authenticate users against Google Cloud / Vertex AI services, allowing the application to utilize the user's individual Google Workspace or Gemini Advanced quota (seat-based pricing).

This avoids centralizing API costs on a single corporate billing account and instead piggybacks on existing Google Cloud identities, similar to how the `Codex` integration works.

## 2. Technical Constraints

### 2.1 Google OAuth Restrictions
- Google explicitly forbids the use of the "Device Authorization Grant" (OTP flow, smart TV flow) for scopes related to Generative AI (`https://www.googleapis.com/auth/cloud-platform` and `https://www.googleapis.com/auth/generative-language`).
- Google also blocked the "Out-Of-Band" (OOB) manual copy/paste flow (`urn:ietf:wg:oauth:2.0:oob`) for security reasons.

### 2.2 Client Identity Emulation
To benefit from the same default quotas and seamless integration as official developer tools, this implementation emulates the official **Gemini CLI** OAuth 2.0 Desktop Application.
- **Client ID and Client Secret** are extracted at build time from the `@google/gemini-cli-core` npm package (devDependency). The extraction script reads `dist/src/code_assist/oauth2.js` and generates `api/src/generated/gemini-oauth-credentials.ts`.
- **Source of truth:** `@google/gemini-cli-core` open-source package (Apache-2.0). The client secret is public per Google's installed application policy (see [Google OAuth2 docs](https://developers.google.com/identity/protocols/oauth2#installed)).
- **Required Scopes:** `https://www.googleapis.com/auth/cloud-platform` (Vertex AI access), `openid`, `email`, `profile`.
- **Build-time extraction flow:** `npm install` triggers `postinstall` hook → `scripts/extract-gemini-credentials.mjs` reads the package → writes `src/generated/gemini-oauth-credentials.ts` (gitignored). The `prebuild` hook ensures the file exists before esbuild bundles it.

### 2.3 The Loopback Workaround
Because the Client ID is a "Desktop App", Google only permits redirections to `127.0.0.1` or `localhost`.
If the application is deployed in production (e.g., `https://top-ai-ideas.sent-tech.ca`), a direct OAuth redirection will fail.

**The Solution:**
1. The UI generates an OAuth authorization URL requesting redirection to `http://127.0.0.1:8709/callback`.
2. The user authenticates on Google's consent screen.
3. Google redirects the browser to `127.0.0.1`.
4. **UX Intervention:** In a production context (where the user's browser cannot reach a local server on 8709), the connection will fail in the browser. The UI will instruct the user to copy the failed `127.0.0.1` URL and paste it into a dialog.
5. The backend extracts the `code=...` parameter from the pasted URL and exchanges it for an Access Token and Refresh Token.

## 3. Architecture & Implementation

### 3.1 API (Backend)
New service: `api/src/services/google-provider-auth.ts`
- **`startGoogleDeviceEnrollment()`**: Generates the OAuth 2.0 authorization URL using the Gemini CLI client ID (extracted from `@google/gemini-cli-core`).
- **`completeGoogleDeviceEnrollment(redirectUrl, pending)`**: Parses the authorization code from the provided URL and exchanges it for tokens (including `client_secret`) using standard HTTP calls to `oauth2.googleapis.com/token`.

Modifications in `api/src/services/provider-connections.ts`:
- Manage Google connection state alongside Codex.
- Expose endpoints:
  - `GET /api/v1/settings/provider-connections/google/enrollment/start`
  - `POST /api/v1/settings/provider-connections/google/enrollment/complete` (accepts the pasted URL)
  - `POST /api/v1/settings/provider-connections/google/enrollment/disconnect`

### 3.2 UI (Frontend)
- Update Settings view (`Provider connections` section) to include "Google Cloud (Vertex AI)".
- Implement the "Connect" flow:
  - Fetch the authorization URL.
  - Open it in a new tab.
  - Show a modal dialog asking the user to paste the redirect URL (`http://127.0.0.1:8709/...`).
  - Submit the URL to the completion endpoint and update the provider state.

### 3.3 Runtime Source Selection (Transport Toggle)
Users can choose between using their global Gemini API Key or their linked Google SSO Token.
- **Setting Key:** `provider_connection_mode:gemini` (values: `token` | `google`).
- **Backend Resolution:** `api/src/services/llm-runtime/index.ts` intercepts Gemini requests. If the mode is `google`, it resolves the access token via `resolveConnectedGoogleTransport(userId)` and injects it as the credential.
- **UI Interaction:** A toggle in the Settings page allows switching between modes, only enabled if a Google account is connected.

### 3.4 Security
- **PKCE (Proof Key for Code Exchange)** is used to secure the authorization code flow.
- The `state` parameter is used to prevent CSRF attacks.
- Tokens are stored securely in the user's settings, following the existing `provider_connection_secret` pattern.

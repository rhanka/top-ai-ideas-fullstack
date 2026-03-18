# SPEC EVOL - Chrome Upstream Control, Multi-Tab, Voice

Status: V2 — rewrite for iframe bridge architecture (2026-03-17)

## 1) Objective
Extend the Chrome plugin from local tool execution to upstream-oriented remote control in two milestones:

- Milestone W1: Upstream control foundation (remote control + upstream sync, single-tab).
- Milestone W2: Multi-tab orchestration and voice interaction.

## 2) Scope

In scope:
- Upstream protocol for delegated control sessions.
- Single-tab remote control baseline in W1.
- Compatibility with existing local tools (`tab_read`, `tab_action`).

Out of scope:
- Multi-tab coordination (W2).
- Voice capture/command pipeline (W2).
- Non-Chromium browser support.

## 3) Existing baseline
Relevant references: `spec/SPEC_CHROME_PLUGIN.md`, `spec/SPEC.md`, `spec/TOOLS.md`, `spec/SPEC_CHATBOT.md`.

Current state: local tools and runtime permission model are in place. Overlay/sidepanel architecture is available. No upstream orchestration yet.

## 4) Target design

### 4.1 Architecture — iframe bridge (bookmarklet + chrome plugin unified)

Both bookmarklet and chrome plugin share the **same upstream architecture**:

- **Injected script** (on the external page): minimal JS with direct DOM access. Handles `tab_read` (querySelector, getDisplayMedia screenshot JPEG 95 max 1280px) and `tab_action` (click, input, scroll). Communicates with the bridge iframe via `postMessage`.
- **Bridge iframe** (served from webapp origin, e.g. `/bookmarklet-bridge`): Svelte-compiled page on the webapp domain. Has session auth (cookie), can call the API without CORS. Manages tab registration, keepalive, command polling/reception via chat stream SSE, and result forwarding via `POST /chat/messages/:id/tool-results`.
- **postMessage channel**: cross-origin communication between the injected script and the bridge iframe. Origin-verified on both sides.

This eliminates: server-generated runtime.js, SSE/ack/register/keepalive API endpoints, custom bookmarklet JWT, CORS exceptions.

### 4.2 Chrome plugin simplification

The chrome extension becomes a thin launcher:
- Side panel loads the **webapp URL directly** (replaces `sidepanel.html`). The side panel content is an iframe to the webapp — same-origin, session auth via cookie, no need for SSE/API proxy in background.ts.
- `sidepanel.html` becomes a minimal shell that loads the webapp URL in an iframe (or is replaced entirely by setting the panel URL to the webapp).
- **SSE proxy and API proxy in background.ts are removed** — the webapp iframe handles its own API calls directly.
- Injects the **same script** as the bookmarklet onto the active page via `chrome.scripting.executeScript`.
- Re-injects automatically on navigation (`chrome.tabs.onUpdated`).
- Optionally uses `chrome.tabs.captureVisibleTab` for higher-quality screenshots (no user prompt).
- `background.ts` reduced to minimal: inject script + tab registration + panel management. No SSE/API proxy.

### 4.3 Bookmarklet

- Bootstrap `javascript:void(...)` generated client-side by the UI ("Copy bookmarklet" in menu "+"). No API call needed.
- Injects bridge iframe + tool executor script.
- TrustedTypes: creates `trustedTypes.createPolicy('topai', ...)` before src assignments for CSP-strict sites.
- Auth: bridge iframe is same-origin with webapp, carries session cookie. Optional nonce via `GET /api/v1/bookmarklet/nonce` for handshake security.
- Ephemeral: disappears on page reload. User re-clicks bookmarklet to reconnect.

### 4.4 Command dispatch flow

```
Webapp chat -> AI calls tab_read/tab_action
  -> chat-service writes awaiting_external_result to stream
  -> bridge iframe detects pending tool call via chat stream SSE
  -> bridge iframe sends command to injected script via postMessage
  -> injected script executes on DOM
  -> injected script sends result back via postMessage
  -> bridge iframe POSTs result to API via /chat/messages/:id/tool-results
  -> chat-service resumes generation with tool result
```

Same flow as existing chrome plugin local tool execution (`pendingLocalToolCalls`), just with postMessage instead of `chrome.runtime.sendMessage`.

### 4.5 Tab registry

- API maintains in-memory Tab Registry for connected tabs.
- Both bridge iframe and chrome extension register via `POST /api/v1/chrome-extension/tabs/register`.
- Keepalive every 15s, eviction after 45s.
- Chat-service injects `tab_read`/`tab_action` tools when tabs are registered and client has no local tab tools (webapp context).
- `tab_id` (underscore, string) is canonical parameter.

### 4.6 Screenshot

- JPEG quality 95, max 1280px width.
- Bookmarklet: `getDisplayMedia` + canvas. Chrome plugin: `captureVisibleTab`.
- V1 limitation: passed as text to LLM, not multimodal. Deferred to BR-14.

### 4.7 Menu "+" (composer)

- "Copy bookmarklet" button. Menu uses `MenuPopover strategy="fixed"` to escape overflow:hidden.
- Dynamic max-height for context/tool sections.
- Chrome plugin: identical tools to main (web_search, web_extract, documents, etc.). No regression.

### 4.8 Multi-tab orchestration (W2)
- Tab-scoped execution contexts, arbitration rules, batch commands.

### 4.9 Video stream proxy (W2)
- Buffered frame capture, live tab preview in UI.

### 4.10 Voice controls (W2)
- Capture -> transcription -> intent/tool mapping.

## 5) Branch plan

- `feat/chrome-upstream-v1-rewrite` — iframe bridge architecture, single-tab.
- `feat/chrome-upstream-multitab-voice` — multi-tab + voice + video proxy.

## 6) Acceptance criteria

W1:
- Bookmarklet: inject on external site -> badge -> tab registered -> tab_read/tab_action from webapp works.
- Chrome plugin: all existing tools work identically to main. Tabs visible in webapp.
- Webapp: tab_read/tab_action dispatched to bookmarklet or chrome tab via bridge iframe.
- Menu "+": correct tools, no regression, bookmarklet copy works.

## 7) Open questions

- `CHU-Q1`: ~~Transport mode~~ **Resolved: iframe bridge + postMessage.**
- `CHU-Q2`: Minimum permission granularity for upstream control?

## 8) Risks

- Security: upstream command scope must be bounded.
- Race conditions in multi-tab (W2).

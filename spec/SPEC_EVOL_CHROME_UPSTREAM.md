# SPEC EVOL - Chrome Upstream Control, Multi-Tab, Voice

Status: V3 — Chrome extension only (2026-03-28)

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

### 4.1 Architecture

- **Injected script** (on the external page): minimal JS with direct DOM access. Handles `tab_read` (querySelector, getDisplayMedia screenshot JPEG 95 max 1280px) and `tab_action` (click, input, scroll). Communicates via `postMessage` or `chrome.runtime.sendMessage`.
- **postMessage channel**: cross-origin communication between the injected script and the webapp. Origin-verified on both sides.

### 4.2 Chrome extension

The chrome extension is a thin launcher:
- Side panel loads the **webapp URL directly** (replaces `sidepanel.html`). Same-origin, session auth via cookie.
- **SSE proxy and API proxy in background.ts are removed** — the webapp iframe handles its own API calls directly.
- Injects the shared script onto the active page via `chrome.scripting.executeScript`.
- Re-injects automatically on navigation (`chrome.tabs.onUpdated`).
- Optionally uses `chrome.tabs.captureVisibleTab` for higher-quality screenshots (no user prompt).
- `background.ts` reduced to minimal: inject script + tab registration + panel management.

### 4.3 Command dispatch flow

```
Webapp chat -> AI calls tab_read/tab_action
  -> chat-service writes awaiting_external_result to stream
  -> chrome extension detects pending tool call
  -> extension sends command to injected script via postMessage
  -> injected script executes on DOM
  -> injected script sends result back via postMessage
  -> result forwarded to API
  -> chat-service resumes generation with tool result
```

Same flow as existing chrome plugin local tool execution (`pendingLocalToolCalls`), just with postMessage instead of `chrome.runtime.sendMessage`.

### 4.4 Tab registry

- API maintains in-memory Tab Registry for connected tabs.
- Chrome extension registers via `POST /api/v1/chrome-extension/tabs/register`.
- Keepalive every 15s, eviction after 45s.
- Chat-service injects `tab_read`/`tab_action` tools when tabs are registered and client has no local tab tools (webapp context).
- `tab_id` (underscore, string) is canonical parameter.

### 4.5 Screenshot

- JPEG quality 95, max 1280px width.
- Chrome plugin: `captureVisibleTab`.
- V1 limitation: passed as text to LLM, not multimodal. Deferred to BR-14.

### 4.6 Menu "+" (composer)

- Menu uses `MenuPopover strategy="fixed"` to escape overflow:hidden.
- Dynamic max-height for context/tool sections.
- Chrome plugin: identical tools to main (web_search, web_extract, documents, etc.). No regression.

### 4.7 Multi-tab orchestration (W2)
- Tab-scoped execution contexts, arbitration rules, batch commands.

### 4.8 Video stream proxy (W2)
- Buffered frame capture, live tab preview in UI.

### 4.9 Voice controls (W2)
- Capture -> transcription -> intent/tool mapping.

## 5) Branch plan

- `feat/chrome-upstream-v1-rewrite` — Chrome extension upstream, single-tab.
- `feat/chrome-upstream-multitab-voice` — multi-tab + voice + video proxy.

## 6) Acceptance criteria

W1:
- Chrome plugin: all existing tools work identically to main. Tabs visible in webapp.
- Webapp: tab_read/tab_action dispatched to chrome tab.
- Menu "+": correct tools, no regression.

## 7) Open questions

- `CHU-Q1`: ~~Transport mode~~ **Resolved: postMessage.**
- `CHU-Q2`: Minimum permission granularity for upstream control?

## 8) Risks

- Security: upstream command scope must be bounded.
- Race conditions in multi-tab (W2).

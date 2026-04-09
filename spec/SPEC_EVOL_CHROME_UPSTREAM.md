# SPEC EVOL - Chrome Upstream Control, Multi-Tab, Voice

Status: V4 — upstream tab_read/tab_action via webapp (2026-03-28)

## 1) Objective
Extend the Chrome plugin from local tool execution to upstream-oriented remote control in two milestones:

- Milestone W1: Upstream control foundation (remote control + upstream sync, single-tab).
- Milestone W2: Multi-tab orchestration and voice interaction.

## 2) Scope

In scope:
- Upstream protocol for delegated control sessions.
- Single-tab remote control baseline in W1.
- Multi-tab coordination in W2.
- Voice capture/command pipeline in W2.
- Compatibility with existing local tools (`tab_read`, `tab_action`).

Out of scope:
- Chrome extension refactoring (sidepanel, SSE proxy, background.ts structure unchanged from main in W1).
- Native desktop capture outside browser context.
- Non-Chromium browser support in this wave.

## 3) Existing baseline
Relevant references:
- `spec/SPEC_CHROME_PLUGIN.md`
- `spec/SPEC.md` (Chrome extension section)
- `spec/TOOLS.md`
- `spec/SPEC_CHATBOT.md` (streaming/event contracts)
- `TODO.md` (`Plugin Chrome (suite)`, `upstream`, `voice` items)

Current state summary:
- Local tools and runtime permission model are in place.
- Overlay/sidepanel architecture is available.
- No upstream multi-tab/voice orchestration yet.

## 4) Target design

### 4.1 Tab registry (W1)

- API maintains in-memory Tab Registry for connected tabs.
- Chrome extension registers active tab via `POST /api/v1/chrome-extension/tabs/register` from background.ts.
- Keepalive every 15s via `POST /api/v1/chrome-extension/tabs/keepalive`.
- Unregister via `DELETE /api/v1/chrome-extension/tabs/:tabId`.
- Eviction after 45s without keepalive.
- `tab_id` format: `chrome_<tabId>` (string).

### 4.2 Chat-service tool injection (W1)

- When a user has registered tabs AND the chat client has no local tab tools (= webapp, not extension sidepanel):
  - Chat-service injects `tab_read` and `tab_action` tool definitions in the tool list.
  - Tool descriptions include the list of connected tabs (tab_id, url, title).
- When the client HAS local tab tools (= extension sidepanel):
  - Local execution path unchanged (`pendingLocalToolCalls`).

### 4.3 Command dispatch (W1 — webapp → extension → tab)

```
Webapp chat → AI calls tab_read/tab_action
  → chat-service writes awaiting_external_result to stream
  → extension detects pending tool call (via SSE stream in sidepanel)
  → extension executes tool locally on the active tab
  → extension sends result back via API
  → chat-service resumes generation with tool result
```

### 4.4 Chrome extension changes (W1 — minimal)

No refactoring of existing extension architecture. Only additions to background.ts:
- `chrome.tabs.onActivated` → register active tab via API.
- `chrome.tabs.onUpdated` (status=complete) → re-register on navigation.
- `chrome.tabs.onRemoved` → unregister.
- Keepalive interval (15s).

Existing sidepanel, SSE proxy, tool execution, permissions — all unchanged.

### 4.5 Menu "+" (composer, W1)

- Menu uses `MenuPopover strategy="fixed"` to escape overflow:hidden.
- Dynamic max-height for context/tool sections.
- No regression on existing tools.

### 4.6 Screenshot (W1)

- JPEG quality 95, max 1280px width.
- Chrome plugin: `captureVisibleTab`.
- V1 limitation: passed as text to LLM, not multimodal. Deferred to BR-14.

### 4.7 Multi-tab orchestration (W2)
- Add tab registry and tab-scoped execution contexts.
- Add arbitration rules for active vs background tabs.
- Add batch/tab-sequence command support with rollback-safe checkpoints.

### 4.8 Video stream proxy (W2)
- Buffered frame capture, live tab preview in UI.

### 4.9 Voice controls (W2)
- Add voice command ingestion pipeline:
  - capture → transcription → intent/tool mapping.
- Integrate voice events in existing stream timeline.
- Add explicit privacy UX (recording indicator, consent, stop control).

## 5) Branch plan

- `feat/chrome-upstream-v1-rewrite` — upstream tab registry + webapp dispatch (W1).
- `feat/chrome-upstream-multitab-voice` — multi-tab orchestration + voice controls (W2).

## 6) Acceptance criteria

W1:
- Chrome plugin: all existing tools work identically to main. No regression.
- Webapp: tab_read/tab_action appear when extension has registered tabs.
- Webapp: dispatch works end-to-end (read DOM, execute action on tab).
- Menu "+": correct tools, no regression.

W2:
- Multi-tab execution works with explicit tab targeting.
- Voice command flow can trigger safe tool actions.
- Permission/consent checks are enforced for sensitive actions.

## 7) Open questions

- `CHU-Q1`: ~~Should upstream transport be WebSocket-only, SSE+REST hybrid, or pluggable?~~ **Resolved: existing SSE + local execution.**
- `CHU-Q2`: What is the minimum domain-level permission granularity for upstream control?
- `CHU-Q3`: How should command conflicts be resolved when two tabs match the same intent?
- `CHU-Q4`: Which voice provider/runtime is acceptable for W2 privacy constraints?
- `CHU-Q5`: Do we require hard session timeouts and forced re-approval for upstream sessions?

## 8) Risks

- Security risk if upstream command scope is too broad.
- Race conditions in multi-tab orchestration.
- Voice UX reliability and false positive commands.

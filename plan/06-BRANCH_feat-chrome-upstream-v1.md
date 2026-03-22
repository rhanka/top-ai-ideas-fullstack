# Feature: Chrome Upstream v1 (Rewrite — iframe bridge)

## BR-04 dependency note
Low impact: BR-04 renames `use_cases` → `initiatives` and `contextType=usecase` refs. Update context type references after BR-04 merge.

## Objective
Deliver upstream remote control for browser tabs (bookmarklet + chrome plugin) using an iframe bridge architecture. Shared codebase for tool execution, unified with existing chrome plugin local tool flow.

## Scope / Guardrails
- Scope limited to iframe bridge, injected script (tool executors), tab registry, chat-service integration, MenuPopover fix, bookmarklet copy UX.
- One migration max in `api/drizzle/*.sql` (if applicable).
- Make-only workflow, no direct Docker commands.
- Root workspace `~/src/top-ai-ideas-fullstack` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development must happen in isolated worktree `tmp/feat-chrome-upstream-v1-rewrite`.
- Automated test campaigns must run on dedicated environments (`ENV=test-*` / `ENV=e2e-*`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.
- Branch environment mapping: `ENV=feat-chrome-upstream-v1-rewrite` `API_PORT=8706` `UI_PORT=5106` `MAILDEV_UI_PORT=1006`.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/06-BRANCH_feat-chrome-upstream-v1.md`
- **Forbidden Paths (must not change in this branch)**:
  - `Makefile`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/NN-BRANCH_*.md` (except this branch file)
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `api/drizzle/*.sql` (max 1 file)
  - `.github/workflows/**`
  - `spec/**`, `PLAN.md`, `TODO.md` (docs consolidation or roadmap sync only)
  - `scripts/**` (only if strictly required by the branch objective)
- **Exception process**:
  - Declare exception ID `BR06-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.

## Feedback Loop
Actions with the following status should be included around tasks only if really required:
- subagent or agent requires support or informs: `blocked` / `deferred` / `cancelled` / `attention`
- conductor agent or human brings response: `clarification` / `acknowledge` / `refuse`

## AI Flaky tests
- Acceptance rule:
  - Accept only non-systematic provider/network/model nondeterminism as `flaky accepted`.
  - Non-systematic means at least one success on the same commit and same command.
  - Never amend tests with additive timeouts.
  - If flaky, analyze impact vs `main`: if unrelated, accept and record command + failing test file + signature in `BRANCH.md`; if related, treat as blocking.
  - Capture explicit user sign-off before merge.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: single capability, independently mergeable.

## UAT Management (in orchestration context)
- **Mono-branch**: UAT is performed on the integrated branch only (after each lot when UI/plugin surface is impacted).
- UAT checkpoints must be listed as checkboxes inside each relevant lot.
- Execution flow (mandatory):
  - Develop and run tests in `tmp/feat-chrome-upstream-v1-rewrite`.
  - Push branch before UAT.
  - Run user UAT from root workspace (`~/src/top-ai-ideas-fullstack`, `ENV=dev`).
  - Switch back to `tmp/feat-chrome-upstream-v1-rewrite` after UAT.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read relevant `.mdc` files, `README.md`, `TODO.md`, and linked specs (`spec/SPEC_EVOL_CHROME_UPSTREAM.md`).
  - [x] Confirm isolated worktree and environment mapping.
  - [x] Validate scope boundaries and declare exceptions if needed.

- [x] **Lot 1 — API: tab registry + chat-service tool injection + nonce**
  - [x] Add in-memory Tab Registry service (`api/src/services/tab-registry.ts`): register, unregister, listTabs, touchTab, evictStaleTabs, resolveTarget. Fields: tab_id, source, url, title, userId, connected_at, last_seen, status.
  - [x] Add `POST /api/v1/chrome-extension/tabs/register` endpoint (session auth): registers tab with {tab_id, url, title, source}.
  - [x] Add `POST /api/v1/chrome-extension/tabs/keepalive` endpoint (session auth): updates last_seen, triggers eviction of stale tabs (>45s).
  - [x] Add `DELETE /api/v1/chrome-extension/tabs/:tabId` endpoint (session auth).
  - [x] Add `GET /api/v1/bookmarklet/nonce` endpoint (session auth): returns a short-lived nonce for iframe bridge handshake.
  - [x] Chat-service: inject server-side `tab_read`/`tab_action` tool definitions (with `tab_id` param, connected tab descriptions) when tabs are registered AND client did NOT provide local tab tools (webapp context only).
  - [x] Chat-service: when client HAS local tab tools (chrome plugin) → `pendingLocalToolCalls` flow unchanged from main.
  - [x] Chat-service: when client has NO local tab tools (webapp) and AI calls tab_read/tab_action → write `awaiting_external_result` to stream (bridge iframe picks it up via chat stream SSE).
  - [x] Lot 1 gate:
    - [x] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] **API tests**
      - [x] Add `api/tests/unit/tab-registry.test.ts`
      - [x] Add `api/tests/unit/chat-service-tab-tools.test.ts`
      - [x] Sub-lot gate: `make test-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`

- [x] **Lot 2 — UI: bridge iframe + injected script + bookmarklet copy + MenuPopover**
  - [x] Create `/bookmarklet-bridge` Svelte route: listens for postMessage from injected script, polls chat stream SSE for pending tab tool calls, forwards commands via postMessage, posts results via `/chat/messages/:id/tool-results`. Manages tab registration + keepalive via API.
  - [x] Create shared injected script module (`ui/src/lib/upstream/injected-script.ts`): DOM executor for tab_read (querySelector, screenshot via getDisplayMedia JPEG 95 max 1280px) and tab_action (click, input, scroll). postMessage listener for commands from bridge. Visual badge (connection status). Re-entrant guard.
  - [x] MenuPopover: add `strategy` prop ('absolute' | 'fixed'), `computeFixedStyle()` for position:fixed, z-50.
  - [x] ChatPanel: dynamic max-height for context/tool sections. "Copy bookmarklet" button generating `javascript:void(...)` client-side (injects bridge iframe + script, TrustedTypes support). No API call for generation.
  - [x] Lot 2 gate:
    - [x] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] **UI tests**
      - [x] Add `ui/tests/upstream/injected-script.test.ts`
      - [x] Add `ui/tests/upstream/bridge.test.ts`
      - [x] Sub-lot gate: `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`

- [x] **Lot 3 — Chrome extension simplification + non-regression**
  - [x] Simplify `background.ts`: keep side panel management, remove tool execution logic (moved to shared injected script).
  - [x] Chrome extension injects the same shared script as bookmarklet via `chrome.scripting.executeScript`.
  - [x] Re-inject on navigation (`chrome.tabs.onUpdated`).
  - [x] Register tabs in API Tab Registry + keepalive.
  - [x] Optional: `captureVisibleTab` for screenshots passed to injected script via postMessage.
  - [x] Non-regression: web_search, web_extract, documents, tab_read, tab_action, comments — all work as on main.
  - [x] Lot 3 gate:
    - [x] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] Sub-lot gate: `make test-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] Sub-lot gate: `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`

- [ ] **Lot N-2 — UAT**
  - [ ] Bookmarklet (from webapp)
    - [ ] Open webapp chat with folder context
    - [ ] Click "Copy bookmarklet" in menu "+" → copy to clipboard
    - [ ] Paste in browser address bar on external site (google.com) → badge appears → "Top AI"
    - [ ] Tab Manager in webapp shows connected tab with URL/title
    - [ ] tab_read mode=dom → returns DOM content
    - [ ] tab_action action=click selector=... → action executes on external page
    - [ ] tab_read mode=screenshot → returns JPEG data
    - [ ] Reload external page → tab disconnected in webapp
    - [ ] Re-click bookmarklet → reconnects
    - [ ] Test on TrustedTypes site (Outlook Web) → no CSP error
  - [ ] Chrome plugin — non-regression
    - [ ] Side panel loads webapp normally
    - [ ] All tools visible in menu "+": web_search, web_extract, documents, tab_read, tab_action (identical to main)
    - [ ] tab_read on active tab → returns DOM (local execution)
    - [ ] tab_action on active tab → executes (local execution)
    - [ ] web_search → works
    - [ ] web_extract → works
    - [ ] Documents upload/list → works
    - [ ] Tab visible in webapp Tab Manager
  - [ ] Webapp with chrome tab
    - [ ] From webapp, tab_read on a chrome-registered tab → result returned via bridge
    - [ ] Multi-tab: bookmarklet + chrome tab both visible, AI can target by tab_id
  - [ ] Menu "+" (both contexts)
    - [ ] Floating: menu does not exceed widget height
    - [ ] Panel: menu does not exceed sub-header
    - [ ] No scroll on menu container (sections scroll individually)
  - [ ] Non-regression
    - [ ] Standard chat (no tab connected): no tab_read/tab_action in tool list
    - [ ] Chat with documents, comments, web_search, web_extract: all work as on main

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Consolidate into `spec/SPEC_EVOL_CHROME_UPSTREAM.md`.
  - [ ] Update `PLAN.md` status.

- [ ] **Lot N — Final validation**
  - [ ] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make test-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make build-api build-ui-image API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=e2e-feat-chrome-upstream-v1-rewrite`
  - [ ] `make clean test-e2e API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=e2e-feat-chrome-upstream-v1-rewrite`

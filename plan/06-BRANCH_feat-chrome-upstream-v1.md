# Feature: BR-06 — Chrome Upstream v1 (bookmarklet + extension)

## Objective
Deliver upstream remote control for browser tabs via bookmarklet and chrome extension. Shared injected script for DOM operations, adaptive communication channel (iframe bridge or JSONP/img fallback depending on site CSP).

## Scope / Guardrails
- Make-only workflow, no direct Docker commands.
- Branch development in `tmp/feat-chrome-upstream-v1-rewrite`.
- `ENV=feat-chrome-upstream-v1-rewrite` `API_PORT=8706` `UI_PORT=5106` `MAILDEV_UI_PORT=1006`.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths**: `api/**`, `ui/**`, `e2e/**`, `chrome-extension/**`, `plan/06-BRANCH_feat-chrome-upstream-v1.md`, `spec/SPEC_EVOL_CHROME_UPSTREAM.md`
- **Forbidden Paths**: `Makefile`, `docker-compose*.yml`, `.cursor/rules/**`
- **Conditional Paths**: `api/drizzle/*.sql` (max 1), `.github/workflows/**`

## Feedback Loop

## Plan / Todo (lot-based)

- [x] **Lot 0 — Baseline**
  - [x] Spec rewrite, worktree setup, scope validation.

- [x] **Lot 1 — API: tab registry + chat-service tool injection + nonce**
  - [x] In-memory Tab Registry service (register, keepalive, delete, evict).
  - [x] Tab registration endpoints (session auth).
  - [x] Bookmarklet nonce endpoint.
  - [x] Chat-service: inject tab_read/tab_action tools when tabs registered (webapp context).
  - [x] Lot gate: typecheck, lint, tests pass.

- [x] **Lot 2 — UI: bridge iframe + injected script + bookmarklet copy**
  - [x] `/bookmarklet-bridge` Svelte route (postMessage relay, SSE stream listen, tab registration, keepalive).
  - [x] Shared injected script (tab_read, tab_action, badge, re-entrant guard).
  - [x] MenuPopover strategy=fixed.
  - [x] ChatPanel "Copy bookmarklet" button.
  - [x] Lot gate: typecheck, lint, tests pass.

- [x] **Lot 3 — Chrome extension simplification**
  - [x] Remove tool execution logic, SSE/API proxies from background.ts.
  - [x] Inject shared script via chrome.scripting.executeScript.
  - [x] Replace sidepanel.html with webapp iframe.
  - [x] Delete dead modules (tool-executor, tool-permissions, sidepanel.ts).
  - [x] Lot gate: typecheck, lint, tests pass.

- [x] **Lot 4 — API: bookmarklet public endpoints + PUBLIC_ROUTES fix**
  - [x] `GET /bookmarklet/nonce/validate` (session auth).
  - [x] `GET /bookmarklet/injected-script.js` (public, CORP cross-origin).
  - [x] `GET /bookmarklet/probe.js` (public, CORP cross-origin).
  - [x] CORP override middleware in app.ts before secureHeaders.
  - [x] Public routes mounted before requireAuth in index.ts.
  - [x] `/bookmarklet-bridge` and `/bookmarklet-bridge-probe` added to PUBLIC_ROUTES in +layout.svelte.
  - [x] Lot gate: typecheck, lint, nonce tests (13), script endpoint tests (14).

- [ ] **Lot 5 — Adaptive bootstrap with TT bypass + verified probes**
  - [ ] Extract bootstrap from ChatPanel → `bookmarklet-bootstrap.ts`.
  - [ ] TrustedTypes bypass: try `topai`, then hardcoded common names (`dompurify`, `domPurifyHTML`, `emptyStringPolicyHTML`, `sanitizer`, `safehtml`, `lit-html`, `highcharts`, `goog#html`, `jSecure`, `default`).
  - [ ] Inline script probe (with TT policy if available).
  - [ ] Iframe probe via postMessage handshake to `/bookmarklet-bridge-probe` (3s timeout).
  - [ ] Strategy selection: iframe+inline, iframe+external, or badge "Installez l'extension Chrome".
  - [ ] Injected script dual mode: detect context (extension vs iframe bridge) and route communication accordingly.
  - [ ] Delete all popup/window.open references. Delete old S1/S2/S3 naming.
  - [ ] Lot gate: typecheck, lint, unit tests for bootstrap probe logic + TT bypass.

- [ ] **Lot 6 — JSONP polling + img.src channel (for sites without iframe)**
  - [ ] `GET /bookmarklet/poll?tab_id=X` endpoint: returns pending commands as executable JS (`window.__TOPAI_CMD({...})`). Auth via tab_id token.
  - [ ] `GET /bookmarklet/result?data=X` endpoint: receives results from img.src. Auth via tab_id token.
  - [ ] Tab registration token: short-lived token generated at registration, passed in JSONP/img URLs.
  - [ ] Injected script: JSONP polling mode (fallback when iframe blocked, inline works).
  - [ ] Lot gate: typecheck, lint, API tests for poll/result endpoints.
  - [ ] **PROOF REQUIRED**: Playwright test via CDP — inject bookmarklet on a test site, verify JSONP poll + img.src result round-trip.

- [ ] **Lot 7 — Proof of end-to-end on all 4 sites**
  - [ ] Playwright test via CDP on Gmail, Outlook, matchid.io, LinkedIn.
  - [ ] Per site: inject bookmarklet → badge appears → tab registered in webapp → tab_read returns DOM content.
  - [ ] Screenshots saved as evidence in `e2e/test-results/`.
  - [ ] Results logged in BRANCH.md with pass/fail per site + screenshot paths.
  - [ ] Sites that fail in DEV (localhost) documented with reason.

- [ ] **Lot N-2 — UAT (testable in DEV)**
  - [ ] Outlook: paste bookmarklet → badge "Top AI ✓" → tab_read from webapp chat → DOM content returned
  - [ ] Gmail: paste bookmarklet → badge appears → inline script executes
  - [ ] matchid.io: paste bookmarklet → badge appears → inline script executes
  - [ ] Menu "+" → "Copy bookmarklet" → copied to clipboard
  - [ ] Chat without bookmarklet: no tab_read/tab_action in tool list
  - [ ] Non-reg: chat documents/comments/web_search → fonctionne

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Update spec with final verified matrix.
  - [ ] Update PLAN.md status.

- [ ] **Lot N — Final validation**
  - [ ] `make typecheck-api typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make lint-api lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make test-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [ ] `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test`
  - [ ] `make build-api build-ui-image API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=e2e-feat-chrome-upstream-v1-rewrite`
  - [ ] `make clean test-e2e API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=e2e-feat-chrome-upstream-v1-rewrite`
  - [ ] PR from BRANCH.md → UAT + CI OK → remove BRANCH.md → push → merge.

## Deferred

- JSONP viability in PROD (script-src on Gmail/LinkedIn for sent-tech.ca domain) — to verify at deployment.
- LinkedIn bookmarklet (no inline script, no iframe — extension Chrome only unless PROD script-src allows).

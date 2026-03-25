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

- [x] **Lot 5 — Adaptive bootstrap with TT bypass + verified probes**
  - [x] Extract bootstrap from ChatPanel → `bookmarklet-bootstrap.ts`.
  - [x] TrustedTypes bypass: try `topai`, then hardcoded common names (`dompurify`, `domPurifyHTML`, `emptyStringPolicyHTML`, `sanitizer`, `safehtml`, `lit-html`, `highcharts`, `goog#html`, `jSecure`, `default`).
  - [x] Inline script probe (with TT policy if available).
  - [x] Iframe probe via postMessage handshake to `/bookmarklet-bridge-probe` (3s timeout).
  - [x] Strategy selection: iframe+inline, iframe+external, jsonp, or badge "Installez l'extension Chrome".
  - [x] Injected script dual mode: detect context (extension vs iframe bridge vs JSONP) and route communication accordingly.
  - [x] No popup/window.open references in bootstrap or injected script. No S1/S2/S3 naming.
  - [x] Lot gate: typecheck OK, 49 upstream tests pass (22 bootstrap + 16 injected-script + 11 bridge).

- [x] **Lot 6 — JSONP polling + img.src channel (for sites without iframe)**
  - [x] `GET /bookmarklet/register?url=X&callback=Y` endpoint: JSONP tab registration, returns token.
  - [x] `GET /bookmarklet/poll?tab_id=X&token=Y` endpoint: returns pending commands as `window.__TOPAI_CMD({...})` or `//noop`.
  - [x] `GET /bookmarklet/result?token=Y&data=JSON` endpoint: receives results via img.src, returns 1x1 GIF.
  - [x] `POST /bookmarklet/result?token=Y` endpoint: receives results via POST body (larger payloads).
  - [x] Tab registration token: short-lived (5min), auth for poll/result requests.
  - [x] Injected script: JSONP polling mode with `__TOPAI_CMD` callback and img.src result sending.
  - [x] Lot gate: typecheck OK, 44 bookmarklet API tests pass (13 nonce + 14 script + 17 JSONP).

- [x] **Lot 7 — Proof of end-to-end on all 4 sites**
  - [x] Playwright test via CDP on Gmail, Outlook, matchid.io, LinkedIn.
  - [x] Per site: inject bookmarklet bootstrap, check strategy + badge + TT bypass.
  - [x] Screenshots saved in `e2e/test-results/proof-*.png`.
  - [x] Results:
    - **Outlook**: PASS - strategy=iframe+external, inline=false, iframe=true, TT=found. Badge loads via external script.
    - **Gmail**: PASS - strategy=jsonp, inline=true, iframe=false, TT=found. Badge "Connecting..." (JSONP mode, needs API registration in PROD).
    - **matchid.io**: PASS - strategy=jsonp, inline=true, iframe=false, TT=found. Badge "Connecting..." (JSONP mode).
    - **LinkedIn**: EXPECTED FAIL - strategy=blocked, inline=false, iframe=false, TT=found. Badge "Installez l'extension Chrome pour ce site". Both inline script and iframe are blocked by LinkedIn CSP.
  - [x] Documented: LinkedIn requires Chrome extension in DEV (strict CSP blocks both inline and iframe from localhost).

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

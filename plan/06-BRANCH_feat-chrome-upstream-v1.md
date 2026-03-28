# Feature: BR-06 — Chrome Upstream v1

## Objective
Deliver upstream remote control for browser tabs via Chrome extension. Shared injected script for DOM operations, communication via postMessage with bridge iframe on webapp origin.

## Scope / Guardrails
- Make-only workflow, no direct Docker commands.
- Branch development in `tmp/feat-chrome-upstream-v1-rewrite`.
- `ENV=feat-chrome-upstream-v1-rewrite` `API_PORT=8706` `UI_PORT=5106` `MAILDEV_UI_PORT=1006`.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths**: `api/**`, `ui/**`, `e2e/**`, `chrome-extension/**`, `plan/06-BRANCH_feat-chrome-upstream-v1.md`, `spec/SPEC_EVOL_CHROME_UPSTREAM.md`
- **Forbidden Paths**: `Makefile`, `docker-compose*.yml`, `.cursor/rules/**`
- **Conditional Paths**: `api/drizzle/*.sql` (max 1), `.github/workflows/**`

## Feedback Loop

## AI Flaky tests
- Acceptance rule: non-systematic provider/network nondeterminism only. Record command + file + signature.

## Orchestration Mode
- [x] **Mono-branch + cherry-pick**

## Plan / Todo (lot-based)

- [x] **Lot 1 — API: tab registry + chat-service tool injection**
  - [x] In-memory Tab Registry service (register, keepalive, delete, evict).
  - [x] Tab registration endpoints (session auth).
  - [x] Chat-service: inject tab_read/tab_action tools when tabs registered (webapp context).
  - [x] Lot gate: typecheck, lint, tests pass.

- [x] **Lot 2 — UI: injected script + MenuPopover**
  - [x] Shared injected script (tab_read, tab_action, badge, re-entrant guard, postMessage).
  - [x] MenuPopover strategy=fixed.
  - [x] Lot gate: typecheck, lint, tests pass.

- [x] **Lot 3 — Chrome extension simplification**
  - [x] Remove tool execution logic, SSE/API proxies from background.ts.
  - [x] Inject shared script via chrome.scripting.executeScript.
  - [x] Replace sidepanel.html with webapp iframe.
  - [x] Delete dead modules (tool-executor, tool-permissions, sidepanel.ts).
  - [x] Lot gate: typecheck, lint, tests pass.

- [ ] **Lot 4 — Cleanup**
  - [x] Remove all bookmarklet code (bootstrap, bridge routes, probe, API endpoints, JSONP, nonce, CORP middleware, Copy bookmarklet button, PUBLIC_ROUTES entries).
  - [x] Remove all bookmarklet tests.
  - [x] Remove JSONP mode from injected-script.ts.
  - [x] Update spec.
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] **API tests**
      - [ ] `api/tests/unit/tab-registry.test.ts` (non-reg)
      - [ ] `api/tests/unit/chat-service-tab-tools.test.ts` (non-reg)
      - [ ] Sub-lot gate: `make test-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] **UI tests**
      - [ ] `ui/tests/upstream/injected-script.test.ts` (non-reg)
      - [ ] Sub-lot gate: `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test`

- [ ] **Lot N-2 — UAT**
  - [ ] Chrome extension
    - [ ] Install extension, open side panel → webapp loads
    - [ ] Navigate to a site → script injected, badge "Top AI ✓"
    - [ ] tab_read from webapp chat → DOM content returned
    - [ ] tab_action click from webapp chat → action executed
    - [ ] Navigate to another page → re-inject, badge reconnects
    - [ ] Tab visible in webapp tab list
  - [ ] Web app — non-reg
    - [ ] Chat without extension: no tab_read/tab_action in tool list
    - [ ] Chat: documents/comments/web_search fonctionnel
    - [ ] Menu "+" → sections scroll, no overflow

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Update spec.
  - [ ] Update PLAN.md.

- [ ] **Lot N — Final validation**
  - [ ] typecheck + lint + test-api + test-ui
  - [ ] PR → UAT + CI OK → merge.

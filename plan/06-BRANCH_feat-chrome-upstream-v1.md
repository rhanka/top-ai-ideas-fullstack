# Feature: BR-06 — Chrome Upstream v1

## Objective
Upstream remote control: the webapp can dispatch tab_read/tab_action to connected Chrome tabs via the extension.

## Scope / Guardrails
- Make-only workflow, no direct Docker commands.
- Branch development in `tmp/feat-chrome-upstream-v1-rewrite`.
- `ENV=feat-chrome-upstream-v1-rewrite` `API_PORT=8706` `UI_PORT=5106` `MAILDEV_UI_PORT=1006`.
- Chrome extension architecture unchanged from main (sidepanel, SSE proxy, tool execution).

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths**: `api/**`, `ui/**`, `e2e/**`, `plan/06-BRANCH_feat-chrome-upstream-v1.md`, `spec/SPEC_EVOL_CHROME_UPSTREAM.md`
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

- [x] **Lot 2 — Extension: tab register + keepalive + MenuPopover**
  - [x] Add register/keepalive/unregister calls in background.ts (no other changes to extension).
  - [x] Register active tab on `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`.
  - [x] Unregister on `chrome.tabs.onRemoved`.
  - [x] Keepalive interval 15s.
  - [x] MenuPopover strategy=fixed.
  - [x] Restore extension code from main (revert Lot 3 refactoring that broke floating mode).
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] **API tests**
      - [ ] `api/tests/unit/tab-registry.test.ts` (non-reg)
      - [ ] `api/tests/unit/chat-service-tab-tools.test.ts` (non-reg)
      - [ ] Sub-lot gate: `make test-api-smoke test-api-endpoints API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [ ] **UI tests**
      - [ ] `ui/tests/upstream/injected-script.test.ts` (non-reg)
      - [ ] Sub-lot gate: `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test`

- [ ] **Lot N-2 — UAT**
  - [ ] Chrome extension
    - [ ] Install updated extension → side panel fonctionne comme avant (non-reg)
    - [ ] Floating mode fonctionne (LinkedIn, Outlook, etc.)
    - [ ] Navigate to a site → tab registered via API
    - [ ] Webapp chat (sans sidepanel) → tab_read/tab_action apparaissent
    - [ ] tab_read depuis webapp → DOM content returned
    - [ ] tab_action click depuis webapp → action exécutée
    - [ ] Extension sidepanel → local tools fonctionnent comme sur main (non-reg)
  - [ ] Web app — non-reg
    - [ ] Chat sans extension: no tab_read/tab_action
    - [ ] Chat: documents/comments/web_search fonctionnel
    - [ ] Menu "+" → sections scroll, no overflow

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Update spec.
  - [ ] Update PLAN.md.

- [ ] **Lot N — Final validation**
  - [ ] typecheck + lint + test-api + test-ui
  - [ ] PR → UAT + CI OK → merge.

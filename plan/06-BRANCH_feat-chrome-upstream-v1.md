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
- [x] **BR06-EX1 — Align extension build targets with CI**
  - [x] Reason: local `build-ext-chrome` / `build-ext-vscode` mutated `ui/package-lock.json`, while CI validated extension compilation only indirectly through `make build-ui-image`.
  - [x] Impact: allow scoped updates in `Makefile` and `.github/workflows/ci.yml` so extension build targets are lockfile-safe and are executed directly in CI.
  - [x] Rollback: revert the `Makefile` and workflow changes to return to indirect-only validation via `make build-ui-image`.
- [x] **BR06-EX2 — Stabilize CI API/E2E red lanes**
  - [x] Reason: the rebased branch still failed on the real CI paths for `test-api-endpoints`, `test-api-ai`, `test-e2e (group-c)` and `test-e2e (group-d)`; the AI matrix also had a GitHub Actions quoting bug where `$$SPECS` expanded to the bash PID instead of the spec list.
  - [x] Impact: allow scoped updates in `Makefile` and `.github/workflows/ci.yml` to replay CI via make targets, plus targeted fixes in API streaming/tests and E2E selectors/timeouts.
  - [x] Rollback: revert the scoped CI stabilization changes in `Makefile`, workflow, API streaming/tests and E2E specs.

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
  - [x] Align extension operator targets and CI path on `make build-ext-chrome` / `make build-ext-vscode`
  - [x] `make build-ext-chrome API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [x] `make build-ext-vscode API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [x] Stabilize CI red lanes for API/E2E after rebase
  - [x] `make test-api-endpoints API_TEST_WORKERS=1 API_TEST_ARGS="--shard=3/4" API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [x] `make test-api-ai SCOPE="tests/ai/chat-sync.test.ts tests/ai/executive-summary-auto.test.ts tests/ai/comment-assistant.test.ts" API_TEST_WORKERS=1 API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
  - [x] `make test-e2e E2E_GROUPS="03" WORKERS=1 RETRIES=0 MAX_FAILURES=1 API_PORT=8786 UI_PORT=5186 MAILDEV_UI_PORT=1086 ENV=e2e`
  - [x] `make test-e2e E2E_GROUPS="08" WORKERS=1 RETRIES=0 MAX_FAILURES=1 API_PORT=8786 UI_PORT=5186 MAILDEV_UI_PORT=1086 ENV=e2e`
  - [ ] typecheck + lint + test-api + test-ui
  - [ ] PR → UAT + CI OK → merge.

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
- [x] **BR06-FL-01 — API endpoints gate flaky accepted for Lot 2**
  - [x] `make test-api-endpoints API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite` reduced from auth-wide `429` failures to one residual flaky on `tests/api/chat-tools.test.ts`.
  - [x] Failure signature: missing `tool_call_result` in `comment_assistant suggest`, with queue logs `Session not found` during the full parallel endpoints run.
  - [x] Scoped rerun passed: `make test-api-endpoints SCOPE=tests/api/chat-tools.test.ts API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`.
  - [x] User accepted this residual flaky for Lot 2 validation on 2026-04-07.
- [x] **BR06-EX1 — Align extension build targets with CI**
  - [x] Reason: local `build-ext-chrome` / `build-ext-vscode` mutated `ui/package-lock.json`, while CI validated extension compilation only indirectly through `make build-ui-image`.
  - [x] Impact: allow scoped updates in `Makefile` and `.github/workflows/ci.yml` so extension build targets are lockfile-safe and are executed directly in CI.
  - [x] Rollback: revert the `Makefile` and workflow changes to return to indirect-only validation via `make build-ui-image`.
- [x] **BR06-EX2 — Stabilize CI API/E2E red lanes**
  - [x] Reason: the rebased branch still failed on the real CI paths for `test-api-endpoints`, `test-api-ai`, `test-e2e (group-c)` and `test-e2e (group-d)`; the AI matrix also had a GitHub Actions quoting bug where `$$SPECS` expanded to the bash PID instead of the spec list.
  - [x] Impact: allow scoped updates in `Makefile` and `.github/workflows/ci.yml` to replay CI via make targets, plus targeted fixes in API streaming/tests and E2E selectors/timeouts.
  - [x] Rollback: revert the scoped CI stabilization changes in `Makefile`, workflow, API streaming/tests and E2E specs.
- [x] **BR06-FL-03 — First extension login must gate chat on settings**
  - [x] Repro: first extension login left the chat tab mounted before extension auth status resolved, so the widget surfaced `Error while loading messages` and no model list instead of guiding the user to configuration.
  - [x] Fix: gate `ChatPanel` behind extension auth readiness/connection, show a transient loading state while auth status is loading, and auto-open extension settings when the runtime reports a disconnected session.
  - [x] Validation: `make test-ui SCOPE=tests/utils/extension-auth-ui.test.ts API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`, `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`, `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`.
- [x] **BR06-FL-04 — Connected extension must expose the current browser tab upstream**
  - [x] Repro: after a successful extension connect, the webapp still had no registered tabs unless the user manually changed tabs or navigated; the upstream registration block also called `getValidAccessToken()` without passing runtime config.
  - [x] Fix: pass runtime config into the tab register/keepalive/unregister auth calls, register the current active tab immediately after a successful extension connect, and bootstrap the active-tab registration when the extension worker starts.
  - [x] Validation: `make build-ext-chrome API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`, `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`, `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`.

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
  - [x] Lot gate:
    - [x] `make typecheck-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make typecheck-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-api API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] `make lint-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite`
    - [x] **API tests**
      - [x] `api/tests/unit/tab-registry.test.ts` (non-reg)
      - [x] `api/tests/unit/chat-service-tab-tools.test.ts` (non-reg)
      - [x] Sub-lot gate: `make test-api-smoke test-api-endpoints API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test-feat-chrome-upstream-v1-rewrite` (accepted with `BR06-FL-01`)
    - [x] **UI tests**
      - [x] `ui/tests/upstream/injected-script.test.ts` (non-reg)
      - [x] Sub-lot gate: `make test-ui API_PORT=8706 UI_PORT=5106 MAILDEV_UI_PORT=1006 ENV=test`

- [x] **Lot N-2 — UAT**
  - [x] Chrome extension
    - [x] Install updated extension → side panel fonctionne comme avant (non-reg)
    - [x] Floating mode fonctionne (LinkedIn, Outlook, etc.)
    - [x] Navigate to a site → tab registered via API
    - [x] Webapp chat (sans sidepanel) → tab_read/tab_action apparaissent
    - [x] tab_read depuis webapp → DOM content returned
    - [x] tab_action click depuis webapp → action exécutée
    - [x] Extension sidepanel → local tools fonctionnent comme sur main (non-reg)
  - [x] Web app — non-reg
    - [x] Chat sans extension: no tab_read/tab_action
    - [x] Chat: documents/comments/web_search fonctionnel
    - [x] Menu "+" → sections scroll, no overflow

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Update spec.
  - [ ] Update PLAN.md.

- [ ] **Lot N — Final validation**
  - [ ] typecheck + lint + test-api + test-ui
  - [ ] PR → UAT + CI OK → merge.

# Feature: BR13 Follow-up - Extension Profile Build Simplification

## Objective
Remove unnecessary extension profile build indirection added in BR13 while preserving required runtime behavior, and keep CI/build path aligned with existing variables.

## Scope / Guardrails
- Scope limited to `Makefile` build variable cleanup and branch execution tracking.
- Make-only workflow for validation commands.
- Minimal targeted validation: UI typecheck/lint plus one narrow UI test related to chrome-ext code paths.
- Root workspace `~/src/top-ai-ideas-fullstack` remains reserved for user dev/UAT.
- Work is implemented in isolated worktree `tmp/fix-br13-fix` on branch `fix/br-13-fix`.
- In every validation command, `ENV=<env>` is passed as the last argument.
- All new text in English.
- Branch environment mapping: `ENV=test-fix-br13-fix`.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `Makefile`
  - `BRANCH.md`
- **Forbidden Paths (must not change in this branch)**:
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `.github/workflows/**`
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/**`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - none
- **Exception process**:
  - If scope must expand, declare `BR13-EX*` in this file before editing and mirror it in `plan/CONDUCTOR_QUESTIONS.md`.

## Questions / Notes
- No open blocker. Intentional behavior: production image builds force extension profile to `prod` through target-scoped reuse of `VITE_EXTENSION_PROFILE`.
- Validation note: first run with default UI port failed (`Bind for 0.0.0.0:5173 failed: port is already allocated`), then gates were rerun with isolated ports (`API_PORT=8793 UI_PORT=5193 MAILDEV_UI_PORT=1093`).

## AI Flaky Allowlist (MANDATORY)
- Non-blocking API AI tests:
  - `make test-api-ai`
- Non-blocking E2E AI tests:
  - `e2e/tests/00-ai-generation.spec.ts`
  - `e2e/tests/03-chat.spec.ts`
  - `e2e/tests/03-chat-chrome-extension.spec.ts`
  - `e2e/tests/07_comment_assistant.spec.ts`
- Acceptance rule:
  - Out of scope for this fix branch (no AI test changes).

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick**
- [ ] **Multi-branch**
- Rationale: one focused fix with a single atomic commit.

## UAT Management (in orchestration context)
- [x] No dedicated UAT checkpoint required (no UI behavior change, no API contract change).

## Plan / Todo (lot-based)
- [x] **Lot 0 - Baseline & constraints**
  - [x] Confirm isolated worktree and branch.
  - [x] Identify BR13 follow-up regression scope.
  - [x] Confirm minimal path set and no exception required.

- [x] **Lot 1 - Remove unnecessary profile-build indirection**
  - [x] Remove `VITE_EXTENSION_PROFILE_BUILD` from `Makefile`.
  - [x] Reuse existing `VITE_EXTENSION_PROFILE` in `build-ui-image` with target-scoped `prod` value.
  - [x] Lot gate:
    - [x] `make typecheck-ui API_PORT=8793 UI_PORT=5193 MAILDEV_UI_PORT=1093 ENV=test-fix-br13-fix`
    - [x] `make lint-ui API_PORT=8793 UI_PORT=5193 MAILDEV_UI_PORT=1093 ENV=test-fix-br13-fix`
    - [x] `make test-ui SCOPE=tests/chrome-ext/tool-permissions.test.ts API_PORT=8793 UI_PORT=5193 MAILDEV_UI_PORT=1093 ENV=test-fix-br13-fix`

- [x] **Lot N - Final validation**
  - [x] Verify clean diff is limited to scope.
  - [x] Commit atomically.
  - [x] Push branch `fix/br-13-fix` to origin.

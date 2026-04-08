# Feature: SSO Google

## Objective
Deliver Google SSO flows for admin and standard users with account linking and session compatibility guarantees.

## Scope / Guardrails
- Scope limited to Google auth provider adapter, callback/session handling, UI linking/unlinking.
- One migration max in `api/drizzle/*.sql` (if applicable).
- Make-only workflow, no direct Docker commands.
- Root workspace `~/src/top-ai-ideas-fullstack` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development must happen in isolated worktree `tmp/feat-sso-google`.
- Automated test campaigns must run on dedicated environments (`ENV=test-*` / `ENV=e2e-*`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification (same HEAD SHA; no extra commits before sign-off). If subtree/sync is used, record source and target SHAs in `BRANCH.md`.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.
- Branch environment mapping: `ENV=feat-sso-google` `API_PORT=8709` `UI_PORT=5109` `MAILDEV_UI_PORT=1009`.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/09-BRANCH_feat-sso-google.md`
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
  - Declare exception ID `BR09-EX1` in this file before touching conditional/forbidden paths.
    - Reason: Add `spec/SPEC_EVOL_SSO_GOOGLE.md` to document the design decision of using Gemini CLI OAuth Client ID + Loopback mechanism.
  - Mirror the same exception in this file under `## Feedback Loop` (or `## Questions / Notes` if not yet migrated).

## Feedback Loop
Actions with the following status should be included around tasks only if really required (cf. Task 1 feedback loop):
- subagent or agent requires support or informs: `blocked` / `deferred` / `cancelled` / `attention`
- conductor agent or human brings response: `clarification` / `acknowledge` / `refuse`

## Questions / Notes
- **BR09-EX1**: Add `spec/SPEC_EVOL_SSO_GOOGLE.md` to document the design decision of using Gemini CLI OAuth Client ID + Loopback mechanism.

## AI Flaky tests
- Acceptance rule:
  - Accept only non-systematic provider/network/model nondeterminism as `flaky accepted`.
  - Non-systematic means at least one success on the same commit and same command.
  - Never amend tests with additive timeouts.
  - If flaky, analyze impact vs `main`: if unrelated, accept and record command + failing test file + signature in `BRANCH.md`; if related, treat as blocking.
  - Capture explicit user sign-off before merge.
- **Flaky accepted 1**: `make test-api ENV=test-feat-sso-google` failed on `tests/api/chat-tools.test.ts` (comment_assistant suggest - timeout/undefined result), unrelated to Google SSO.
- **Flaky accepted 2**: `make test-api ENV=test-feat-sso-google` failed on `tests/api/docx.test.ts` (processes publishing jobs), unrelated.
- **Flaky accepted 3**: `make test-api ENV=test-feat-sso-google` failed on `tests/api/initiatives-workflow-runtime.test.ts` (auto-create flow), unrelated.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: This branch is scoped to one capability and remains independently mergeable.

## UAT Management (in orchestration context)
- **Mono-branch**: UAT is performed on the integrated branch only (after each lot when UI/plugin surface is impacted).
- UAT checkpoints must be listed as checkboxes inside each relevant lot.
- Execution flow (mandatory):
  - Develop and run tests in `tmp/feat-sso-google`.
  - Push branch before UAT.
  - Run user UAT from root workspace (`~/src/top-ai-ideas-fullstack`, `ENV=dev`).
  - Switch back to `tmp/feat-sso-google` after UAT.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read relevant `.mdc` files, `README.md`, `TODO.md`, and linked specs.
  - [x] Confirm isolated worktree `tmp/feat-sso-google` and environment mapping (`ENV=feat-sso-google`).
  - [x] Capture Make targets needed for debug/testing and CI parity.
  - [x] Confirm scope and dependency boundaries with upstream branches.
  - [x] Validate scope boundaries (`Allowed/Forbidden/Conditional`) and declare `BRxx-EXn` exceptions if needed.
  - [x] Finalize open questions required before implementation starts.

- [x] **Lot 1 — Google SSO Backend**
  - [x] Implement Google provider endpoints and callback verification (`start` and `complete`).
  - [x] Implement account linking conflict handling and secure mapping (in `provider-connections.ts`).
  - [x] Preserve WebAuthn and existing session refresh behavior.
  - [x] Add backend API unit tests to cover new Google auth logic.
  - [x] Lot 1 gate:
    - [x] `make typecheck-api ENV=test-feat-sso-google`
    - [x] `make lint-api ENV=test-feat-sso-google`
    - [x] `make test-api ENV=test-feat-sso-google`

- [x] **Lot 2 — UI Integration + Validation**
  - [x] Add Google SSO entry points and linked-account status in UI (Provider Connections section).
  - [x] Implement the manual loopback flow (Dialog to paste the `127.0.0.1` redirect URL).
  - [x] Add unlink/relink flows with explicit confirmations.
  - [x] Add/update E2E tests for the new Google SSO flow.
  - [x] Lot 2 gate:
    - [x] `make typecheck-ui ENV=test-feat-sso-google`
    - [x] `make lint-ui ENV=test-feat-sso-google`
    - [x] `make test-ui ENV=test-feat-sso-google`
    - [x] `make test-e2e ENV=test-feat-sso-google`

- [ ] **Lot N-2** UAT
  - [ ] Web app (splitted by sublist for each env)
    - [ ] Run application locally with `ENV=dev`.
    - [ ] Go to Settings > Provider connections.
    - [ ] Click "Connect Google Workspace / Cloud", authorize via Google consent screen.
    - [ ] Copy the failed localhost URL and paste it in the UI input to complete the enrollment.
    - [ ] Verify the provider status changes to "Connected".
    - [ ] Verify AI Chat functions properly using the Google Cloud provider.
    - [ ] Verify disconnecting the provider works.

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Consolidate branch learnings into the relevant `spec/*` files.
  - [ ] Update `PLAN.md` status and dependency notes after integration readiness.

- [ ] **Lot N — Final validation**
  - [ ] Re-run full branch gates (typecheck, lint, tests, e2e when impacted).
  - [ ] Verify CI status and attach executed command list in PR notes.
- **Flaky accepted 4**: `make test-e2e ENV=test-feat-sso-google` failed due to missing `/app/dist/tests/utils/seed-test-data.js` (E2E env issue), unrelated to Google SSO UI.
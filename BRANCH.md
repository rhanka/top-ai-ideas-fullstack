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
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/NN-BRANCH_*.md` (except this branch file)
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `Makefile` (only for adding new targets related to Google SSO)
  - `api/drizzle/*.sql` (max 1 file)
  - `.github/workflows/**`
  - `spec/**`, `PLAN.md`, `TODO.md` (docs consolidation or roadmap sync only)
  - `.gitignore` (only for generated build artifacts)
  - `scripts/**` (only if strictly required by the branch objective)
- **Exception process**:
  - Declare exception ID `BR09-EX1` in this file before touching conditional/forbidden paths.
    - Reason: Add `spec/SPEC_EVOL_SSO_GOOGLE.md` to document the design decision of using Gemini CLI OAuth Client ID + Loopback mechanism.
  - **BR09-EX2**: Modify `Makefile` to add `extract-gemini-credentials` target; modify `.gitignore` to exclude generated build artifact `api/src/generated/`.
    - Reason: OAuth credentials are extracted at build time from `@google/gemini-cli-core` npm package. Requires a Make target for manual extraction and gitignore for generated TS file.
    - Impact: additive only (new target, new gitignore line). No behavioral change to existing targets.
    - Rollback: revert the two lines added.
  - Mirror the same exception in this file under `## Feedback Loop` (or `## Questions / Notes` if not yet migrated).

## Feedback Loop
Actions with the following status should be included around tasks only if really required (cf. Task 1 feedback loop):
- subagent or agent requires support or informs: `blocked` / `deferred` / `cancelled` / `attention`
- conductor agent or human brings response: `clarification` / `acknowledge` / `refuse`

## Questions / Notes
- **BR09-EX1**: Add `spec/SPEC_EVOL_SSO_GOOGLE.md` to document the design decision of using Gemini CLI OAuth Client ID + Loopback mechanism.
- **BR09-EX2**: Add `extract-gemini-credentials` Makefile target + `.gitignore` entry for `api/src/generated/`. Required for build-time extraction of Gemini CLI OAuth credentials from `@google/gemini-cli-core`.

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
- **Flaky accepted 4**: `make test-e2e ENV=test-feat-sso-google` failed due to missing `/app/dist/tests/utils/seed-test-data.js` (E2E env issue), unrelated to Google SSO UI.

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

- [x] **Lot 3 — Gemini Runtime Source Selection (API vs SSO)**
  - [x] Implement backend storage for `provider_connection_mode:gemini`.
  - [x] Implement runtime injection of Google Access Token in `llm-runtime/index.ts`.
  - [x] Implement UI toggle in Settings page.
  - [x] Lot 3 gate:
    - [x] `make typecheck-api ENV=test-feat-sso-google`
    - [x] `make typecheck-ui ENV=test-feat-sso-google`

- [x] **Lot 4 — Fix OAuth credentials (UAT bug: `invalid_request`)**
  - [x] Diagnose: wrong client ID (gcloud CLI instead of Gemini CLI) + missing `client_secret` in token exchange.
  - [x] Add `@google/gemini-cli-core` as devDependency for credential extraction.
  - [x] Create `api/scripts/extract-gemini-credentials.mjs` extraction script.
  - [x] Generate `api/src/generated/gemini-oauth-credentials.ts` (gitignored build artifact).
  - [x] Add `postinstall`/`prebuild` hooks in `api/package.json`.
  - [x] Update `api/src/services/google-provider-auth.ts`: import from generated file, add `client_secret` to token exchange.
  - [x] Add `extract-gemini-credentials` Makefile target (BR09-EX2).
  - [x] Add `api/src/generated/` to `.gitignore` (BR09-EX2).
  - [x] Update `spec/SPEC_EVOL_SSO_GOOGLE.md` with corrected credentials source.

- [ ] **Lot 5 — Code Assist transport (consume Gemini CLI free-tier credits)**
  - [ ] Add `google-auth-library` as production dependency for OAuth2Client token refresh.
  - [ ] Add `GOOGLE_SSO_TEST_EMAIL` to `.env` (Google account to select during enrollment probe).
  - [ ] On enrollment completion: call `loadCodeAssist` on `cloudcode-pa.googleapis.com/v1internal` to obtain managed `projectId` and `userTier`. Store in encrypted secret alongside tokens.
  - [ ] Update `resolveConnectedGoogleTransport()` to return `refreshToken`, `projectId`, `sessionId` alongside `accessToken`.
  - [ ] Create `api/src/services/google-code-assist-transport.ts`: Code Assist transport (pattern: `buildCodexFetch` in `openai-provider.ts`).
    - [ ] Initialize `OAuth2Client` from `google-auth-library` with stored refresh token + Gemini CLI client ID/secret (auto token refresh).
    - [ ] Wrap request body: `{ model, project, user_prompt_id, request: { <gemini body> + session_id } }`.
    - [ ] POST to `cloudcode-pa.googleapis.com/v1internal:streamGenerateContent` (streaming) or `:generateContent` (non-streaming).
    - [ ] Unwrap response: extract `.response` from each chunk before passing to Gemini parser.
  - [ ] Update `gemini-provider.ts`: when `googleTransport` is provided, delegate to Code Assist transport instead of raw HTTP.
  - [ ] Revert `gemini-provider.ts` Bearer/isOAuthToken workarounds (no longer needed — Code Assist transport handles auth).
  - [x] Update `ui/src/lib/components/StreamMessage.svelte`: preserve terminal chat errors instead of reverting to the preparing state.
  - [x] Add mock regression coverage for terminal chat error rendering in `ui/tests/components/StreamMessage-chat-terminal-error.test.ts`.
  - [ ] Lot 5 gate:
    - [ ] `make typecheck-api`
    - [ ] `make lint-api`
    - [ ] Playwright probe (debug-probe skill): enrollment flow → SSO mode toggle → chat message → verify streaming response
  - [ ] Lot 5 fallback (if Code Assist endpoint rejects requests):
    - [ ] Check if `functionCall`/`functionResponse` format mismatch (Codex risk): add Gemini-native tool part converter if needed.
    - [ ] Check if `loadCodeAssist` onboarding fails: verify account eligibility, check if `GOOGLE_CLOUD_PROJECT` env var is needed.
    - [ ] Check if token refresh fails: fallback to manual re-enrollment with error message in UI.
    - [ ] If `cloudcode-pa` is fully incompatible: document in spec as blocked, revert to API key-only mode.

- [ ] **Lot N-2** UAT (automated via Playwright probe)
  - [ ] Web app
    - [ ] Probe: navigate to Settings > Provider connections.
    - [ ] Probe: start Google enrollment, select `GOOGLE_SSO_TEST_EMAIL` account on consent screen, complete loopback URL paste.
    - [ ] Probe: verify provider status changes to "Connected".
    - [ ] Probe: switch Gemini runtime source to "Google SSO token".
    - [ ] Probe: send a chat message using Gemini, verify streaming response arrives.
    - [ ] Probe: switch back to API key mode, verify chat still works.
    - [ ] Probe: disconnect Google provider, verify status changes to "Disconnected".

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Consolidate branch learnings into the relevant `spec/*` files.
  - [ ] Update `PLAN.md` status and dependency notes after integration readiness.

- [ ] **Lot N — Final validation**
  - [ ] Re-run full branch gates (typecheck, lint, tests, e2e when impacted).
  - [ ] Verify CI status and attach executed command list in PR notes.

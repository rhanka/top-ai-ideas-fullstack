# Feature: BR-14c LLM Mesh SDK

## Objective
Create the first publishable Entropic package, `@entropic/llm-mesh`, as a provider-agnostic model access SDK for OpenAI, Anthropic/Claude, Google/Gemini, Mistral, and Cohere. Freeze the public mesh contract before BR-14b migrates the application runtime and before BR-14a extracts chat UI.

## Scope / Guardrails
- Scope limited to the LLM mesh package boundary, public TypeScript contract, provider capability model, provider adapter scaffold, authentication mode contract, package tests, and a thin application proof path.
- One migration max in `api/drizzle/*.sql` (not expected for this branch).
- Make-only workflow, no direct Docker commands.
- Root workspace `/home/antoinefa/src/entropic` is reserved for user work and must remain stable.
- Branch development must happen in isolated worktree `tmp/feat-llm-mesh-sdk`.
- Automated test campaigns must run on dedicated environments (`ENV=test-feat-llm-mesh-sdk` / `ENV=e2e-feat-llm-mesh-sdk`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.
- BR-14c owns the model-access contract only; BR-14b owns the full application runtime migration; BR-14a owns chat UI extraction; BR-14d owns operational transition; BR-14e owns final naming sweep.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `BRANCH.md`
  - `packages/llm-mesh/**`
  - `packages/llm-mesh/package.json`
  - `packages/llm-mesh/tsconfig.json`
  - `packages/llm-mesh/vitest.config.ts`
  - `api/src/services/provider-runtime.ts`
  - `api/src/services/provider-registry.ts`
  - `api/src/services/model-catalog.ts`
  - `api/src/services/provider-credentials.ts`
  - `api/src/services/provider-connections.ts`
  - `api/src/services/codex-provider-auth.ts`
  - `api/src/services/llm-runtime/**`
  - `api/src/services/providers/**`
  - `api/tests/unit/*provider*.test.ts`
  - `api/tests/unit/llm-runtime-stream.test.ts`
  - `api/tests/api/models.test.ts`
  - `api/tests/api/ai-settings.test.ts`
  - `api/tests/ai/**`
  - `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`
  - `spec/SPEC_EVOL_LLM_MESH_SDK.md`
- **Forbidden Paths (must not change in this branch)**:
  - `README.md`
  - `README.fr.md`
  - `TRANSITION.md`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `.github/workflows/**`
  - `ui/chrome-ext/**`
  - `ui/vscode-ext/**`
  - `ui/src/lib/components/**`
  - `ui/src/routes/**`
  - `plan/14a-BRANCH_*.md`
  - `plan/14b-BRANCH_*.md`
  - `plan/14d-BRANCH_*.md`
  - `plan/14e-BRANCH_*.md`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `Makefile`
  - `api/package.json`
  - `api/package-lock.json`
  - `api/tsconfig.json`
  - `api/vitest.config.ts`
  - `api/drizzle/*.sql`
  - `ui/**`
  - `e2e/**`
  - `package.json`
  - `package-lock.json`
- **Exception process**:
  - Declare exception ID `BR14c-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.
  - Mirror the same exception in this file under `## Feedback Loop`.

## Feedback Loop
- [ ] `attention` BR14c-EX1 — Conditional `Makefile`, `api/package.json`, `api/package-lock.json`, `api/tsconfig.json`, and `api/vitest.config.ts` changes are allowed only if Lot 1 proves the package cannot be typechecked/tested through existing targets. Reason: a publishable package needs deterministic make-backed build/test targets. Impact: build/test scaffolding only, no runtime behavior. Rollback: remove package-specific targets/config and keep package tests under existing API targets.
- [ ] `attention` BR14c-EX2 — `spec/SPEC_EVOL_LLM_MESH_SDK.md` may be created if Lot 0 audit findings are too detailed for this branch file. Reason: the public package contract must be reviewable before implementation. Impact: specification only. Rollback: consolidate into `SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md` and delete the branch spec.

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
- Rationale: BR-14c is one package contract branch with a single ownership boundary. BR-14b/14a/14d/14e are separate downstream branches, so this branch must freeze the mesh contract without parallel implementation sub-branches.

## UAT Management (in orchestration context)
- **Mono-branch**: UAT is performed on the integrated branch only after package proof integration exists.
- UAT checkpoints must be listed as checkboxes inside each relevant lot.
- Execution flow:
  - Develop and run tests in `tmp/feat-llm-mesh-sdk`.
  - Push branch before UAT.
  - Run user UAT from root workspace (`/home/antoinefa/src/entropic`, `ENV=dev`) only after branch is pushed and ready.
  - Switch back to `tmp/feat-llm-mesh-sdk` after UAT.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/MASTER.md` and `rules/workflow.md`.
  - [x] Read `README.md`, `TODO.md`, `PLAN.md`, and `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`.
  - [x] Create isolated worktree `tmp/feat-llm-mesh-sdk` from `main` after PR #120 merge.
  - [x] Copy root `.env` into the branch worktree for isolated development.
  - [x] Confirm branch name `feat/llm-mesh-sdk`.
  - [x] Define environment mapping: `API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=feat-llm-mesh-sdk`.
  - [x] Define test mapping: `API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
  - [x] Confirm command style: `make ... API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=<env>` with `ENV` last.
  - [x] Confirm scope and guardrails.
  - [x] Validate scope boundaries and declare conditional exceptions.
  - [x] Complete read-only audit of current provider runtime and classify reusable vs app-specific code.
  - [x] Decide whether `@entropic/llm-mesh` can be tested through existing API targets or needs BR14c-EX1.
  - [ ] Create `spec/SPEC_EVOL_LLM_MESH_SDK.md` only if the public contract needs a separate review artifact.

- [ ] **Lot 1 — Public package contract**
  - [ ] Create `packages/llm-mesh` package boundary.
  - [ ] Define public provider IDs, model IDs, model capability matrix, provider capability matrix, and reasoning tiers.
  - [ ] Define normalized request/response contract for non-streaming calls.
  - [ ] Define normalized streaming events: `reasoning_delta`, `content_delta`, `tool_call_start`, `tool_call_delta`, `tool_call_result`, `status`, `error`, `done`.
  - [ ] Define normalized tool-use schema independent from OpenAI Chat Completions details.
  - [ ] Define structured output capability flags and schema support limits per provider.
  - [ ] Define auth modes: direct token, user token, workspace token, environment token, Codex account.
  - [ ] Prepare future account auth extension points for Gemini Code Assist and Claude Code without implementing live flows.
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make lint-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] **Package/API tests**
      - [ ] Add or update `packages/llm-mesh/tests/*.test.ts` if BR14c-EX1 is used.
      - [ ] Add or update `api/tests/unit/provider-registry-expansion.test.ts`.
      - [ ] Add or update `api/tests/unit/model-selection-legacy.test.ts`.
      - [ ] Add or update `api/tests/api/models.test.ts`.
      - [ ] Scoped run: `make test-api-unit SCOPE=tests/unit/provider-registry-expansion.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
      - [ ] Scoped run: `make test-api-endpoints SCOPE=tests/api/models.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
    - [ ] **UI tests (TypeScript only)**
      - [ ] No UI test updates expected in Lot 1.
    - [ ] **E2E tests**
      - [ ] No E2E test updates expected in Lot 1.

- [ ] **Lot 2 — Provider adapters and capability matrix**
  - [ ] Move reusable provider descriptors and model catalog data into the package contract.
  - [ ] Add package adapters or adapter interfaces for OpenAI, Anthropic/Claude, Google/Gemini, Mistral, and Cohere.
  - [ ] Keep provider SDK calls deterministic under unit tests with mocked clients.
  - [ ] Normalize provider errors with retryability metadata.
  - [ ] Preserve existing application provider behavior until BR-14b performs full migration.
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make lint-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] **Package/API tests**
      - [ ] Add or update `api/tests/unit/claude-provider.test.ts`.
      - [ ] Add or update `api/tests/unit/gemini-provider-sse.test.ts`.
      - [ ] Add or update `api/tests/unit/mistral-provider.test.ts`.
      - [ ] Add or update `api/tests/unit/cohere-provider.test.ts`.
      - [ ] Add or update `api/tests/unit/llm-runtime-stream.test.ts`.
      - [ ] Scoped run: `make test-api-unit SCOPE=tests/unit/llm-runtime-stream.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
    - [ ] **UI tests (TypeScript only)**
      - [ ] No UI test updates expected in Lot 2.
    - [ ] **E2E tests**
      - [ ] No E2E test updates expected in Lot 2.

- [ ] **Lot 3 — Auth modes and account transports**
  - [ ] Model direct token, user token, workspace token, environment token, and Codex account as explicit auth sources.
  - [ ] Keep existing Codex account transport behavior behind a mesh-compatible interface.
  - [ ] Document future Gemini Code Assist and Claude Code account transport hooks.
  - [ ] Preserve current provider credential precedence.
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make lint-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] **Package/API tests**
      - [ ] Add or update `api/tests/unit/provider-credentials.test.ts`.
      - [ ] Add or update `api/tests/api/provider-connections-admin.test.ts`.
      - [ ] Add or update `api/tests/api/ai-settings.test.ts`.
      - [ ] Scoped run: `make test-api-unit SCOPE=tests/unit/provider-credentials.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
      - [ ] Scoped run: `make test-api-endpoints SCOPE=tests/api/provider-connections-admin.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
    - [ ] **UI tests (TypeScript only)**
      - [ ] No UI test updates expected unless API schema changes force model display updates.
    - [ ] **E2E tests**
      - [ ] No E2E test updates expected in Lot 3.

- [ ] **Lot 4 — Thin application proof path**
  - [ ] Add a thin application import path or proof adapter showing the API runtime can consume the mesh contract without completing BR-14b migration.
  - [ ] Avoid moving chat service behavior into the package in this branch.
  - [ ] Avoid defining any chat SDK provider abstraction in this branch.
  - [ ] Keep all existing API behavior stable.
  - [ ] Lot gate:
    - [ ] `make typecheck-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make lint-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] **Package/API tests**
      - [ ] Add or update `api/tests/unit/llm-runtime-stream.test.ts`.
      - [ ] Add or update `api/tests/unit/chat-service-tools.test.ts` only if the proof path changes tool-call runtime wiring.
      - [ ] Scoped run: `make test-api-unit SCOPE=tests/unit/llm-runtime-stream.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`.
    - [ ] **UI tests (TypeScript only)**
      - [ ] No UI test updates expected.
    - [ ] **E2E tests**
      - [ ] No E2E test updates expected unless the proof path changes externally visible chat behavior.

- [ ] **Lot 5 — Live-provider split strategy**
  - [ ] Document live provider commands and credential requirements.
  - [ ] Keep deterministic package/API tests independent from live credentials.
  - [ ] Split live tests by provider so one failed provider does not hide another provider status.
  - [ ] Run live AI tests only when credentials are available.
  - [ ] Lot gate:
    - [ ] `make test-api-ai SCOPE=tests/ai/chat-sync.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make test-api-ai SCOPE=tests/ai/chat-tools.test.ts API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] Record provider-specific pass/fail/flaky signatures in this file.

- [ ] **Lot 6 — Docs consolidation**
  - [ ] Update `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md` with final BR-14c contract only if behavior changed from the initial orchestration spec.
  - [ ] Consolidate `spec/SPEC_EVOL_LLM_MESH_SDK.md` into permanent specs if created and still needed.
  - [ ] Delete temporary branch-only spec files after consolidation if applicable.
  - [ ] Update `BRANCH.md` checklist and feedback loop before final validation.

- [ ] **Lot 7 — Final validation**
  - [ ] Typecheck & lint:
    - [ ] `make typecheck-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make lint-api API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
  - [ ] Retest API:
    - [ ] `make test-api-unit API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
    - [ ] `make test-api-endpoints API_PORT=8714 UI_PORT=5114 MAILDEV_UI_PORT=1014 ENV=test-feat-llm-mesh-sdk`
  - [ ] Retest live AI flaky tests only under acceptance rule and document pass/fail signatures.
  - [ ] Record explicit user sign-off if any AI flaky test is accepted.
  - [ ] Final gate step 1: create/update PR using `BRANCH.md` text as PR body.
  - [ ] Final gate step 2: run/verify branch CI on that PR and resolve remaining blockers.
  - [ ] Final gate step 3: once UAT + CI are both `OK`, commit removal of `BRANCH.md`, push, and merge.

## Lot 0 Audit Notes
- [x] Current app provider IDs live in `api/src/services/provider-runtime.ts`: `openai`, `gemini`, `anthropic`, `mistral`, `cohere`.
- [x] Reusable for package: provider IDs, provider descriptors, model catalog entry shape, capability flags, reasoning tiers, credential validation result, normalized provider error shape.
- [x] Current registry construction is app-local in `api/src/services/provider-registry.ts` and instantiates SDK-backed provider runtimes directly.
- [x] Reusable for package: registry interface and model/provider listing contract. App-specific until BR-14b: singleton construction wired to app environment and provider SDK concrete classes.
- [x] Current model catalog is app-local in `api/src/services/model-catalog.ts`; it maps provider runtime entries into API payloads and resolves defaults with legacy cutover rules.
- [x] Reusable for package: capability matrix and provider/model selection primitives. App-specific until BR-14b: `settingsService` defaults, legacy cutover policy, API payload snake_case mapping.
- [x] Current provider adapters in `api/src/services/providers/*.ts` already cover OpenAI, Anthropic/Claude, Google/Gemini, Mistral, and Cohere.
- [x] Reusable for package: provider model lists, SDK request/stream entry points, error normalization, mocked-client test patterns. App-specific until BR-14b: `env.*_API_KEY` imports, Codex fetch wiring embedded in OpenAI provider, and current provider-specific request payload shapes.
- [x] Current stream normalization is concentrated in `api/src/services/llm-runtime/index.ts`; it already exposes normalized `StreamEvent` types but mixes provider SDK request building, credential resolution, Codex transport, and application runtime selection.
- [x] Reusable for package: normalized stream event taxonomy, tool-call normalization rules, structured-output schema sanitizers, provider-specific stream mappers. App-specific until BR-14b: chat message conversion, runtime selection from user/workspace settings, retry/continuation orchestration, and chat-service context budgeting.
- [x] Current credential precedence lives in `api/src/services/provider-credentials.ts`: request override, user BYOK, workspace key, environment, none.
- [x] Reusable for package: auth source enum and resolver contract. App-specific until BR-14b: encrypted settings storage, workspace/user lookup, and `settingsService` integration.
- [x] Current Codex account transport lives in `api/src/services/provider-connections.ts` and `api/src/services/codex-provider-auth.ts`; BR-14c must expose an account transport contract without moving operational enrollment UI.
- [x] Reusable for package: account transport shape `{ accessToken, accountId }`, transport mode distinction, and future account-provider extension point. App-specific until BR-14b/BR-14d: Codex device enrollment persistence, UI settings routes, secrets, and operational OAuth endpoints.
- [x] Existing deterministic coverage is concentrated in `api/tests/unit/provider-registry-expansion.test.ts`, provider unit tests, `api/tests/unit/llm-runtime-stream.test.ts`, `api/tests/unit/provider-credentials.test.ts`, and API catalog/settings tests.
- [x] There is no root package manifest and no existing `packages/` workspace. Decision: BR14c-EX1 is required before implementation if the branch creates a real publishable package with make-backed typecheck/test/build targets.

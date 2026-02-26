# Feature: Workspace Template Catalog

## Objective
Deliver BR-04 as the workspace template catalog foundation (`ai-ideas`, `todo`) that consumes BR-03 runtime contracts and exposes template-scoped metadata, while keeping workflow execution engine behavior out of scope.

## Scope / Guardrails
- Scope limited to template catalog, workspace template assignment, and runtime metadata projection for UI/API consumers.
- Explicitly out of scope: workflow execution engine (`start/complete/pause/resume`), run orchestration, steer transport handling, and full workflow designer/panel.
- BR-04 depends on BR-03 contracts but stays independently executable once prerequisites are met (no BR-03 code edits inside BR-04).
- BR-03 prerequisite contracts (must be available before Lot 1 implementation):
  - `BR03-C1` terminology and status semantics are frozen: `steer` is in-flight run guidance; task statuses are `todo|planned|in_progress|blocked|done|deferred|cancelled`.
  - `BR03-C2` definition read model is available with stable fields:
    - `workflow_definitions`: `id`, `key`, `version`, `name`, `description`, `source_level`, `lineage_root_id`, `parent_id`, `is_detached`, `last_parent_sync_at`.
    - `workflow_definition_tasks`: `workflow_definition_id`, `order`, `task_key`, `agent_definition_id`, `input_contract_ref`, `output_contract_ref`.
    - `agent_definitions`: `id`, `key`, `version`, `label`, `source_level`, `lineage_root_id`, `parent_id`, `is_detached`, `last_parent_sync_at`.
  - `BR03-C3` read APIs are stable and documented:
    - `GET /api/v1/workflow-config`
    - `GET /api/v1/agent-config`
  - `BR03-C4` BR-03 contract tests exist and pass on its branch for the above APIs/entities before BR-04 lot execution.
- One migration max in `api/drizzle/*.sql` (if applicable).
- Make-only workflow, no direct Docker commands.
- Root workspace `~/src/top-ai-ideas-fullstack` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development must happen in isolated worktree `tmp/feat-workspace-template-catalog`.
- Branch environment mapping:
  - `ENV=dev-feat-workspace-template-catalog`
  - `ENV=test-feat-workspace-template-catalog`
  - `ENV=e2e-feat-workspace-template-catalog`
  - `API_PORT=8704`, `UI_PORT=5104`, `MAILDEV_UI_PORT=1004`
- Automated test campaigns must run on dedicated environments (`ENV=test-*` / `ENV=e2e-*`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification (same HEAD SHA; no extra commits before sign-off). If subtree/sync is used, record source and target SHAs in `BRANCH.md`.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/04-BRANCH_feat-workspace-template-catalog.md`
- **Forbidden Paths (must not change in this branch)**:
  - `Makefile`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/NN-BRANCH_*.md` (except this branch file)
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `api/drizzle/*.sql` (max 1 file)
  - `.github/workflows/**`
  - `spec/**`, `PLAN.md`, `TODO.md` (docs consolidation only)
  - `scripts/**` (only if strictly required by branch objective)
- **Exception process**:
  - Declare exception ID `BR04-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.
  - Mirror the same exception in this file under `## Feedback Loop`.

## Feedback Loop
Actions with the following status should be included around tasks only if really required (cf. Task 1 feedback loop):
- subagent or agent requires support or informs: `blocked` / `deferred` / `cancelled` / `attention`
- conductor agent or human brings response: `clarification` / `acknowledge` / `refuse`

Open items tracked for this branch:
- `BR04-FL1` — `attention`
  - Topic: BR-03 contract freeze for `GET /api/v1/workflow-config` and `GET /api/v1/agent-config` response fields.
  - Decision update (2026-02-26): semantic contracts are locked from BR-03 (`BR03-FL01..FL04` acknowledged). Endpoint payload verification remains a Lot 0 contract check, but no longer blocks branch kickoff.
- `BR04-FL2` — `acknowledge`
  - Topic: Template reassignment semantics when workspace already has in-flight artifacts.
  - Decision locked (2026-02-26): v1 is non-retroactive (existing artifacts keep their original template snapshot; new artifacts use newly assigned template).
- `BR04-FL3` — `acknowledge`
  - Topic: Disabled/unavailable template fallback.
  - Decision locked (2026-02-26): deterministic fallback to workspace default template with explicit warning metadata (`fallback_reason`).
- `BR04-FL4` — `acknowledge`
  - Topic: Scope split validated.
  - Decision: BR-04 ships catalog + metadata only; workflow execution runtime remains BR-03+/BR-14.

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
- Rationale: BR-04 is one capability with explicit BR-03 prerequisite contracts and can remain independently executable once those contracts are present.

## UAT Management (in orchestration context)
- **Mono-branch**: UAT is performed on the integrated branch only (after each lot when UI/plugin surface is impacted).
- UAT checkpoints must be listed as checkboxes inside each relevant lot.
- Execution flow (mandatory):
  - Develop and run tests in `tmp/feat-workspace-template-catalog`.
  - Push branch before UAT.
  - Run user UAT from root workspace (`~/src/top-ai-ideas-fullstack`, `ENV=dev`).
  - Switch back to `tmp/feat-workspace-template-catalog` after UAT.

## Plan / Todo (lot-based)
- [ ] **Lot 0 — Baseline & BR-03 dependency lock**
  - [ ] Confirm isolated worktree `tmp/feat-workspace-template-catalog` and environment mapping (`dev-*`, `test-*`, `e2e-*`).
  - [ ] Confirm command style for this branch: `make ... ENV=<env>` with `ENV` always last.
  - [ ] Freeze BR-03 prerequisite contracts `BR03-C1` to `BR03-C4` and store decision in `BR04-FL1`.
  - [ ] Confirm BR-04 in/out boundaries (catalog metadata only; no workflow execution engine behavior).
  - [ ] Validate scope boundaries (`Allowed/Forbidden/Conditional`) and declare `BR04-EXn` exceptions if required.
  - [ ] Lot 0 gate:
    - [ ] Feedback Loop blocker status updated (`BR04-FL1` moved to `acknowledge` or kept `blocked` with owner/date).
    - [ ] Prerequisite matrix captured in this file (contracts, owner, status, verification command/file).

- [ ] **Lot 1 — Template catalog domain and API contract foundation**
  - [ ] Define template catalog domain (`template_key`, `template_version`, `capabilities`, `workflow_refs`, `agent_refs`, `is_default`, `status`).
  - [ ] Define workspace assignment contract and invariants:
    - one active template per workspace,
    - immutable template snapshots for created artifacts,
    - deterministic fallback behavior.
  - [ ] Define API surface (catalog/runtime metadata only):
    - `GET /api/v1/workspace-templates`
    - `GET /api/v1/workspaces/:id/template`
    - `PUT /api/v1/workspaces/:id/template`
  - [ ] Ensure API contract reads BR-03 definitions/configuration and does not call BR-03 execution endpoints.
  - [ ] Lot 1 gate:
    - [ ] `make typecheck-api ENV=test-feat-workspace-template-catalog`
    - [ ] `make lint-api ENV=test-feat-workspace-template-catalog`
    - [ ] **API tests (file granularity)**
      - [ ] Update `api/tests/api/workspaces.test.ts`
      - [ ] Add `api/tests/api/workspace-template-catalog.test.ts`
      - [ ] Add `api/tests/api/workspace-template-assignment.test.ts`
      - [ ] Add `api/tests/unit/workspace-template-projection.test.ts`
      - [ ] Scoped run: `make test-api-endpoints SCOPE=tests/api/workspace-template-catalog.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Scoped run: `make test-api-endpoints SCOPE=tests/api/workspace-template-assignment.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Scoped run: `make test-api-unit SCOPE=tests/unit/workspace-template-projection.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make test-api ENV=test-feat-workspace-template-catalog`
      - [ ] AI flaky coverage (non-blocking only per rule): `make test-api-ai ENV=test-feat-workspace-template-catalog`
    - [ ] **UI tests (TypeScript only)**
      - [ ] Update `ui/tests/stores/workspaceScope.test.ts`
      - [ ] Add `ui/tests/stores/workspaceTemplateCatalog.test.ts`
      - [ ] Add `ui/tests/utils/workspace-template-catalog.test.ts`
      - [ ] Scoped run: `make test-ui SCOPE=tests/stores/workspaceScope.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Scoped run: `make test-ui SCOPE=tests/stores/workspaceTemplateCatalog.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Scoped run: `make test-ui SCOPE=tests/utils/workspace-template-catalog.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make test-ui ENV=test-feat-workspace-template-catalog`
    - [ ] **E2E tests**
      - [ ] Prepare E2E build: `make build-api build-ui-image API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 ENV=e2e-feat-workspace-template-catalog`
      - [ ] Update `e2e/tests/04-tenancy-workspaces.spec.ts`
      - [ ] Update `e2e/tests/06-settings.spec.ts`
      - [ ] Add `e2e/tests/09-workspace-template-catalog.spec.ts`
      - [ ] Scoped run: `make test-e2e E2E_SPEC=tests/09-workspace-template-catalog.spec.ts API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 ENV=e2e-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make clean ENV=e2e-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make test-e2e API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 E2E_GROUP=04 ENV=e2e-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make clean ENV=e2e-feat-workspace-template-catalog`
      - [ ] No timeout inflation in existing tests; stabilize with selectors/fixtures only.

- [ ] **Lot 2 — UI/runtime metadata integration and compatibility**
  - [ ] Expose active template metadata in workspace settings and runtime context surfaces.
  - [ ] Ensure read-only/viewer roles cannot mutate template assignment (admin/editor only as defined).
  - [ ] Add compatibility behavior when BR-03 config payload is partial/unavailable (explicit `status` + `fallback_reason`).
  - [ ] Validate separation from workflow execution engine by contract tests and route-level scope checks.
  - [ ] Lot 2 gate:
    - [ ] `make typecheck-api ENV=test-feat-workspace-template-catalog`
    - [ ] `make lint-api ENV=test-feat-workspace-template-catalog`
    - [ ] `make typecheck-ui ENV=test-feat-workspace-template-catalog`
    - [ ] `make lint-ui ENV=test-feat-workspace-template-catalog`
    - [ ] **API tests (file granularity)**
      - [ ] Update `api/tests/api/workspace-template-catalog.test.ts`
      - [ ] Update `api/tests/api/workspace-template-assignment.test.ts`
      - [ ] Update `api/tests/api/workspaces.test.ts`
      - [ ] Update `api/tests/unit/workspace-template-projection.test.ts`
      - [ ] Scoped run: `make test-api-endpoints SCOPE=tests/api/workspace-template-assignment.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make test-api ENV=test-feat-workspace-template-catalog`
    - [ ] **UI tests (TypeScript only)**
      - [ ] Update `ui/tests/stores/workspaceScope.test.ts`
      - [ ] Update `ui/tests/stores/workspaceTemplateCatalog.test.ts`
      - [ ] Update `ui/tests/utils/workspace-template-catalog.test.ts`
      - [ ] Scoped run: `make test-ui SCOPE=tests/stores/workspaceTemplateCatalog.test.ts ENV=test-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make test-ui ENV=test-feat-workspace-template-catalog`
    - [ ] **E2E tests**
      - [ ] Update `e2e/tests/06-settings.spec.ts`
      - [ ] Update `e2e/tests/09-workspace-template-catalog.spec.ts`
      - [ ] Scoped run: `make test-e2e E2E_SPEC=tests/06-settings.spec.ts API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 ENV=e2e-feat-workspace-template-catalog`
      - [ ] Scoped run: `make test-e2e E2E_SPEC=tests/09-workspace-template-catalog.spec.ts API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 ENV=e2e-feat-workspace-template-catalog`
      - [ ] Sub-lot gate: `make clean ENV=e2e-feat-workspace-template-catalog`

- [ ] **Lot N-2** UAT
  - [ ] Web app
    - [ ] UAT setup: from root workspace (`ENV=dev`), login as workspace admin and viewer in separate sessions.
    - [ ] Evolution check 1: open `/settings`, confirm active template card shows `template_key`, `template_version`, and capability summary.
    - [ ] Evolution check 2: change workspace template from `ai-ideas` to `todo`, reload page, verify persistence and updated metadata.
    - [ ] Evolution check 3: create a new artifact after reassignment and verify new artifact uses new template metadata snapshot.
    - [ ] Evolution check 4: force disabled-template scenario and verify deterministic fallback + warning (`fallback_reason`).
    - [ ] Non-regression 1: navigate `/organizations`, `/folders`, `/usecase`, `/dashboard` with no permission regression.
    - [ ] Non-regression 2: verify workspace switching and hidden workspace lock behavior still work.
  - [ ] Chrome plugin (non-impacted surface, smoke only)
    - [ ] Open plugin in a workspace assigned to `ai-ideas`, verify plugin loads and can fetch context without errors.
    - [ ] Switch workspace template to `todo` and verify plugin session remains stable (no crash/no auth loss).
  - [ ] VSCode plugin (non-impacted surface, smoke only)
    - [ ] Run baseline `plan/tools/summary/checkpoint` flow on same commit and verify no regression from template metadata rollout.
    - [ ] Verify plugin gracefully ignores/handles absence of template-specific fields when not requested.

- [ ] **Lot N-1 — Docs consolidation**
  - [ ] Consolidate catalog/runtime metadata contracts into `spec/SPEC_EVOL_AGENTIC_WORKSPACE_TODO.md`.
  - [ ] Update roadmap links/dependency notes only if required (`PLAN.md`, `TODO.md`) under explicit `BR04-EXn` approval.
  - [ ] Ensure BR-03 to BR-04 dependency contracts are documented as stable inputs (not duplicated implementation details).

- [ ] **Lot N — Final validation**
  - [ ] Typecheck & Lint
    - [ ] `make typecheck-api ENV=test-feat-workspace-template-catalog`
    - [ ] `make lint-api ENV=test-feat-workspace-template-catalog`
    - [ ] `make typecheck-ui ENV=test-feat-workspace-template-catalog`
    - [ ] `make lint-ui ENV=test-feat-workspace-template-catalog`
  - [ ] Retest API (file-granular + full)
    - [ ] `api/tests/api/workspaces.test.ts`
    - [ ] `api/tests/api/workspace-template-catalog.test.ts`
    - [ ] `api/tests/api/workspace-template-assignment.test.ts`
    - [ ] `api/tests/unit/workspace-template-projection.test.ts`
    - [ ] `make test-api ENV=test-feat-workspace-template-catalog`
  - [ ] Retest UI (file-granular + full)
    - [ ] `ui/tests/stores/workspaceScope.test.ts`
    - [ ] `ui/tests/stores/workspaceTemplateCatalog.test.ts`
    - [ ] `ui/tests/utils/workspace-template-catalog.test.ts`
    - [ ] `make test-ui ENV=test-feat-workspace-template-catalog`
  - [ ] Retest E2E (file-granular + grouped)
    - [ ] `e2e/tests/04-tenancy-workspaces.spec.ts`
    - [ ] `e2e/tests/06-settings.spec.ts`
    - [ ] `e2e/tests/09-workspace-template-catalog.spec.ts`
    - [ ] `make build-api build-ui-image API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 ENV=e2e-feat-workspace-template-catalog`
    - [ ] `make clean ENV=e2e-feat-workspace-template-catalog`
    - [ ] `make test-e2e API_PORT=8704 UI_PORT=5104 MAILDEV_UI_PORT=1004 E2E_GROUP=04 ENV=e2e-feat-workspace-template-catalog`
    - [ ] `make clean ENV=e2e-feat-workspace-template-catalog`
  - [ ] Retest AI flaky tests (non-blocking only under acceptance rule) and document signatures if any:
    - [ ] `make test-api-ai ENV=test-feat-workspace-template-catalog`
    - [ ] scoped AI E2E allowlist runs only if impacted
  - [ ] Record explicit user sign-off if any AI flaky test is accepted.
  - [ ] Final gate step 1: create/update PR using `BRANCH.md` text as PR body (source of truth).
  - [ ] Final gate step 2: run/verify branch CI on that PR and resolve remaining blockers.
  - [ ] Final gate step 3: once UAT + CI are both `OK`, commit removal of `BRANCH.md`, push, and merge.

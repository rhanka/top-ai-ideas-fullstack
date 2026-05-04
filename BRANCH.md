# Feature: Production API CD runtime environment fix

## Objective
Restore production API container deployment by preserving all runtime secrets needed by the API and reconciling the existing Scaleway container runtime configuration during deploy updates.

## Scope / Guardrails
- Scope limited to API CD configuration, production deployment secret wiring, and deployment documentation.
- One migration max in `api/drizzle/*.sql` (not applicable).
- Make-only workflow, no direct Docker commands.
- Root workspace `/home/antoinefa/src/entropic` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development must happen in isolated worktree `tmp/fix-prod-api-cd-runtime-env`.
- Automated test campaigns must run on dedicated environments (`ENV=test-*` / `ENV=e2e-*`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification if user UAT is required.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `Makefile`
  - `.github/workflows/ci.yml`
  - `spec/SPEC_EVOL_GOOGLE_DRIVE_CONNECTOR.md`
  - `BRANCH.md`
- **Forbidden Paths (must not change in this branch)**:
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/NN-BRANCH_*.md`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `api/drizzle/*.sql`
  - `plan/done/**`
- **Exception process**:
  - `BR16b-FIX-EX1`: `Makefile` is allowed because the production container deploy target is the failing surface. Impact: CD runtime env reconciliation only. Rollback: revert Makefile changes.
  - `BR16b-FIX-EX2`: `.github/workflows/ci.yml` is allowed because deploy job env must pass the repository secrets into the Makefile target. Impact: deploy job only. Rollback: revert workflow env additions.

## Feedback Loop
- `attention`: Main run `25340126072` failed at `deploy-api`; retry resolved the AI flaky shard, then Scaleway container stayed `error`.
- `attention`: Scaleway Cockpit logs datasource has no Serverless Containers logs for this project retention window; diagnosis used container config, local production image startup, and non-mutating Node `pg` probe.

## AI Flaky tests
- Main run `25340126072` first failed in `tests/ai/chat-tools.test.ts` on `read_initiative tool > should call read_initiative and return initiative data in stream`; same commit passed on retry. Treated as unrelated flaky after same-run retry succeeded.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: hotfix is a narrow CD configuration correction with no code-path split.

## UAT Management (in orchestration context)
- No manual UI UAT required; acceptance is PR CI green plus main CD deploy green.
- Production deployment is validated through the GitHub Actions CD run after merge.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/MASTER.md`, `rules/workflow.md`, and GitHub CI skill.
  - [x] Create isolated worktree `tmp/fix-prod-api-cd-runtime-env`.
  - [x] Capture Makefile targets needed for debug/testing: `check-prod-*`, `deploy-api`, `pull-api-image`, `up-e2e`, `logs-api`.
  - [x] Define environment mapping: `ENV=test-prod-api-startup` for local production-image smoke only.
  - [x] Confirm command style: `make ... <vars> ENV=<env>` with `ENV` last.
  - [x] Confirm scope and guardrails.
  - [x] Declare `BR16b-FIX-EX1` and `BR16b-FIX-EX2`.

- [x] **Lot 1 — Production deploy runtime env**
  - [x] Rename deploy secret check to API runtime scope while preserving compatibility.
  - [x] Pass existing AI/search/admin runtime secrets to the Scaleway API container.
  - [x] Reconcile existing container runtime settings on every update: memory, CPU, port, protocol, timeout, scale, and redeploy.
  - [x] Keep Google Drive production secrets wired.
  - [ ] Lot gate:
    - [x] `make check-prod-api-secrets ENV=test-prod-api-cd-runtime-env`
    - [x] `make -n deploy-api-container ENV=test-prod-api-cd-runtime-env`
    - [x] Registry image startup smoke already verified on `ENV=test-prod-api-startup`.
    - [x] Non-mutating Node `pg` probe already verified `SELECT 1` against production DB with SSL and CA.
    - [x] `make deploy-api ENV=fix-prod-api-cd-runtime-env` returned Scaleway API container to `ready`.

- [x] **Lot N-1 — Docs consolidation**
  - [x] Update production CD secret/runtime contract in `spec/SPEC_EVOL_GOOGLE_DRIVE_CONNECTOR.md`.

- [ ] **Lot N — Final validation**
  - [x] `git diff --check`
  - [ ] Create/update PR using `BRANCH.md` text as PR body.
  - [ ] Verify branch CI.
  - [ ] If CI is green, archive `BRANCH.md` to `plan/done/`, push, merge.
  - [ ] Verify main CD deploy green.

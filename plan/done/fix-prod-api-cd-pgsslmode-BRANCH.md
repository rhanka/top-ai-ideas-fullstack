# Feature: Production API CD PG SSL Mode

## Objective
Fix the production API CD runtime so the Scaleway container starts with explicit PostgreSQL SSL mode alongside the deployed CA certificate.

## Scope / Guardrails
- Scope limited to production CD runtime environment wiring and its Google Drive connector runtime documentation.
- No application behavior change.
- No migration.
- Make-only workflow, no direct Docker/npm commands.
- Root workspace `/home/antoinefa/src/entropic` is reserved for user dev/UAT and must remain stable.
- Branch development happens in isolated worktree `tmp/fix-prod-api-cd-pgsslmode`.
- Automated validation uses `ENV=test-fix-prod-api-cd-pgsslmode`, never `ENV=dev`.
- In every `make` command, `ENV=<env>` is passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `BRANCH.md`
  - `spec/SPEC_EVOL_GOOGLE_DRIVE_CONNECTOR.md`
  - `plan/done/*prod-api-cd-pgsslmode*`
- **Forbidden Paths (must not change in this branch)**:
  - `api/**`
  - `ui/**`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/*-BRANCH_*.md` except the final archive of this branch plan
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `Makefile`
  - `.github/workflows/**`
- **Exception process**:
  - `FIX-PGSSL-EX1` covers the minimal CD/runtime edit in `Makefile` and `.github/workflows/ci.yml`.

## Feedback Loop
- [x] `FIX-PGSSL-EX1` — `acknowledge`: `Makefile` and `.github/workflows/ci.yml` are normally protected, but this fix is only the production CD contract for Scaleway runtime env. Impact: production API receives `PGSSLMODE=require` with the same secret-env update as `DATABASE_URL` and `DB_SSL_CA_PEM_B64`. Rollback: remove `PGSSLMODE` from the deploy env arrays and workflow env.

## AI Flaky tests
- Acceptance rule applies. No AI tests are expected for this CD-only change.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: one focused production CD correction with no application code change.

## UAT Management (in orchestration context)
- No user-facing UAT is required for this CD-only fix.
- Runtime validation is the main-branch CD result and Scaleway container readiness after merge.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/MASTER.md`, `rules/workflow.md`, and the branch template.
  - [x] Confirm isolated worktree `tmp/fix-prod-api-cd-pgsslmode`.
  - [x] Confirm branch starts from merged `main`.
  - [x] Identify the failing CD surface: `deploy-api` and Scaleway API container startup.
  - [x] Confirm command style: `make ... ENV=test-fix-prod-api-cd-pgsslmode`.
  - [x] Confirm scope boundaries and declare `FIX-PGSSL-EX1`.

- [x] **Lot 1 — Production API SSL runtime**
  - [x] Add `PGSSLMODE=require` as the default production API deploy mode.
  - [x] Include `PGSSLMODE` in the full Scaleway API secret environment update for container create and update.
  - [x] Add `PGSSLMODE=require` to the `deploy-api` GitHub Actions job env.
  - [x] Update the Google Drive connector spec runtime note with the complete production TLS contract.
  - [x] Lot gate:
    - [x] `make check-prod-google-drive-secrets ... ENV=test-fix-prod-api-cd-pgsslmode`
    - [x] `make -n deploy-api-container ... ENV=test-fix-prod-api-cd-pgsslmode`
    - [x] `git diff --check`

- [x] **Lot N-1 — Docs consolidation**
  - [x] Confirm the existing Google Drive connector spec is updated directly; no separate `SPEC_EVOL` consolidation remains.

- [ ] **Lot N — Final validation**
  - [x] Create/update PR using `BRANCH.md` text as PR body.
  - [x] Verify branch CI on the PR and resolve blockers.
  - [x] Commit removal/archive of `BRANCH.md` once CI is green.
  - [ ] Merge PR.
  - [ ] Monitor main CD.
  - [ ] Verify the Scaleway API container is `ready` and has the expected secret env keys without printing values.

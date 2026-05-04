# Fix: BR-16b Production Google Drive CD Secrets

## Objective
Restore production Google Drive readiness after BR-16a by wiring the Google Drive OAuth and Picker runtime secrets into the API deployment path.

## Scope / Guardrails
- Scope limited to GitHub Actions deploy wiring, Scaleway container secret propagation, and Google Drive runtime bootstrap documentation.
- No API behavior, UI behavior, database migration, OAuth scope, or Google Cloud app change in this branch.
- Make-only workflow, no direct Docker commands.
- Root workspace `/home/antoinefa/src/entropic` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development happens in isolated worktree `tmp/fix-prod-google-drive-cd-secrets-16b`.
- Automated test campaigns must run on dedicated environments (`ENV=test-fix-prod-google-drive-cd-secrets-16b`), never on root `dev`.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `BRANCH.md`
  - `.github/workflows/ci.yml`
  - `spec/SPEC_EVOL_GOOGLE_DRIVE_CONNECTOR.md`
- **Forbidden Paths (must not change in this branch)**:
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `api/**`
  - `ui/**`
  - `e2e/**`
  - `plan/NN-BRANCH_*.md` except a final archive file if this branch is finalized
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `Makefile`
- **Exception process**:
  - Declare exception ID `BR16b-EXn` in `## Feedback Loop` before touching conditional/forbidden paths.
  - Include reason, impact, and rollback strategy.

## Feedback Loop
- [x] `clarification` BR16b-EX1 — `Makefile` is allowed for production deploy secret wiring. Reason: the existing `make deploy-api` target only updates the Scaleway container image and never provisions the Google Drive runtime variables required by BR-16a. Impact: deployment path now updates the complete API secret env set needed for production (`DATABASE_URL` plus Google Drive OAuth/Picker keys) and fails fast when required values are missing. Rollback: remove the deploy secret arguments and the `check-prod-google-drive-secrets` target; production Drive will return to explicit misconfiguration until secrets are set manually.

## AI Flaky tests
- No AI flaky tests expected. This branch does not touch AI runtime behavior.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: one narrow CD fix with no parallel implementation stream.

## UAT Management (in orchestration context)
- No web UAT is required before PR. The acceptance check is production CD configuration: branch CI must deploy the API with the Google Drive runtime keys available to Scaleway.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/MASTER.md`, `rules/workflow.md`, `README.md`, `TODO.md`, `PLAN.md`, and the Google Drive spec.
  - [x] Create isolated worktree `tmp/fix-prod-google-drive-cd-secrets-16b`.
  - [x] Confirm command style: `make ... ENV=<env>` with `ENV` last.
  - [x] Confirm branch scope and declare `BR16b-EX1` before touching `Makefile`.

- [x] **Lot 1 — Production CD secret wiring**
  - [x] Add a fail-fast Make target for required production API secrets.
  - [x] Update `make deploy-api` path so Scaleway receives `DATABASE_URL` and Google Drive secret env variables when deploying the API image.
  - [x] Update GitHub Actions `deploy-api` job to pass the repo secrets into the Make deployment target.
  - [x] Document the production bootstrap contract in the Google Drive spec.
  - [x] Lot gate:
    - [x] `make check-prod-google-drive-secrets ... ENV=test-fix-prod-google-drive-cd-secrets-16b` with dummy non-secret values.
    - [x] `make -n deploy-api-container ... ENV=test-fix-prod-google-drive-cd-secrets-16b` with dummy non-secret values.

- [ ] **Lot N — Final validation**
  - [x] Create/update required GitHub repo secrets without printing values.
  - [ ] Commit with `make commit MSG="fix: wire google drive prod deployment secrets"`.
  - [ ] Push branch and open PR using this `BRANCH.md` as body.
  - [ ] Verify PR CI/CD checks.

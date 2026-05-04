# Feature: Production Google Drive CD Secret TLS Fix

## Objective
Fix the production API deployment wiring so Google Drive secrets are deployed without breaking the production database TLS configuration. Ensure the CD wait loop fails fast when Scaleway reports a container error.

## Scope / Guardrails
- Scope limited to production CD wiring and Google Drive deployment documentation.
- No migration.
- Make-only workflow, no direct Docker commands.
- Root workspace `/home/antoinefa/src/entropic` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development happens in isolated worktree `tmp/fix-prod-google-drive-cd-dbssl-16b`.
- Automated tests use dedicated non-root environments when needed.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `BRANCH.md`
  - `.github/workflows/ci.yml`
  - `Makefile`
  - `spec/SPEC_EVOL_GOOGLE_DRIVE_CONNECTOR.md`
  - `plan/done/16b-BRANCH_fix-prod-google-drive-cd-dbssl.md`
- **Forbidden Paths (must not change in this branch)**:
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `api/**`
  - `ui/**`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - None.
- **Exception process**:
  - `BR16b-EX1`: allow `Makefile` and `.github/workflows/ci.yml` because the regression is in production deployment wiring. Impact: CD-only. Rollback: revert this branch.

## Feedback Loop
- `acknowledge`: Production deploy from PR #131 injected the Google Drive secret names but put the Scaleway API container in `error`; `deploy-api` then stayed in `wait-for-container` because the target only waited for `ready`.
- `acknowledge`: `test-smoke-restore` already uses `DB_SSL_CA_PEM_B64` with `DATABASE_URL_PROD`; `deploy-api` must pass the same TLS secret to the production container.

## AI Flaky tests
- Not applicable. This branch does not change API behavior or AI tests.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: The fix is CD wiring only and has one deployment surface.

## UAT Management (in orchestration context)
- No UI UAT. Validation is GitHub Actions CD and Scaleway container status.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/MASTER.md` and `rules/workflow.md`.
  - [x] Create isolated worktree `tmp/fix-prod-google-drive-cd-dbssl-16b`.
  - [x] Confirm command style: `make ... ENV=<env>` with `ENV` last.
  - [x] Confirm scope and guardrails.
  - [x] Declare `BR16b-EX1` for CD Makefile/workflow changes.

- [x] **Lot 1 — Production deploy secret parity**
  - [x] Add `DB_SSL_CA_PEM_B64` to the `deploy-api` GitHub Actions environment.
  - [x] Pass `DB_SSL_CA_PEM_B64` as a Scaleway secret environment variable alongside `DATABASE_URL`.
  - [x] Keep Google Drive secret deployment intact.
  - [x] Make `wait-for-container` fail fast on Scaleway `error` and timeout instead of looping forever.
  - [x] Lot gate:
    - [x] `make check-prod-google-drive-secrets DATABASE_URL_PROD=dummy-db DB_SSL_CA_PEM_B64=dummy-ca GOOGLE_DRIVE_CLIENT_ID=dummy-client GOOGLE_DRIVE_CLIENT_SECRET=dummy-secret GOOGLE_DRIVE_AUTH_CALLBACK_BASE_URL=https://api.example.test GOOGLE_DRIVE_PICKER_API_KEY=dummy-picker GOOGLE_DRIVE_PICKER_APP_ID=dummy-app ENV=test-fix-prod-google-drive-cd-dbssl-16b`
    - [x] `make -n deploy-api-container DATABASE_URL_PROD=dummy-db DB_SSL_CA_PEM_B64=dummy-ca GOOGLE_DRIVE_CLIENT_ID=dummy-client GOOGLE_DRIVE_CLIENT_SECRET=dummy-secret GOOGLE_DRIVE_AUTH_CALLBACK_BASE_URL=https://api.example.test GOOGLE_DRIVE_PICKER_API_KEY=dummy-picker GOOGLE_DRIVE_PICKER_APP_ID=dummy-app ENV=test-fix-prod-google-drive-cd-dbssl-16b`

- [x] **Lot N-1 — Docs consolidation**
  - [x] Update Google Drive connector spec with production CD TLS secret parity.

- [ ] **Lot N — Final validation**
  - [x] `git diff --check`
  - [x] Create PR using `BRANCH.md` text as PR body.
  - [x] Remove `BRANCH.md`, archive this plan to `plan/done/16b-BRANCH_fix-prod-google-drive-cd-dbssl.md`, and push.
  - [ ] Verify branch CI.
  - [ ] Merge PR.
  - [ ] Supervise main CD and verify Scaleway secret names plus `ready` status.

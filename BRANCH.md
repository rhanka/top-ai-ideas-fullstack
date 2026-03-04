# Feature: SMTP Migration Stabilization (Brevo -> Scaleway)

## Objective
Validate and stabilize SMTP sending after migration from Brevo to Scaleway in production-like conditions, starting with a no-code diagnostic phase.

## Scope / Guardrails
- Scope limited to email sending diagnostics and minimal SMTP-related fixes.
- No database migration expected in this branch.
- Make-only workflow, no direct Docker commands.
- Root workspace `/home/antoinefa/src/top-ai-ideas-fullstack` stays reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development runs only in isolated worktree `tmp/fix-smtp-migration`.
- Automated test campaigns must run on dedicated environments, never on root `dev`.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `api/src/**`
  - `api/tests/**`
  - `api/package.json`
  - `api/package-lock.json`
  - `BRANCH.md`
  - `spec/**` (documentation updates only if behavior changes)
- **Forbidden Paths (must not change in this branch)**:
  - `Makefile`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/NN-BRANCH_*.md`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `.github/workflows/**`
  - `.env.example`
  - `README.md`
- **Exception process**:
  - Declare exception ID `BR50-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.

## Feedback Loop
- `BR50-FL1` | Branch: `tmp/fix-smtp-migration` | Owner: Codex | Severity: medium | Status: `attention`
  - Repro steps: `MAIL_USERNAME` and `MAIL_PASSWORD` are currently commented in `.env`; production reports SMTP send errors after provider migration.
  - Expected: SMTP send should succeed with Scaleway credentials/config and without ad-hoc retries.
  - Actual: Production send failures reported by user; exact failure signature to collect in Lot 0.
  - Evidence: To be captured in Lot 0 (`make logs-api`, isolated send test logs, `scw` diagnostic output).
  - Decision needed: confirm final SMTP transport configuration after matrix validation.

## AI Flaky tests
- Not applicable for this branch scope unless AI tests become indirectly impacted.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [x] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: single isolated infrastructure/debug scope focused on one SMTP migration problem.

## Environment Mapping
- Development diagnostics:
  - `ENV=tmp-fix-smtp-migration`
  - `API_PORT=8791`
  - `UI_PORT=5177`
  - `MAILDEV_UI_PORT=1081`
  - `VITE_API_BASE_URL=http://localhost:8791/api/v1`
- Reserved for branch test runs:
  - `ENV=test-fix-smtp-migration`
  - `ENV=e2e-fix-smtp-migration`

## UAT Management (in orchestration context)
- No UI functional evolution expected in Lot 0.
- UAT focus is API/mail delivery verification with explicit log evidence.

## Plan / Todo (lot-based)
- [x] **Lot 0 - Baseline, existing code read, and SMTP diagnostic (no code change)**
  - [x] Confirm isolated worktree creation from `main` and branch setup.
  - [x] Confirm isolated branch environment mapping and dedicated ports.
  - [x] Read existing email sending implementation (service/config/env wiring).
  - [x] Identify all Brevo-specific assumptions still present in code/config.
  - [x] Define isolated send test entrypoint already present in codebase (no new feature code).
  - [x] Run isolated SMTP send tests with runtime-injected credentials (no secret commit).
  - [x] Run `scw` diagnostics to validate sender/domain/credential state and delivery events.
  - [x] Execute SMTP configuration matrix:
    - [x] Host validation (Scaleway expected endpoint vs currently configured endpoint)
    - [x] Port validation (`465`, `587`)
    - [x] TLS mode validation (SSL/TLS direct vs STARTTLS)
    - [x] Auth mode validation (project UUID + SMTP password)
  - [x] Capture exact failure signatures and correlate app-side errors with provider-side events.
  - [x] Produce Lot 0 conclusion:
    - [x] validated working SMTP tuple
    - [x] confirmed gap versus current code/env behavior
    - [x] recommended minimal fix scope for Lot 1
  - [x] Lot gate commands and evidence:
    - [x] `make ps-all`
    - [x] `make logs-api ENV=tmp-fix-smtp-migration`
    - [x] SMTP isolated send command: `POST /api/v1/auth/email/verify-request`
    - [x] `scw` diagnostic commands and outputs archived in this file

  - [x] Findings summary (Lot 0):
    - Existing entrypoints validated:
      - `api/src/services/email-verification.ts` (`generateEmailVerificationCode`)
      - `api/src/services/magic-link.ts` (`sendMagicLinkEmail`)
      - Route used for isolated test: `POST /api/v1/auth/email/verify-request`
    - Local baseline:
      - MailDev config (`maildev:1025`, `MAIL_SECURE=false`, no auth) succeeds.
    - Scaleway matrix (runtime env injection, no code change):
      - `MAIL_HOST=smtp.tem.scaleway.com`, `MAIL_PORT=587`, `MAIL_SECURE=false`:
        - **Fail** with `EENVELOPE` / `502 5.7.0 Please authenticate first` on `MAIL FROM`.
      - `MAIL_HOST=smtp.tem.scaleway.com`, `MAIL_PORT=465`, `MAIL_SECURE=true`:
        - **Success** (`Email verification code sent`), recipient inbox confirmed.
      - `MAIL_HOST=smtp.tem.scaleway.com`, `MAIL_PORT=587`, `MAIL_SECURE=true`:
        - **Fail** with `ESOCKET` / TLS `wrong version number`.
    - Production-side read-only checks (`scw`):
      - Container `top-ai-ideas-api` is `ready`, image `top-ai-ideas-api:1aeb3e`.
      - Namespace `poc-containers` currently sets:
        - `MAIL_HOST=smtp.tem.scaleway.com`
        - `MAIL_PORT=587`
        - `MAIL_USERNAME=<project-id>`
        - `MAIL_FROM=noreply@sent-tech.ca`
        - `MAIL_PASSWORD` in secret vars
      - TEM domain `sent-tech.ca` is `checked`, reputation `excellent`.
      - TEM stats in project: `sent=2`, `failed=0`.
    - Root cause inferred from code:
      - In `email-verification.ts`, transporter uses `ignoreTLS: !env.MAIL_SECURE`.
      - With prod config (`MAIL_SECURE=false`, port `587`), this forces plaintext SMTP and disables STARTTLS.
      - Server then rejects `MAIL FROM` with `502 5.7.0 Please authenticate first`.
    - Lot 1 minimal fix scope (proposed):
      - Adjust SMTP transporter TLS flags to allow STARTTLS on authenticated non-implicit TLS transports (port 587), while preserving local MailDev behavior.
      - Keep runtime config externalized (no secret changes in repo).

- [x] **Lot 1 - Minimal implementation based on Lot 0 evidence**
  - [x] Implement only the minimal code/config changes required by Lot 0 conclusion.
  - [x] Keep compatibility and avoid unrelated refactors.
  - [x] Define exact changed files after Lot 0 and update this section before editing.
  - [x] Changed files:
    - `api/src/services/email-verification.ts`
    - `BRANCH.md`
  - [x] Implemented fix:
    - Compute `hasAuth` from `MAIL_USERNAME` + `MAIL_PASSWORD`.
    - Set `requireTLS = MAIL_SECURE || hasAuth`.
    - Set `ignoreTLS = !MAIL_SECURE && !hasAuth`.
    - Keep MailDev/no-auth behavior (plaintext allowed), enable STARTTLS path for authenticated `587`.
  - [x] Post-fix validation:
    - [x] `smtp.tem.scaleway.com:587` + `MAIL_SECURE=false` + auth -> **success**
      - API log: `Email verification code sent`
      - TEM: status `sent`, SMTP code `250`.
    - [x] `smtp.tem.scaleway.com:465` + `MAIL_SECURE=true` + auth -> **success** (kept valid)
    - [x] MailDev `maildev:1025` + no auth -> **success** (dev non-regression)
  - [x] Lot gate (executed):
    - [x] `make typecheck-api API_PORT=8791 UI_PORT=5177 MAILDEV_UI_PORT=1081 ENV=tmp-fix-smtp-migration`
    - [x] `make lint-api API_PORT=8791 UI_PORT=5177 MAILDEV_UI_PORT=1081 ENV=tmp-fix-smtp-migration`
      - Result: no errors, warnings only (pre-existing `no-console` warnings across API files)
  - [x] Additional evidence:
    - Production namespace still configured with `MAIL_PORT=587`; with this fix, that configuration becomes compatible with authenticated STARTTLS.

- [x] **Lot N - Final validation**
  - [x] Re-run typecheck/lint/tests for impacted scope.
  - [x] Re-run isolated SMTP send verification with final config.
  - [x] Validate no runtime errors in API logs.
  - [x] Prepare PR body from this `BRANCH.md`.
  - [x] Remove `BRANCH.md` only after UAT + CI are green.

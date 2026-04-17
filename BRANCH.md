# Feature: FIX-SEC-01 Fix bundled picomatch CVE-2026-33671 in API base image

## Objective
Resolve CVE-2026-33671 (HIGH) in `picomatch@4.0.3` bundled inside the API Docker image via the Node base image's npm CLI (`tinyglobby/node_modules/picomatch`), so that `make test-api-security-container` passes without any vulnerability-register acceptance entry.

## Scope / Guardrails
- Scope limited to `api/Dockerfile` and `BRANCH.md`.
- No migration in `api/drizzle/*.sql` (N/A).
- Make-only workflow, no direct Docker commands.
- Root workspace `~/src/top-ai-ideas-fullstack` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development must happen in isolated worktree `tmp/fix-api-base-picomatch`.
- Automated test campaigns must run on dedicated environments (`ENV=test-fix-api-base-picomatch`), never on root `dev`.
- UAT qualification branch/worktree must be commit-identical to the branch under qualification (same HEAD SHA; no extra commits before sign-off).
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `api/Dockerfile`
  - `BRANCH.md`
- **Forbidden Paths (must not change in this branch)**:
  - `Makefile`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `rules/**`
  - `.github/workflows/**`
  - `api/src/**`
  - `api/package.json`
  - `api/package-lock.json`
  - `ui/**`
  - `plan/NN-BRANCH_*.md` (except this branch file)
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `.security/vulnerability-register.yaml` (remove-only; no new picomatch acceptance entries)
- **Exception process**:
  - Declare exception ID `FIX-SEC-01-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.

## Feedback Loop
- `attention` — FIX-SEC-01-A1: npm CLI 11.12.1 (latest upstream as of 2026-04-16) still bundles `tinyglobby -> picomatch@4.0.3`. Node 24.15.0 (released 2026-04-15) also ships npm 11.12.1. A pure `FROM` tag bump cannot deliver picomatch >=4.0.4 yet. Real patch is applied by replacing the bundled `picomatch` inside the image, identical to the existing pattern used for `glob` (CVE-2025-64756), `tar` (CVE-2026-24842), and `minimatch` (CVE-2026-27903). This is NOT a vulnerability-register acceptance; the vulnerable file is physically replaced by picomatch 4.0.4 in the built image.

## AI Flaky tests
- N/A for this branch. No AI suites in scope.

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch**
- Rationale: Single-file Dockerfile hotfix. No UI/API/E2E impact. Cherry-pickable to main.

## UAT Management (in orchestration context)
- **Mono-branch**: No UAT required. Dockerfile-only fix, no user-facing change.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/workflow.md`, `rules/MASTER.md`, `rules/subagents.md`, `rules/testing.md`, `rules/security.md`, `plan/BRANCH_TEMPLATE.md`.
  - [x] Confirm isolated worktree `tmp/fix-api-base-picomatch` on branch `fix/api-base-picomatch` from `main@62de15ad`.
  - [x] Capture Makefile targets needed: `make build-api`, `make test-api-security-container`, `make exec-api`, `make down`.
  - [x] Define environment: `ENV=test-fix-api-base-picomatch`, `API_PORT=8798`, `UI_PORT=5198`, `MAILDEV_UI_PORT=1098`.
  - [x] Confirm command style: `make ... <vars> ENV=<env>` with `ENV` last.
  - [x] Confirm scope and guardrails: Allowed `api/Dockerfile`, `BRANCH.md`; Forbidden everything else listed above.
  - [x] Port ownership check: dev uses 8787/5173/1080; 8798/5198/1098 are free.
  - [x] Confirm CVE source in CI run `24560147343` job `security-container`: `CVE-2026-33671 api picomatch 4.0.3 in usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch/package.json`.
  - [x] Identify fixed picomatch version: `4.0.4` per GHSA-c2c7-rcm5-vvqj.
  - [x] Investigate available node:24-alpine tags: current Dockerfile uses `node:24-alpine3.22`; upstream default is now `alpine3.23`; latest LTS is `node:24.15.0` (2026-04-15), still bundling npm `11.12.1` with picomatch `4.0.3`.
    - `attention` FIX-SEC-01-A1 raised: base-image tag bump alone is insufficient; in-image override of bundled picomatch is required and is the real patch (same pattern already used in the Dockerfile for glob/tar/minimatch).
  - [x] Confirm no existing picomatch entry to remove from `.security/vulnerability-register.yaml`.

- [x] **Lot 1 — Base image bump + bundled picomatch override**
  - [x] Update `api/Dockerfile`:
    - [x] Change `FROM node:24-alpine3.22 AS base` to `FROM node:24-alpine3.23 AS base` (picks up Alpine OS CVE refreshes).
    - [x] Change `FROM node:24-alpine3.22 AS production` to `FROM node:24-alpine3.23 AS production`.
    - [x] Add `RUN` block in `base` stage to replace `/usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch` with `picomatch@4.0.4` (mirrors existing glob/tar/minimatch override pattern).
    - [x] Add the same `RUN` block in `production` stage.
  - [x] Build the API image: `make build-api API_PORT=8798 UI_PORT=5198 MAILDEV_UI_PORT=1098 ENV=test-fix-api-base-picomatch` — built `top-ai-ideas-api:50f9bb` successfully.
  - [x] Run container scan: `make test-api-security-container API_PORT=8798 UI_PORT=5198 MAILDEV_UI_PORT=1098 ENV=test-fix-api-base-picomatch` exits 0; `.security/container-api-parsed.yaml` reports `findings_count: 0`. Compliance PASS. Picomatch CVE absent from trivy output (not accepted — gone).
  - [x] No other HIGH/CRITICAL CVEs surfaced. (1 MODERATE: hono jsx GHSA-458j-xx4x-4375, not blocking per security rules.)
  - [x] Lot gate:
    - [x] No typecheck/lint/unit/e2e impact (Dockerfile-only change). Sub-lot gates skipped per scope.
    - [x] Container scan is the authoritative gate: `make test-api-security-container ... ENV=test-fix-api-base-picomatch` exit 0 with picomatch CVE absent. Verified.

- [x] **Lot N — Final validation**
  - [x] Clean up test environment: `make down API_PORT=8798 UI_PORT=5198 MAILDEV_UI_PORT=1098 ENV=test-fix-api-base-picomatch` (build-only, no services started).
  - [x] Two commits on `fix/api-base-picomatch`: `docs(branch): init fix/api-base-picomatch` then `fix(api): bump node base image + patch bundled picomatch for CVE-2026-33671`.
  - [x] Branch NOT pushed. Conductor handles PR creation and integration.
  - [x] Handoff note: fixes CI run `24560147343` `security-container` API lane failure.

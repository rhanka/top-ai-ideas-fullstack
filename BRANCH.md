# Feature: FIX-SEC-01 — Accept CVE-2026-33671 on bundled picomatch (tinyglobby via npm)

## Objective
Register CVE-2026-33671 on `picomatch@4.0.3` (bundled inside the npm CLI via `tinyglobby`) as an accepted risk in `.security/vulnerability-register.yaml`, so the `security-container` compliance check passes on main and subsequent branches.

## Scope / Guardrails
- Scope limited to `.security/vulnerability-register.yaml` and `BRANCH.md` only.
- No code, Dockerfile, Makefile, compose, CI workflow, or migration change.
- Make-only workflow, no direct Docker commands.
- Root workspace `~/src/top-ai-ideas-fullstack` is reserved for user dev/UAT (`ENV=dev`) and must remain stable.
- Branch development happens in isolated worktree `tmp/fix-security-register-picomatch-cve`.
- Automated test campaigns must run on dedicated environment (`ENV=test-fix-security-register-picomatch-cve`), never on root `dev`.
- In every `make` command, `ENV=<env>` must be passed as the last argument.
- All new text in English.

## Branch Scope Boundaries (MANDATORY)
- **Allowed Paths (implementation scope)**:
  - `.security/vulnerability-register.yaml`
  - `BRANCH.md`
- **Forbidden Paths (must not change in this branch)**:
  - `Makefile`
  - `docker-compose*.yml`
  - `.cursor/rules/**`
  - `plan/NN-BRANCH_*.md` (except this branch file; none used here)
  - `api/**`, `ui/**`, `extension/**`, `vscode-ext/**`
  - `.github/workflows/**`
  - `scripts/security/**`
- **Conditional Paths (allowed only with explicit exception when not already listed in Allowed Paths)**:
  - `api/drizzle/*.sql` (max 1 file) — not expected
  - `.github/workflows/**` — not expected
- **Exception process**:
  - Declare exception ID `FIX-SEC-01-EXn` in `## Feedback Loop` before touching any conditional/forbidden path.
  - Include reason, impact, and rollback strategy.

## Feedback Loop
- FIX-SEC-01-FB1 — `attention` — Register entry for CVE-2026-33671 correctly registered and ACCEPTED by the local scan (evidence: `✅ ACCEPTED: accepted_risk` on line `CVE-2026-33671_api_picomatch_4.0.3 in usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch/package.json:1 (HIGH)`). However, the local container scan against a freshly built image (`rg.fr-par.scw.cloud/nc-reg/top-ai-ideas-api:73d7c5`) additionally surfaces 5 Alpine base OS CVEs NOT present in CI run `24560147343`: `CVE-2026-28390_api_libcrypto3_3.5.5-r0`, `CVE-2026-28390_api_libssl3_3.5.5-r0`, `CVE-2026-40200_api_musl_1.2.5-r10`, `CVE-2026-40200_api_musl-utils_1.2.5-r10`, `CVE-2026-22184_api_zlib_1.3.1-r2`. These are out of scope for FIX-SEC-01 per launch packet (scope = picomatch only; do not mass-disable scans; do not edit Dockerfile/Makefile). The branch acceptance criterion is CI `security-container` passing once the picomatch entry is present; the Alpine CVEs appeared after CI green on main, so they will be addressed in a follow-up branch. Recommendation: conductor opens a follow-up branch for the 5 Alpine base CVEs (register entries or base-image bump) independently of this fix.

## AI Flaky tests
- Not applicable (yaml-only change, no AI tests in scope).

## Orchestration Mode (AI-selected)
- [x] **Mono-branch + cherry-pick** (default for orthogonal tasks; single final test cycle)
- [ ] **Multi-branch** (only if sub-workstreams require independent CI or long-running validation)
- Rationale: single-file orthogonal hotfix; one acceptance check via `make test-api-security-container`.

## UAT Management (in orchestration context)
- **Mono-branch**: no UAT surface impacted (no UI/extension change). Validation = security scan local run + CI security-container job.

## Plan / Todo (lot-based)
- [x] **Lot 0 — Baseline & constraints**
  - [x] Read `rules/workflow.md`, `rules/MASTER.md`, `rules/subagents.md`, `rules/testing.md`, `rules/security.md`.
  - [x] Confirm worktree `tmp/fix-security-register-picomatch-cve` on branch `fix/security-register-picomatch-cve`, baseline `main@62de15ad`.
  - [x] Environment mapping: `ENV=test-fix-security-register-picomatch-cve`, `API_PORT=8799`, `UI_PORT=5199`, `MAILDEV_UI_PORT=1099`.
  - [x] Confirm command style: `make <target> <vars> ENV=<env>` with `ENV` last.
  - [x] Read existing `.security/vulnerability-register.yaml` schema; reuse `CVE-<ID>_<service>_<pkg>_<version>` key format (matches `security-parser.sh` finding id format).
  - [x] Identify the compliance check source: `scripts/security/security-compliance.sh` matches `.vulnerability_register.vulnerabilities."<id>".category`.
  - [x] Confirm CVE source: CI run `24560147343`, job `security-container`, trivy finding `CVE-2026-33671_api_picomatch_4.0.3` at `usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch/package.json:1` (HIGH).
  - [x] Validate scope boundaries; no `FIX-SEC-01-EXn` declared.

- [x] **Lot 1 — Register entry for CVE-2026-33671 (picomatch 4.0.3)**
  - [x] Add entry to `.security/vulnerability-register.yaml` under `vulnerability_register.vulnerabilities`:
    - [x] key: `CVE-2026-33671_api_picomatch_4.0.3`
    - [x] `category: accepted_risk`
    - [x] `risk: HIGH`
    - [x] `description`: picomatch ReDoS in scan function, bundled transitively via npm CLI -> tinyglobby -> picomatch
    - [x] `file: usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules/picomatch/package.json`
    - [x] `line: 1`
    - [x] `cwe: CWE-1333`
    - [x] `fix_goal: 1m`
    - [x] `justification`: transitive via npm CLI inside node base image; not reachable from API runtime request path; npm CLI only invoked at build/install time; temporary accept while tracking a clean node/npm base-image upgrade
    - [x] `status: accepted_temporary`
    - [x] `discovered: 2026-04-16`
    - [x] `review_due: 2026-05-16`
    - [x] `planned_fix`: upgrade node/npm base image when upstream npm bundle includes fixed picomatch (>=4.0.4) and remove this exception after container scan passes
  - [x] Update `vulnerability_register.metadata.last_updated` to `2026-04-16`.
  - [x] Lot gate:
    - [x] Typecheck / lint: N/A (yaml-only change, not covered by `make typecheck-*` / `make lint-*`).
    - [x] Run `make test-api-security-container API_PORT=8799 UI_PORT=5199 MAILDEV_UI_PORT=1099 ENV=test-fix-security-register-picomatch-cve`.
    - [x] Confirm picomatch finding is now `✅ ACCEPTED: accepted_risk`. (See `## Feedback Loop` FIX-SEC-01-FB1 for 5 out-of-scope Alpine CVEs surfaced locally that do not reproduce on CI run `24560147343`.)
    - [x] Record evidence in `## Feedback Loop` (FIX-SEC-01-FB1).

- [x] **Lot N — Final validation & handoff**
  - [x] Typecheck & Lint: N/A (yaml-only).
  - [x] No UI/API/E2E test re-run required (scope: register-only change, no runtime code affected).
  - [x] Local scan confirms picomatch is ACCEPTED; 5 out-of-scope Alpine CVEs tracked in FIX-SEC-01-FB1.
  - [x] Two commits on `fix/security-register-picomatch-cve`:
    - [x] `docs(branch): init fix/security-register-picomatch-cve` (adds `BRANCH.md`)
    - [x] `fix(security): accept CVE-2026-33671 on bundled picomatch (tinyglobby via npm)` (adds register entry + `BRANCH.md` checkbox updates)
  - [x] Do NOT push, do NOT open PR — conductor handles integration.
  - [x] Handoff to conductor: PR creation with `BRANCH.md` as body; merge after CI `security-container` job passes; follow-up branch recommended for Alpine OS CVEs (see FIX-SEC-01-FB1).

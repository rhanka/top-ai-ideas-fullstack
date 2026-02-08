# Feature: Wave 1 integration (i18n + constraints + print + ci)

## Objective
Integrate Wave 1 feature branches into `feat/i18n-print-ci` and stabilize before Wave 2.

## Scope / Guardrails
- Merge-only integration branch for Wave 1.
- Resolve dependency and template conflicts here.
- Keep Make-only workflow.

## Integrated branches
- `feat/i18n-core-and-tech-keys`
- `feat/usecase-constraints`
- `feat/print-docx-usecase-onepage`
- `feat/ci-reduce-time`

## UAT status
- Wave 1 UAT validated on branch environments.
- Integration UAT pending on `feat/i18n-print-ci` environment.

## Next steps
- Complete remaining Wave 1 merges.
- Run integration UAT.
- Run final gates (`test-api`, `test-ui`, `build-*`, `test-e2e`).

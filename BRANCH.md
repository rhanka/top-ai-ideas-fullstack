# BR24 - chore/node24-actions-upgrade

## Identity

- [ ] Branch: `chore/node24-actions-upgrade`
- [ ] Worktree: `tmp/chore-node24-actions-upgrade`
- [ ] Base: `origin/main` after BR14c and audit hotfix merge
- [ ] ENV: `test-chore-node24-actions-upgrade`

## spec_vol

- [ ] Intention: make GitHub Actions workflows durable for Node 24 runner/action compatibility.
- [ ] Success: CI, package publish, image publish, and deploy jobs keep behavior while using maintained action/runtime versions.
- [ ] Non-goal: no product code change, no package manager change, no deploy topology change.

## spec_evol

- [ ] Prefer minimal action major upgrades when they preserve behavior.
- [ ] Expand scope only when a workflow action or Node runtime dependency is proven incompatible.
- [ ] Preserve OIDC trusted publishing for `@sentropic/llm-mesh`.
- [ ] Defer broader CI redesign to a later release-quality branch.

## Scope

- [ ] Allowed: `BRANCH.md`.
- [ ] Allowed: `.github/workflows/**`.
- [ ] Conditional: `Makefile` only if a workflow make target is proven incompatible and the fix is generic.
- [ ] Conditional: `docs/**` only if CI/runtime documentation must mention the Node version cutover.
- [ ] Forbidden: `api/**`, `ui/**`, `packages/**`, `e2e/**`, `docker-compose*.yml`, database migrations.
- [ ] Forbidden: product behavior, model catalog behavior, auth, billing, chat runtime, deployment semantics unrelated to CI compatibility.

## Lot 0 - Inventory

- [x] Identify every GitHub Action version in `.github/workflows/**`.
- [x] Identify every `setup-node` usage and requested Node version.
- [ ] Identify actions that embed Node 20 or older runtime assumptions.
- [ ] Confirm OIDC publish job for `@sentropic/llm-mesh` is preserved.

## Lot 1 - Upgrade

- [x] Upgrade official actions to Node 24-compatible maintained versions where available.
- [x] Preserve permissions blocks, concurrency, environments, secrets, and OIDC settings.
- [x] Avoid unrelated YAML formatting churn.

## Lot 2 - Behavior preservation

- [ ] Confirm make-only command shape stays unchanged.
- [ ] Confirm publish/deploy job names remain stable unless action upgrade requires otherwise.
- [ ] Keep CI matrix semantics unchanged.

## Lot 3 - Final

- [ ] Run targeted make-only checks only if useful for workflow validation.
- [ ] Open PR and use GitHub Actions as source of truth for workflow compatibility.
- [ ] Remove `BRANCH.md` before merge unless project explicitly keeps it.

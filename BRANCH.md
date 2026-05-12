# BR14g - feat/model-catalog-gpt55-opus47

## Identity

- [ ] Branch: `feat/model-catalog-gpt55-opus47`
- [ ] Worktree: `tmp/feat-model-catalog-gpt55-opus47`
- [ ] Base: `origin/main` after BR14c and audit hotfix merge
- [ ] Package scope after BR14c: `@sentropic/llm-mesh`
- [ ] ENV: `test-feat-model-catalog-gpt55-opus47`
- [ ] E2E ENV: `e2e-feat-model-catalog-gpt55-opus47`
- [ ] Ports: API 9070, UI 5270, Maildev 1170

## spec_vol

- [ ] Intention: pivot the model catalog and defaults to GPT-5.5 and Claude Opus 4.7 on top of the live mesh contract.
- [ ] Success: application defaults, API/UI labels, compatibility aliases, and focused tests consistently reference the new catalog state.
- [ ] Non-goal: no runtime dispatch rewrite, no workflow redesign, no npm publishing changes.

## spec_evol

- [ ] Verify exact provider model identifiers before changing code.
- [ ] Preserve GPT-5.4 Nano unless provider availability proves it must change.
- [ ] Keep legacy compatibility aliases for persisted settings when needed.
- [ ] Defer any broader provider/profile architecture issue to BR14b/BR19/BR23.

## Scope

- [ ] Allowed: `BRANCH.md`.
- [ ] Allowed: `packages/llm-mesh/**`.
- [ ] Allowed: `api/src/**` only for model catalog, provider profiles, labels, budgets, defaults, compatibility aliases.
- [ ] Allowed: `api/tests/**` only for affected catalog/profile/default assertions.
- [ ] Allowed: `ui/src/**` only for visible model names, selectors, labels, or docs surfaced in UI.
- [ ] Allowed: `ui/tests/**` only for affected catalog/profile UI assertions.
- [ ] Forbidden: `.github/workflows/**`, `docker-compose*.yml`, `infra/**`, database migrations.
- [ ] Forbidden: auth, billing, workspace, organization, chat persistence, or deployment behavior.

## Lot 0 - Baseline

- [ ] Confirm branch starts from post-BR14c/post-hotfix `origin/main`.
- [x] Locate catalog/default/profile source of truth in mesh package, API, and UI.
- [ ] Confirm exact OpenAI GPT-5.5 API model identifier.
- [ ] Confirm exact OpenAI GPT-5.4 Nano API model identifier.
- [x] Confirm exact Anthropic Claude Opus 4.7 API model identifier.
- [ ] Record identifiers in branch notes without exposing secrets. OpenAI static docs did not expose `gpt-5.5` through curl; Anthropic public docs expose `claude-opus-4-7`.

## Lot 1 - Catalog

- [x] Add or update GPT-5.5 catalog entry with provider id, label, family, capabilities, and constraints.
- [x] Preserve GPT-5.4 Nano entry and intentional low-cost references.
- [x] Add or update Claude Opus 4.7 catalog entry with provider id, label, family, capabilities, and constraints.
- [ ] Deprecate or demote GPT-5.4 and Opus 4.6 only where catalog semantics require it.

## Lot 2 - Defaults

- [x] Pivot default reasoning profile from GPT-5.4 to GPT-5.5.
- [x] Pivot Anthropic top-tier profile from Opus 4.6 to Opus 4.7.
- [ ] Update budget tiers, aliases, and fallback labels impacted by the pivot.
- [ ] Keep persisted-setting compatibility rules explicit.

## Lot 3 - UI and tests

- [ ] Update visible model names and descriptions in selectors/cards/docs.
- [ ] Preserve stable keys if UI preferences are stored by model id.
- [ ] Update focused catalog/profile/default tests.
- [ ] Add regression coverage only if current tests do not cover default model selection.

## Lot 4 - Final

- [ ] Run make-only checks selected for this branch.
- [ ] Prepare PR body from this `BRANCH.md`.
- [ ] Remove `BRANCH.md` before merge unless project explicitly keeps it.

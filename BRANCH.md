# BR25 - chore/rules-skills-audit

## Identity

- [ ] Branch: `chore/rules-skills-audit`
- [ ] Worktree: `tmp/chore-rules-skills-audit`
- [ ] Base: `origin/main` after BR14c and audit hotfix merge
- [ ] Mode: ambitious brainstorm/watch branch before mechanical rule changes
- [ ] ENV: `test-chore-rules-skills-audit`

## spec_vol

- [ ] Intention: turn our best operating patterns into durable, shareable, enforceable AI development tooling.
- [ ] Success: produce a best-of-breed synthesis across Graphify, Superpowers, Entropiq conductor methods, GSD-style workflows, GitHub Spec Kit, and current AI coding agent/plugin ecosystems.
- [ ] Success: decide what becomes project rules, skills, plugins, public packages, templates, docs, or product features.
- [ ] Non-goal: no immediate rewrite of product agent runtime or BR19 skill catalog.

## spec_evol

- [ ] Expand the benchmark when a tool or methodology materially improves intention capture, spec evolution, task decomposition, verification, human approval, or publication/distribution.
- [ ] Separate developer-agent operating system concerns from product skill catalog concerns.
- [ ] Feed product-skill findings into BR19, not directly into BR25 implementation.
- [ ] Keep mechanical enforcement changes small and reviewable after benchmark consensus.

## Scope

- [ ] Allowed: `BRANCH.md`.
- [ ] Allowed: `rules/**` after benchmark phase only.
- [ ] Allowed: `spec/**` for methodology specs and benchmark artifacts.
- [ ] Allowed: `plan/**` for conductor roadmap updates.
- [ ] Allowed: `.codex/**`, `.agents/**`, `.claude/**` only if present and explicitly scoped to shareable skills/plugins/rules.
- [ ] Conditional: `Makefile` only for existing conductor/reporting targets or mechanical enforcement targets.
- [ ] Forbidden: product runtime rewrites.
- [ ] Forbidden: database migrations.
- [ ] Forbidden: API/UI feature implementation.
- [ ] Forbidden: changes to npm publishing or deployment workflows unless explicitly split into BR24.

## Lot 0 - Re-benchmark frame

- [x] Define benchmark dimensions: intention capture, spec evolution, planning, loop control, verification, branch discipline, memory, plugin distribution, and public reuse.
- [x] Define baseline: current rules, conductor report, `BRANCH.md`, `PLAN.md`, `spec_vol`, `spec_evol`, and BR04B incident learnings.
- [x] Define difference between developer-agent skills and product user-facing skills.

## Lot 1 - External benchmark refresh

- [x] Review Graphify patterns for knowledge graph extraction, clustering, audit trail, and visual publication.
- [x] Review Superpowers patterns for brainstorming, plans, TDD, verification, worktrees, and subagent workflows.
- [x] Review GSD-style execution trends for high-discipline agentic delivery loops.
- [x] Review GitHub Spec Kit patterns for specs, plans, tasks, and implementation discipline.
- [x] Review Codex, Claude, Gemini, and related plugin/skill ecosystems for distribution and interoperability.

## Lot 2 - Entropiq method synthesis

- [x] Identify what our conductor model does better than external references.
- [x] Identify what external references do better than our conductor model.
- [x] Define the minimum durable method: `spec_vol`, `spec_evol`, branch plan, loop control, verification, publication.
- [x] Define naming and file conventions that can be reused outside this repo.

## Lot 3 - Publication strategy

- [x] Decide whether outputs should be published as Codex skills, Claude commands, MCP servers, npm packages, GitHub templates, docs, or Graphify reports.
- [x] Define what can be open and useful to everyone without leaking project-specific context.
- [x] Define what remains private repo policy.
- [x] Define compatibility with future Entropiq CLI and BR19 product skill catalog.

## Lot 4 - Mechanical enforcement candidates

- [x] Propose rule checks for branch scope, forbidden commands, `ENV` placement, `BRANCH.md` shape, commit size, conductor lanes, and merge readiness UAT state.
- [x] Propose hook or make-target enforcement only after benchmark decision.
- [x] Keep each enforcement change separately reviewable.

## Lot 5 - Decision output

- [x] Produce a best-of-breed recommendation document.
- [x] Produce roadmap updates for BR19, BR23, BR24, BR10, and future CLI work.
- [x] Produce a small mechanical-enforcement implementation plan if approved.
- [ ] Remove `BRANCH.md` before merge unless project explicitly keeps it. (Deferred to merge step per `rules/workflow.md` PR Creation sequence; not removed during synthesis close.)

## Closure

- [x] Lot 4 + Lot 5 work items closed. Final BRANCH.md deletion is the last merge-prep step per `rules/workflow.md`.
- [x] Outputs landed on this branch:
  - `spec/SPEC_STUDY_BEST_OF_BREED_AGENT_METHODS.md` (Lot 1-3 + Lot 4 candidates source).
  - `spec/SPEC_STUDY_BR25_ENFORCEMENT_CANDIDATES.md` (Lot 4 candidate list).
  - `spec/SPEC_BR25_BEST_OF_BREED.md` (Lot 5 decision output, D1-D7 pending approval).
  - `spec/SPEC_STUDY_BR25_ENFORCEMENT_PLAN.md` (Lot 5 staged implementation plan).
  - `PLAN.md` §8 BR-25 roadmap updates (advisory inputs to BR19/23/24/10/CLI).
  - Per-branch handoff notes added to `plan/19-*.md`, `plan/23-*.md`, `plan/10-*.md`.
- [x] Pending human review: BR25 D1-D7 in `spec/SPEC_BR25_BEST_OF_BREED.md` before any rule, skill, or hook lands.

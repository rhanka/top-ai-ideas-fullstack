# SPEC_VOL - Best-of-Breed Agent Methods, Skills, and Publication

## Intention

Turn the strongest parts of Entropiq conductor practice, Graphify, Superpowers, GSD-style execution discipline, GitHub Spec Kit, and current AI coding-agent ecosystems into a durable, shareable method for AI-assisted development.

## Product boundary

This branch is about developer-agent operating methods, rules, specs, skills, plugins, and publication strategy. It is not the product skill catalog branch. Product-facing skill catalog, sandbox execution, and app tool replacement belong to BR19.

## Benchmark families

- Graphify: knowledge graph extraction, community clustering, audit reports, visual publication, traceability from raw material to conclusions.
- Superpowers: brainstorming, writing plans, TDD, worktrees, verification, subagent-driven development, branch finishing.
- Entropiq conductor: `PLAN.md`, `BRANCH.md`, branch lanes, port isolation, make-only discipline, spec_vol/spec_evol, commit discipline, conductor reports.
- GSD-style execution: small loops, explicit next actions, low ceremony, progress visibility, interruption recovery, outcome bias.
- GitHub Spec Kit: spec-first planning, task decomposition, implementation tracking, repository-native collaboration.
- AI coding tools: Codex, Claude Code, Gemini CLI, Clawcode-like tools, MCP servers, plugins, skills, commands, hooks, and CI agents.

## Evaluation dimensions

- Intention capture: how clearly the method records what the user wants and why.
- Spec evolution: how scope changes are recorded without losing the original intent.
- Loop control: how planning, action, observation, correction, approval, and verification are governed.
- Mechanical enforcement: which rules can be checked by hooks, make targets, CI, or plugins.
- Branch discipline: worktree isolation, allowed paths, forbidden paths, commit size, merge readiness.
- Memory and context: what should persist across sessions and what should be regenerated.
- Publication: what can become reusable public infrastructure without leaking project-specific context.
- Interoperability: what can work across Codex, Claude, Gemini, GitHub, CLI, and Entropiq product surfaces.

## Architecture hypothesis

The method should publish as layered artifacts:

- Rules: repo-local policy for commands, branches, commits, tests, and security.
- Specs: `SPEC_VOL` for intent and `SPEC_EVOL` for controlled evolution.
- Skills/plugins: reusable agent behaviors for planning, conductor reports, verification, graphification, and release discipline.
- Templates: branch plans, PR bodies, benchmark matrices, and decision records.
- CLI/API hooks: optional enforcement points for projects that want stricter automation.

## spec_evol rules

- Keep developer-agent skills separate from BR19 product skills until integration is explicitly designed.
- Prefer public, reusable primitives over project-specific rituals when publishing.
- Prefer mechanical checks for repeated failures and written guidance for judgment-heavy behavior.
- Do not add enforcement until the benchmark identifies the target behavior and rollback path.
- Use Graphify-style evidence when comparing methods, not preference-only claims.

## Expected output

- A best-of-breed benchmark document.
- A publication strategy for skills, plugins, templates, and optional packages.
- A short enforcement roadmap.
- Clear handoff notes to BR19 for product skill catalog implications.

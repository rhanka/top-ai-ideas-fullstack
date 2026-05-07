# Branch Plan Stub: BR-14g Model Catalog GPT-5.5 / Opus 4.7

Current coordination source:

- `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`

Branch:

- BR-14g `feat/model-catalog-gpt55-opus47`

Ordering rule:

- BR-14g starts after BR-14c freezes the `@entropic/llm-mesh` public model-profile contract.
- BR-14g must land before BR-14b migrates the application runtime onto the mesh contract.
- BR-14g must not perform the BR-14b runtime migration or the BR-14a chat extraction.

Scope summary:

- Pivot OpenAI default reasoning model from GPT-5.4 to GPT-5.5.
- Keep GPT-5.4 Nano available and unchanged.
- Pivot Anthropic Claude Opus from Opus 4.6 to Opus 4.7.
- Update model catalog entries, provider profiles, legacy default cutover rules, context budgets, UI/API labels, and deterministic tests.
- Verify provider API model identifiers at branch start before implementation.

Before implementation:

- Create a full `BRANCH.md` from `plan/BRANCH_TEMPLATE.md`.
- Include file-level updates for `packages/llm-mesh`, `api/src/services/model-catalog.ts`, provider adapters, model-selection legacy rules, API tests, package tests, and any UI display tests if labels surface in UI state.
- Run deterministic catalog tests first; live-provider validation is optional and must be isolated by provider.

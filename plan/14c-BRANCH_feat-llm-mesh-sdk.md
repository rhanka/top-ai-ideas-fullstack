# Branch Plan Stub: BR-14c LLM Mesh SDK

Current coordination source:

- `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`

Branch:

- BR-14c `feat/llm-mesh-sdk`

Ordering rule:

- BR-14c is the first BR-14 implementation branch.
- It defines the `@entropic/llm-mesh` public model-access contract and cuts the application LLM runtime over to that package before BR-14b chat-service modularization and BR-14a chat SDK extraction.

Scope summary:

- Publishable npm package boundary for `@entropic/llm-mesh`.
- Providers: OpenAI, Anthropic/Claude, Google/Gemini, Mistral, Cohere.
- Auth modes: direct token, user token, Codex-account mode.
- Later account targets prepared: Gemini Code Assist, Claude Code.
- Normalized streaming, tool capability, and model capability contracts.
- Real API workspace import of `@entropic/llm-mesh`; relative source imports are not sufficient.
- Strict application LLM runtime cutover to the package.
- Deletion of replaced app-local provider/runtime implementation in the same branch.
- Preservation of credential precedence, quotas, retries, streaming order, tool-call continuation, reasoning controls, traces/audit metadata, and live AI behavior.

Before implementation:

- Create a full `BRANCH.md` from `plan/BRANCH_TEMPLATE.md`.
- Include file-level API/package tests, runtime cutover tests, live-provider test split strategy, and root UAT proving chat generation uses the mesh-backed runtime.

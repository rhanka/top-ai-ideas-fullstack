# Branch Plan Stub: BR-14b Chat Service Core

This file supersedes the older BR-14 LLM runtime-refactor pointer. Runtime model access now belongs to BR-14c.

Current coordination source:

- `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`

Branch:

- BR-14b `refacto/chat-service-core`

Ordering rule:

- BR-14b comes after BR-14c strict runtime cutover and BR-14g model catalog pivot.
- BR-14b must not define provider/model access or migrate runtime dispatch; all model access must already go through `@entropic/llm-mesh`.
- BR-14b comes before BR-14a chat SDK implementation.

Scope summary:

- Modularize chat-service behavior above the LLM runtime.
- Extract reasoning-loop, tool-loop, continuation, cancellation, retry, checkpoint, and trace/audit boundaries where reusable.
- Preserve current chat streaming, local-tool handoff, tool-result continuation, cancellation, retry, checkpoint, and API behavior.
- Keep provider/model access delegated to `@entropic/llm-mesh`.

Before implementation:

- Create a full `BRANCH.md` from `plan/BRANCH_TEMPLATE.md`.
- Inventory `api/src/services/chat-service.ts`, `api/src/services/tools.ts`, `api/src/services/stream-service.ts`, and chat-related tests.
- Define file-level unit/API/live-AI/E2E checks before extracting modules.

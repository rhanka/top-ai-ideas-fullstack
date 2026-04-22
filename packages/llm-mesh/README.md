# @entropic/llm-mesh

Provider-agnostic TypeScript contracts for Entropic model access.

This package boundary is intentionally contract-only in BR-14c Lot 1. It defines public provider/model IDs, capability metadata, normalized generation and streaming shapes, tool-use types, structured-output flags, and authentication source types. It does not migrate the Entropic application runtime and it does not implement live account enrollment flows.

## Public Scope

- Providers: OpenAI, Google Gemini, Anthropic Claude, Mistral, Cohere.
- Auth sources: direct token, user token, workspace token, environment token, Codex account.
- Future account transport extension points: Gemini Code Assist and Claude Code.
- Normalized stream events: `reasoning_delta`, `content_delta`, `tool_call_start`, `tool_call_delta`, `tool_call_result`, `status`, `error`, `done`.

Application wiring, encrypted storage, quotas, retries, UI behavior, and live provider adapters remain outside this Lot 1 contract.

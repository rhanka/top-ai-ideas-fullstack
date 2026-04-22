# @entropic/llm-mesh

Provider-agnostic TypeScript contracts for Entropic model access.

This package boundary is intentionally contract-first in BR-14c. It defines public provider/model IDs, capability metadata, normalized generation and streaming shapes, tool-use types, structured-output flags, authentication source types, deterministic provider adapter scaffolds, and retryable error metadata. It does not migrate the Entropic application runtime and it does not implement live account enrollment flows.

## Public Scope

- Providers: OpenAI, Google Gemini, Anthropic Claude, Mistral, Cohere.
- Auth sources: direct token, user token, workspace token, environment token, Codex account.
- Future account transport extension points: Gemini Code Assist and Claude Code.
- Normalized stream events: `reasoning_delta`, `content_delta`, `tool_call_start`, `tool_call_delta`, `tool_call_result`, `status`, `error`, `done`.
- Provider adapters: OpenAI, Gemini, Anthropic Claude, Mistral, and Cohere scaffolds accept injected clients for deterministic tests; they do not perform live SDK calls by default.

Application wiring, encrypted storage, quotas, retries, UI behavior, and concrete live provider clients remain outside this package contract until the application runtime migration branch.

# SPEC EVOL - LLM Mesh

Status: Draft for BR-14c Lot 0.

Owner branch: `feat/llm-mesh-sdk`.

Related orchestration spec: `spec/SPEC_EVOL_ENTROPIC_BR14_ORCHESTRATION.md`.

## Objective

Define `@entropic/llm-mesh`, the first standalone Entropic npm service. The package must provide a provider-agnostic model access contract for OpenAI, Anthropic/Claude, Google/Gemini, Mistral, and Cohere while preserving a clean handoff to BR-14b for application runtime migration.

This spec owns the durable classification of reusable LLM runtime functions, current code usage validation, external framework comparison, and scope decisions for BR-14c.

## Non-Goals

- Do not extract chat UI behavior. BR-14a owns `@entropic/chat`.
- Do not fully migrate the current application runtime. BR-14b owns application runtime migration to the mesh contract.
- Do not execute operational DNS, repository, Scaleway, registry, or secret transitions. BR-14d owns transition operations.
- Do not complete the final codebase naming sweep. BR-14e owns final naming cleanup.
- Do not build a FinOps platform inside the MVP package.
- Do not bind the package to Entropic's database, settings service, encrypted settings storage, or workspace model.

## Graphify Validation

Graphify runtime proof:

- `.graphify/.graphify_runtime.json` reports `runtime: typescript`.
- Runtime version: `0.4.24`.
- Graph size: 4743 nodes, 6709 edges, 237 communities.

Graphify summary identified `Call LLM` as a key community:

- Community: `Call LLM`.
- Size: 144 nodes, 222 internal edges.
- Top nodes: `index.ts`, `model-catalog.ts`, `callLLM()`.

Graphify review analysis for these current runtime files returned high blast radius:

- `api/src/services/provider-runtime.ts`
- `api/src/services/provider-registry.ts`
- `api/src/services/model-catalog.ts`
- `api/src/services/llm-runtime/index.ts`
- `api/src/services/provider-credentials.ts`
- `api/src/services/provider-connections.ts`
- `api/src/services/codex-provider-auth.ts`

Result:

- Blast radius: high, score 179.
- Impacted files: 26.
- Impacted communities: 5.
- Highest impacted community: `Call LLM`.
- Test-gap hints were surfaced for `provider-runtime.ts`, `model-catalog.ts`, `llm-runtime/index.ts`, `provider-credentials.ts`, `provider-connections.ts`, and `codex-provider-auth.ts`.

Graphify review analysis for provider adapters returned:

- Blast radius: high, score 122.
- Impacted files: 14.
- Impacted communities: 3.
- Bridge node: `GeminiProviderRuntime`.
- Test-gap hint: `api/src/services/providers/openai-provider.ts`.

Interpretation:

- `@entropic/llm-mesh` is not a shallow type extraction. The current code mixes provider contracts, provider SDK adapters, credential resolution, Codex account transport, model selection, schema transforms, streaming normalization, and chat/application orchestration.
- BR-14c should first define the stable package contract and extract reusable primitives. It should avoid broad app rewiring until BR-14b.
- Graphify did not surface every exported function by name. For example, `resolveProviderCredential` was not directly matched as a node, so direct source inspection remains required for function-level precision.

## Current Runtime Inventory

### Provider Runtime Contract

Current file:

- `api/src/services/provider-runtime.ts`

Current exports:

- `ProviderId`
- `ProviderStatus`
- `ReasoningTier`
- `DefaultContext`
- `ProviderCapabilities`
- `ProviderDescriptor`
- `ModelCatalogEntry`
- `CredentialValidationResult`
- `NormalizedProviderError`
- `ProviderRuntime`
- `providerIds`
- `isProviderId`

Reusable in `@entropic/llm-mesh`:

- Provider identifier model.
- Provider descriptor shape.
- Model catalog entry shape.
- Capability flags.
- Reasoning tier abstraction.
- Credential validation result shape.
- Normalized provider error shape.

Needs redesign before package extraction:

- `DefaultContext` is application-oriented (`chat`, `structured`, `summary`, `doc`). The package should expose generic use-case tags or leave context defaults outside core.
- `ProviderRuntime.generate(request: unknown)` and `streamGenerate(request: unknown)` are too weakly typed for a public SDK.
- Capability fields are too coarse for current provider differences. The package needs explicit capabilities for tool calls, streaming tool-call deltas, structured output strategy, reasoning controls, reasoning summaries, multimodal input/output, context window, JSON schema subset, and account transports.

### Provider Registry

Current file:

- `api/src/services/provider-registry.ts`

Current role:

- Instantiates OpenAI, Gemini, Claude, Mistral, and Cohere runtime classes.
- Lists providers and models.
- Resolves providers by ID.

Reusable in `@entropic/llm-mesh`:

- Registry interface.
- Provider/model listing contract.
- Provider resolution semantics.

App-specific until BR-14b:

- Singleton construction.
- Direct dependency on app provider classes.
- Environment-aware provider readiness.

Package direction:

- Expose a registry factory, not an application singleton.
- Let consumers register direct SDK adapters, gateway adapters, or custom adapters.
- Support model aliases without forcing runtime routing in the MVP.

### Model Catalog

Current file:

- `api/src/services/model-catalog.ts`

Current role:

- Maps provider runtime models to API payloads.
- Resolves default provider/model selection from settings.
- Applies legacy model cutover rules.
- Exposes reasoning helpers.

Reusable in `@entropic/llm-mesh`:

- Provider/model selection primitives.
- Capability matrix.
- Reasoning support detection.

App-specific until BR-14b:

- `settingsService` dependency.
- Legacy cutover policy.
- API response snake_case mapping.
- Current app contexts.

Package direction:

- Define a provider-neutral model profile format.
- Keep legacy Entropic model cutovers in the app or a compatibility adapter, not in package core.
- Add a capability source that can be static in MVP and extensible later.

### Provider Adapters

Current files:

- `api/src/services/providers/openai-provider.ts`
- `api/src/services/providers/claude-provider.ts`
- `api/src/services/providers/gemini-provider.ts`
- `api/src/services/providers/mistral-provider.ts`
- `api/src/services/providers/cohere-provider.ts`

Reusable in `@entropic/llm-mesh`:

- Provider model lists as initial static capability data.
- SDK request/stream entry points.
- Error normalization patterns.
- Mocked-client test patterns.

App-specific until BR-14b:

- Imports from `../../config/env`.
- OpenAI Codex fetch wiring embedded inside the OpenAI provider.
- Provider-specific request payload shapes exposed as public request types.
- Credential fallback to process env inside provider classes.

Package direction:

- Adapters should receive credentials/transports through call context or adapter config.
- Codex account transport should be represented as an account transport, not hardwired to OpenAI provider internals.
- Provider-native request types can be allowed through an escape hatch, but the main contract must be normalized.

### LLM Runtime

Current file:

- `api/src/services/llm-runtime/index.ts`

Current exported/publicly useful concepts:

- `CallLLMOptions`
- `CallLLMStreamOptions`
- `StreamEventType`
- `StreamEvent`
- `sanitizeGeminiResponseSchema`
- `buildGeminiRequestBody`
- `callLLM`
- `callLLMStream`

Reusable in `@entropic/llm-mesh`:

- Normalized stream event taxonomy.
- Tool-call normalization rules.
- Structured-output schema sanitizers.
- Provider-specific stream mappers.
- `call` and `stream` facade shape.

App-specific until BR-14b:

- Chat message conversion tied to OpenAI Chat Completions shapes.
- Runtime selection from user/workspace settings.
- Credential resolution from Entropic services.
- Retry and continuation orchestration tied to chat service flow.
- Chat-service context budgeting.
- Direct provider singleton calls.

Package direction:

- Split request compilation from execution.
- Expose normalized events as discriminated unions.
- Keep provider-native chunks available in metadata for debugging and advanced consumers.
- Model tool calls and tool result continuation without assuming OpenAI Responses API.

### Credentials and Account Transports

Current files:

- `api/src/services/provider-credentials.ts`
- `api/src/services/provider-connections.ts`
- `api/src/services/codex-provider-auth.ts`

Current precedence:

- Request override.
- User BYOK.
- Workspace key.
- Environment.
- None.

Reusable in `@entropic/llm-mesh`:

- Auth source enum.
- Resolver contract.
- Account transport shape such as `{ accessToken, accountId }`.
- Transport mode distinction.
- Future account-provider extension point.

App-specific until BR-14b or BR-14d:

- Encrypted settings storage.
- Workspace/user lookup.
- `settingsService` integration.
- Codex device enrollment persistence.
- UI settings routes.
- Secrets and operational OAuth endpoints.

Package direction:

- Core should define auth contracts and transport interfaces.
- Entropic app should implement resolvers.
- Future managed SSO/account flows should be plugins or app-level integrations, not package core.

## External Framework Benchmark

Benchmark date: 2026-04-21.

Only official sources are used for final decisions.

### Cross-Framework Decision Matrix

| System | Primary shape | Strong ideas to reuse | Scope boundary for Entropic |
| --- | --- | --- | --- |
| Vercel AI SDK | TypeScript app SDK | Generation/streaming facade, typed tool lifecycle, provider registry, middleware, telemetry hooks | Good reference for `@entropic/llm-mesh` core API |
| Vercel AI Gateway | Hosted gateway | BYOK, model fallbacks, provider timeouts, spend/model usage logs | Defer hosted gateway behavior; expose metadata/hooks only |
| LangChain JS / LangGraph | Agent/workflow framework | Model profiles, stream modes, structured output strategies | Keep orchestration in `@entropic/flow`, not mesh core |
| Google Gemini / Vertex AI | Provider-native model APIs | Function calling limits, streamed tool arguments, schema subset limits, thinking signatures | Encode as capability metadata and provider adapter behavior |
| LiteLLM | SDK plus proxy/gateway | Virtual keys, budgets, routing, SSO, callbacks, provider failover | Treat as FinOps/gateway inspiration, not MVP package scope |
| Portkey / Cloudflare / OpenRouter / Helicone | Gateways | Fallbacks, retry, cache, cost analytics, OpenAI-compatible routing | Later gateway or deployment layer; package should remain embeddable |
| Langfuse / Braintrust / LangSmith / OpenAI Agents tracing | Observability/evaluation | Trace/span/event model, prompt/eval linkage, redaction needs | Define exporter hooks; do not hardwire one backend |

Decision:

- BR-14c should create a small embeddable SDK contract, not an Entropic-hosted gateway.
- The package must expose enough metadata and lifecycle events for later FinOps and observability.
- Cost accounting, budgets, SSO, gateway-managed virtual keys, persistent traces, and dashboards are separate systems.
- Application-level orchestration remains outside `@entropic/llm-mesh`.

### Vercel AI SDK

Relevant official sources:

- `generateText`: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
- `streamText`: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- Structured output: https://ai-sdk.dev/docs/reference/ai-sdk-core/output
- Tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Reasoning middleware: https://ai-sdk.dev/docs/reference/ai-sdk-core/extract-reasoning-middleware
- Provider registry: https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry
- Telemetry: https://ai-sdk.dev/docs/ai-sdk-core/telemetry
- Error handling: https://ai-sdk.dev/docs/ai-sdk-core/error-handling

Observed design:

- Core functions are centered on `generateText`, `streamText`, structured output, embeddings, image, audio, and video generation.
- Provider management supports custom providers, aliases, model limiting, provider registry, OpenAI-compatible providers, and language model middleware.
- Tool calling is strongly typed and includes tool input lifecycle hooks such as streamed input start/delta/available events.
- Structured output is part of text generation and can be combined with tool calling.
- Telemetry is experimental and OpenTelemetry-based, with explicit per-call enablement and controls for input/output recording.
- Error handling distinguishes simple stream errors from full stream error parts.
- Provider-specific options are available, but the core facade stays provider-neutral.

Implications for Entropic:

- Copy the separation between generation facade, provider registry, and middleware hooks.
- Adopt typed tool-call lifecycle events.
- Keep telemetry as a hook/integration layer in BR-14c, not as a mandatory persistence system.
- Provide provider-specific options without leaking provider-specific request types as the main API.

### Vercel AI Gateway

Relevant official sources:

- Overview: https://vercel.com/docs/ai-gateway
- Provider options: https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
- Model fallbacks: https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks
- Provider timeouts: https://vercel.com/docs/ai-gateway/models-and-providers/provider-timeouts
- Authentication and BYOK: https://vercel.com/docs/ai-gateway/authentication-and-byok
- Observability: https://vercel.com/docs/ai-gateway/capabilities/observability
- Usage: https://vercel.com/docs/ai-gateway/capabilities/usage

Observed design:

- AI Gateway separates hosted routing/reliability from the local SDK facade.
- Gateway behavior includes provider fallbacks, provider-specific timeouts, BYOK, usage, spend logs, and request observability.
- Timeout and fallback behavior can have billing side effects because timed-out provider requests may still be charged depending on provider cancellation behavior.

Implications for Entropic:

- Keep `@entropic/llm-mesh` gateway-compatible but not gateway-owned.
- Add request metadata needed for later gateway routing: correlation ID, tenant/workspace/user IDs, selected model, attempted providers, fallback reason, timing, token usage, and cost estimates.
- Defer persistent gateway state, dashboard, BYOK vault, and org-level spend governance.

### LangChain JS and LangGraph

Relevant official sources:

- LangChain JS models: https://docs.langchain.com/oss/javascript/langchain/models
- LangChain JS structured output: https://docs.langchain.com/oss/javascript/langchain/structured-output
- LangChain JS streaming: https://docs.langchain.com/oss/javascript/langchain/streaming
- LangChain JS observability: https://docs.langchain.com/oss/javascript/langchain/observability
- LangSmith tracing: https://docs.langchain.com/langsmith/trace-with-langchain

Observed design:

- Chat models support `invoke`, `stream`, and `batch`.
- Tool calling is exposed through binding tools to models; parallel tool calls are part of the model abstraction where supported.
- Streaming can expose agent progress, LLM tokens, reasoning tokens, and custom updates through multiple stream modes.
- Structured output supports schemas such as Zod and JSON Schema.
- Model profile data can describe tool calling, structured output, modalities, and token limits.
- Observability is integrated through LangSmith tracing and captures agent/model/tool steps when enabled.

Implications for Entropic:

- Separate model streaming from agent/workflow streaming.
- Adopt model profiles/capability records as first-class data.
- Do not put LangGraph-like orchestration into `llm-mesh`; that belongs to `@entropic/flow`.
- Consider a stream mode abstraction, but keep BR-14c focused on model stream events.
- Keep trace export as a generic hook so LangSmith-style backends remain pluggable.

### Google Vertex AI and Google Gen AI SDK

Relevant official sources:

- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini thinking: https://ai.google.dev/gemini-api/docs/thinking
- Google Gen AI SDK JavaScript: https://github.com/googleapis/js-genai/blob/main/README.md
- Vertex AI function calling: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling
- Vertex AI function calling reference: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling
- Vertex AI structured output: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output
- Vertex AI thinking: https://cloud.google.com/vertex-ai/generative-ai/docs/thinking
- Application Default Credentials: https://cloud.google.com/docs/authentication/provide-credentials-adc

Observed design:

- Function calling uses tool/function declarations and can return structured function call data for application execution.
- Gemini supports parallel function calling on supported models.
- Gemini 3 Pro and later can stream function call arguments with `streamFunctionCallArguments`.
- Structured output uses response schemas, but only a subset of schema fields is supported.
- Thinking models expose thought signatures and thought token counts; thought signatures must be preserved correctly across tool/function turns.
- Vertex AI auth is primarily cloud/project oriented through Google Cloud credentials, service accounts, OAuth, and the Google Gen AI SDK configuration.

Implications for Entropic:

- Capability matrix must represent schema subset limits, streamed tool-call-argument support, parallel tool calls, thought signatures, and thought token accounting.
- Reasoning cannot be a single boolean. It needs controls, summaries, hidden signatures, visible summaries, and usage accounting.
- Google account/service-account auth should be an app or deployment integration, while the package exposes credential/provider hooks.

### LiteLLM

Relevant official sources:

- LiteLLM docs: https://docs.litellm.ai/
- Proxy quick start: https://docs.litellm.ai/docs/proxy/quick_start
- Virtual keys: https://docs.litellm.ai/docs/proxy/virtual_keys
- Reliability: https://docs.litellm.ai/docs/proxy/reliability
- Provider budget routing: https://docs.litellm.ai/docs/proxy/provider_budget_routing
- Cost tracking: https://docs.litellm.ai/docs/proxy/cost_tracking
- Logging: https://docs.litellm.ai/docs/proxy/logging
- Admin UI SSO: https://docs.litellm.ai/docs/proxy/admin_ui_sso

Observed design:

- LiteLLM acts as both SDK and AI gateway/proxy.
- It offers OpenAI-compatible access across many providers.
- Virtual keys track spend and control model access.
- Spend can be tracked by key, user, and team.
- Routing supports model aliases, load balancing, fallback, rate-limit aware routing, latency-based routing, least-busy routing, custom routing, and cost-based routing.
- Observability is callback-based and integrates with tools such as Langfuse, LangSmith, Helicone, Traceloop, Sentry, PostHog, Arize, and OpenTelemetry.
- Admin UI SSO supports providers such as Okta, Google, Microsoft, and generic OAuth/OIDC, with roles and team/org management.

Implications for Entropic:

- LiteLLM is closer to a gateway/FinOps product than a small TypeScript SDK.
- BR-14c should not clone LiteLLM proxy concerns.
- BR-14c should define hooks and metadata needed for later spend tracking, budgets, routing, and observability.
- Managed keys, SSO, roles, team budgets, and admin UI belong outside the package core.

### Gateway and Observability Ecosystem

Relevant official sources:

- Portkey AI Gateway: https://portkey.ai/docs/product/ai-gateway
- Portkey fallbacks: https://portkey.ai/docs/product/ai-gateway/fallbacks
- Cloudflare AI Gateway: https://developers.cloudflare.com/ai-gateway/
- Cloudflare AI Gateway caching: https://developers.cloudflare.com/ai-gateway/features/caching/
- Cloudflare AI Gateway analytics: https://developers.cloudflare.com/ai-gateway/observability/analytics/
- Cloudflare AI Gateway costs: https://developers.cloudflare.com/ai-gateway/observability/costs/
- OpenRouter model routing: https://openrouter.ai/docs/model-routing
- Helicone AI Gateway: https://docs.helicone.ai/gateway/overview
- Helicone caching: https://docs.helicone.ai/features/advanced-usage/caching
- Langfuse overview: https://langfuse.com/docs
- Langfuse observability: https://langfuse.com/docs/observability/overview
- Braintrust observability: https://www.braintrust.dev/docs/observe
- Braintrust playgrounds/evaluations: https://www.braintrust.dev/docs/evaluate/playgrounds
- Mastra observability: https://mastra.ai/observability

Observed design:

- Gateways converge around OpenAI-compatible endpoints, routing/fallbacks, retries, rate limits, caching, BYOK or managed keys, usage logs, and cost dashboards.
- Observability platforms converge around traces, spans, token/cost/latency capture, prompt/version linkage, evaluation datasets, and asynchronous export.
- Some systems combine gateway and observability; others keep SDK, gateway, and observability separate.

Implications for Entropic:

- `llm-mesh` should not own the policy engine, cache store, or trace database.
- `llm-mesh` should emit enough structured events to let a future Entropic gateway, LiteLLM, Portkey, Cloudflare AI Gateway, Langfuse, Braintrust, LangSmith, Helicone, or OpenTelemetry exporter consume the same lifecycle.
- The package contract should include redaction controls before any prompt/completion payload can be exported.

### OpenAI Agents SDK

Relevant official source:

- Tracing: https://openai.github.io/openai-agents-js/guides/tracing/
- Handoffs: https://openai.github.io/openai-agents-js/guides/handoffs/

Observed design:

- Tracing covers agent runs, LLM generations, tool calls, handoffs, guardrails, and custom events.
- Tracing is enabled by default in server runtimes and can be disabled globally or per run.
- Custom trace processors can export traces elsewhere.
- ZDR policy can make tracing unavailable.
- Handoffs are modeled as tool-like transfers between agents.

Implications for Entropic:

- Tracing should be designed as an exportable event/span hook.
- Privacy and zero-retention constraints must be explicit.
- `llm-mesh` should not assume a single hosted trace dashboard.
- Agent handoffs belong in `@entropic/flow`; mesh only needs model/tool event support.

## Recommended Scope Split

## Review Corrections Accepted on 2026-04-22

The BR-14c strategic review confirmed the direction but tightened the public contract before freeze.

### Package Gates

`make typecheck-api` and `make lint-api` do not prove that `packages/llm-mesh` builds or tests. BR-14c must add deterministic package-specific make targets before the public contract is considered validated:

- `make typecheck-llm-mesh`
- `make test-llm-mesh`
- `make lint-llm-mesh` if package linting is not covered by an existing target

These targets are part of BR14c-EX1 because they touch make/build scaffolding, not runtime behavior.

### SDK Facade

The package cannot remain a vocabulary-only extraction. BR-14c must expose a minimal consumable facade:

```ts
const mesh = createLlmMesh({ registry, authResolver, hooks });

await mesh.generate({ model: 'openai:gpt-5.4', messages, tools });
for await (const event of mesh.stream({ providerId: 'google', modelId: 'gemini-3.1-pro-preview', messages })) {
  // normalized stream event
}
```

Required facade behavior:

- Resolve `provider:model` aliases and `{ providerId, modelId }` pairs.
- Resolve auth through an injected `AuthResolver`.
- Validate the selected model profile and fail early when a requested feature is unsupported.
- Delegate to provider adapters.
- Normalize errors, stream events, tool calls, tool results, usage, and finish reasons.
- Apply redaction before hooks or metadata export.

### Capability Matrix Stance

"Less optimistic capability matrix" means the package must not claim provider-wide support for features that are actually model-specific or unverified.

Bad public contract:

```ts
google.supportsTools = true;
google.supportsStructuredOutput = true;
google.supportsReasoning = true;
```

Better public contract:

```ts
gemini31Pro.capabilities.tools.support = 'supported';
gemini31Pro.capabilities.tools.parallelCalls = 'supported';
gemini31Pro.capabilities.tools.streamedArgumentDeltas = 'supported';
geminiFlashLegacy.capabilities.tools.streamedArgumentDeltas = 'unknown';
claudeSonnet.capabilities.structuredOutput.jsonSchema = 'partial';
cohereCommand.capabilities.reasoning = 'unsupported';
```

Required stance:

- Capabilities belong primarily to `ModelProfile`, not to broad `ProviderDescriptor` defaults.
- Every non-trivial feature should be represented as `supported`, `unsupported`, `partial`, or `unknown`; booleans may exist only as derived helpers.
- `unknown` is the default when the behavior has not been verified against official docs or tests.
- `partial` must carry limits, such as unsupported JSON Schema keywords, missing strict mode, no streamed tool argument deltas, no parallel calls, no thought signatures, or provider-specific continuation limits.
- Model IDs must distinguish provider-native model IDs from Entropic aliases.

This avoids over-promising to BR-14b and prevents runtime code from making unsafe assumptions such as "Google supports every tool feature" or "Anthropic structured output is equivalent to OpenAI JSON Schema strict mode."

### Auth Boundary

"Separate server secrets from auth descriptors" means the package needs two distinct shapes:

- `SecretAuthMaterial`: executable credential material used only inside server-side adapters, such as API keys, OAuth access tokens, refresh tokens, account tokens, and provider headers.
- `AuthDescriptor`: redacted metadata safe for events, UI, logs, traces, and browser-safe package subsets, such as source type, provider, account label, expiry presence, and redacted fingerprint.

Rules:

- `AuthResolver` may return secret material to the server-side mesh execution path.
- Public lifecycle events, stream metadata, traces, errors, and usage records must receive only `AuthDescriptor`.
- Browser-safe entry points must never accept or expose refresh tokens, account tokens, or provider API keys unless the caller explicitly opts into a direct client-side provider integration outside Entropic's default path.
- Request-level direct token overrides are allowed for server SDK use, but they must be excluded from exported metadata and must never be copied into provider-native chunks.
- Codex account remains an experimental account transport. Gemini Code Assist and Claude Code remain interface hooks only until a dedicated auth branch defines enrollment and storage.

### Tool and Result Contract

"Strengthen tools/results for MCP and streaming" means the current `ToolResult.output: unknown` shape is too small for modern tool ecosystems.

Required contract direction:

- Tool definitions remain provider-neutral and JSON-Schema based, but can carry provider/MCP annotations.
- Tool-call streaming must distinguish:
  - tool call announced,
  - input argument delta,
  - input available/complete,
  - tool execution result,
  - continuation submitted back to the provider.
- Tool results must support rich content, not just opaque JSON:
  - text content,
  - JSON/structured content,
  - image/audio references,
  - resource links,
  - embedded resources where safe,
  - typed tool errors,
  - annotations such as title, audience, cacheability, sensitivity, and display hints.
- Provider-native call IDs and Entropic call IDs must both be preserved so continuation can resume correctly across OpenAI, Gemini, Anthropic, and MCP-style tools.
- Stream events may keep the current high-level event taxonomy, but the `tool_call_*` payloads must contain enough lifecycle detail to render partial arguments, execute tools deterministically, and continue generation without provider-specific leakage.

BR-14c does not need to implement a full MCP client. It must avoid freezing a contract that would make MCP-compatible tools or streamed tool input lifecycle impossible later.

### BR-14c MVP

- Package boundary for `@entropic/llm-mesh`.
- Public TypeScript contract.
- Provider IDs and model profiles.
- Capability matrix with explicit per-model capabilities.
- Normalized `generate` and `stream` facade.
- Normalized stream events.
- Tool-call and tool-result continuation contract.
- Structured-output contract and schema capability metadata.
- Provider error normalization.
- Auth resolver interface and auth source taxonomy.
- Account transport interface for Codex account mode.
- Correlation IDs and per-call lifecycle events.
- Usage metadata envelope with provider-native raw usage preserved.
- Deterministic unit tests for contracts and stream normalization.
- Thin application proof path only.

### BR-14c Interfaces Only

- Observability hook interface.
- Usage accounting metadata interface.
- Cost metadata fields.
- Routing policy interface.
- Retry/fallback policy interface.
- Cache key metadata interface.
- Redaction policy interface.
- Trace/exporter interface compatible with OpenTelemetry-style spans without depending on OpenTelemetry.
- Future account transport interfaces for Gemini Code Assist and Claude Code.

### BR-14b

- Replace application provider dispatch with the mesh.
- Wire Entropic settings, encrypted credentials, user/workspace keys, and Codex transport into mesh auth resolvers.
- Preserve quotas, retries, streaming, audit, and chat behavior.
- Move provider-specific request compilation into mesh adapters where appropriate.

### BR-14d

- Operational provider/account setup.
- DNS and deployment transition.
- Secrets and environment variable names.
- OAuth callback URLs and allowed redirect URIs.
- Gateway/proxy deployment names if Entropic later adds a hosted mesh gateway.

### Later FinOps and Observability Branch

- Spend tracking persistence.
- Budgets by key/user/workspace/team/org.
- Rate limits and throttling policy.
- Fallback routing based on cost, latency, availability, or quotas.
- Observability storage, dashboards, and admin UI.
- Integration with Langfuse, LangSmith, Helicone, OpenTelemetry, or a custom Entropic trace store.
- Virtual keys or managed gateway keys if Entropic chooses a proxy architecture.

## Open Product Questions

- Q1: Should BR-14c include a minimal executable fallback engine, or only define fallback policy contracts and retryable error metadata?
- Q2: Should JSON Schema be the canonical package schema, with Zod/Pydantic adapters kept peripheral?
- Q3: Is `codex-account` a public v1 auth mode or an experimental Entropic adapter until the account transport contract is stable?
- Q4: How much reasoning should the public contract expose: hidden signatures only, visible summaries, reasoning token counts, or provider-native reasoning payloads?
- Q5: Should streaming expose fine-grained tool-call argument deltas, or a simplified `tool_call_delta` event with provider-native deltas in metadata?
- Q6: Should the first package be Node-only, or include a browser-safe subset with no secret-bearing transports?
- Q7: What is the default redaction policy for prompts, completions, tool payloads, and provider-native chunks before observability export?
- Q8: Should `@entropic/llm-mesh` expose a Vercel-like `generateText` / `streamText` API, or an Entropic-specific `mesh.generate` / `mesh.stream` API?
- Q9: Should model IDs be `provider:model` strings, separate `{ providerId, modelId }` pairs, or both?
- Q10: Should OpenAI-compatible gateways such as LiteLLM/OpenRouter be first-class providers in BR-14c, or deferred as adapter examples?
- Q11: Should app contexts such as `chat`, `summary`, and `doc` remain outside the package, or become generic task profiles?

## Current Recommendation

Use BR-14c to build a small SDK core, not a gateway:

- Core API: normalized generation, streaming, tools, structured output, reasoning controls, provider/model registry, capability matrix, auth hooks.
- Optional hooks: observability, usage, cost metadata, routing policy, retry/fallback policy, redaction policy.
- Deferred systems: SSO, managed virtual keys, budgets, dashboards, persistent traces, billing, and gateway deployment.

This keeps `@entropic/llm-mesh` useful as an npm library while leaving enough contract surface for later FinOps and observability without forcing those systems into the MVP.

import {
  geminiUnsupportedJsonSchemaKeywords,
  type ModelCapabilities,
  type ProviderCapabilities,
} from './capabilities.js';
import type { AccountTransportProviderId, TokenAuthSourceType } from './auth.js';
import type {
  KnownModelId,
  ModelTaskHint,
  ProviderFamily,
  ProviderId,
  ProviderStatus,
  ReasoningTier,
} from './providers.js';

export interface ProviderDescriptor {
  providerId: ProviderId;
  family: ProviderFamily;
  label: string;
  status: ProviderStatus;
  capabilities: ProviderCapabilities;
}

export interface ModelProfile {
  providerId: ProviderId;
  modelId: KnownModelId;
  label: string;
  reasoningTier: ReasoningTier;
  defaultTaskHints: readonly ModelTaskHint[];
  capabilities: ModelCapabilities;
}

const tokenSources = [
  'direct-token',
  'user-token',
  'workspace-token',
  'environment-token',
] as const satisfies readonly TokenAuthSourceType[];

const toolChoice = ['auto', 'required', 'none'] as const;

const textModalities = {
  input: ['text'] as const,
  output: ['text', 'json', 'tool-call'] as const,
};

const auth = (
  accountTransports: readonly AccountTransportProviderId[] = [],
) => ({
  tokenSources,
  accountTransports,
});

const capabilities = (input: {
  reasoningTier: ReasoningTier;
  structuredOutputLevel: ProviderCapabilities['structuredOutput']['jsonSchema']['level'];
  accountTransports?: readonly AccountTransportProviderId[];
  supportsReasoning?: boolean;
  streamedArgumentDeltas?: boolean;
  unsupportedKeywords?: readonly string[];
  stringEnumsOnly?: boolean;
}): ProviderCapabilities => ({
  supportsTools: true,
  supportsStreaming: true,
  supportsStructuredOutput: input.structuredOutputLevel !== 'none',
  supportsReasoning: input.supportsReasoning ?? input.reasoningTier !== 'none',
  tools: {
    supported: true,
    parallelCalls: true,
    streamedArgumentDeltas: input.streamedArgumentDeltas ?? true,
    resultContinuation: true,
    toolChoice,
  },
  streaming: {
    supported: true,
    nativeProviderChunks: true,
  },
  structuredOutput: {
    supported: input.structuredOutputLevel !== 'none',
    strategies: ['json-object', 'json-schema', 'tool-call'],
    jsonSchema: {
      level: input.structuredOutputLevel,
      strict: input.structuredOutputLevel === 'json-schema',
      ...(input.unsupportedKeywords ? { unsupportedKeywords: input.unsupportedKeywords } : {}),
      ...(typeof input.stringEnumsOnly === 'boolean'
        ? { stringEnumsOnly: input.stringEnumsOnly }
        : {}),
    },
  },
  reasoning: {
    tier: input.reasoningTier,
    controls: input.reasoningTier !== 'none',
    visibleSummaries: input.reasoningTier !== 'none',
    hiddenSignatures: input.reasoningTier !== 'none',
    tokenUsageAccounting: input.reasoningTier !== 'none',
  },
  modalities: textModalities,
  auth: auth(input.accountTransports),
});

export const providerProfiles = {
  openai: {
    providerId: 'openai',
    family: 'openai',
    label: 'OpenAI',
    status: 'planned',
    capabilities: capabilities({
      reasoningTier: 'advanced',
      structuredOutputLevel: 'json-schema',
      accountTransports: ['codex'],
    }),
  },
  gemini: {
    providerId: 'gemini',
    family: 'google',
    label: 'Google Gemini',
    status: 'planned',
    capabilities: capabilities({
      reasoningTier: 'advanced',
      structuredOutputLevel: 'json-schema-subset',
      unsupportedKeywords: geminiUnsupportedJsonSchemaKeywords,
      stringEnumsOnly: true,
    }),
  },
  anthropic: {
    providerId: 'anthropic',
    family: 'anthropic',
    label: 'Anthropic Claude',
    status: 'planned',
    capabilities: capabilities({
      reasoningTier: 'advanced',
      structuredOutputLevel: 'tool-input-schema',
    }),
  },
  mistral: {
    providerId: 'mistral',
    family: 'mistral',
    label: 'Mistral AI',
    status: 'planned',
    capabilities: capabilities({
      reasoningTier: 'advanced',
      structuredOutputLevel: 'json-schema',
    }),
  },
  cohere: {
    providerId: 'cohere',
    family: 'cohere',
    label: 'Cohere',
    status: 'planned',
    capabilities: capabilities({
      reasoningTier: 'none',
      structuredOutputLevel: 'tool-input-schema',
      supportsReasoning: false,
    }),
  },
} as const satisfies Record<ProviderId, ProviderDescriptor>;

const modelCapabilities = (
  providerId: ProviderId,
  reasoningTier: ReasoningTier,
): ModelCapabilities => ({
  ...providerProfiles[providerId].capabilities,
  supportsReasoning: reasoningTier !== 'none',
  reasoning: {
    ...providerProfiles[providerId].capabilities.reasoning,
    tier: reasoningTier,
    controls: reasoningTier !== 'none',
    visibleSummaries: reasoningTier !== 'none',
    hiddenSignatures: reasoningTier !== 'none',
    tokenUsageAccounting: reasoningTier !== 'none',
  },
});

export const modelProfiles = [
  {
    providerId: 'openai',
    modelId: 'gpt-5.4',
    label: 'GPT-5.4',
    reasoningTier: 'advanced',
    defaultTaskHints: ['chat', 'structured', 'summary'],
    capabilities: modelCapabilities('openai', 'advanced'),
  },
  {
    providerId: 'openai',
    modelId: 'gpt-5.4-nano',
    label: 'GPT-5.4 Nano',
    reasoningTier: 'standard',
    defaultTaskHints: ['chat'],
    capabilities: modelCapabilities('openai', 'standard'),
  },
  {
    providerId: 'openai',
    modelId: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    reasoningTier: 'none',
    defaultTaskHints: ['doc'],
    capabilities: modelCapabilities('openai', 'none'),
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.1-pro-preview-customtools',
    label: 'Gemini 3.1 Pro',
    reasoningTier: 'advanced',
    defaultTaskHints: ['chat', 'structured', 'summary'],
    capabilities: modelCapabilities('gemini', 'advanced'),
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite',
    reasoningTier: 'standard',
    defaultTaskHints: ['chat'],
    capabilities: modelCapabilities('gemini', 'standard'),
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    reasoningTier: 'standard',
    defaultTaskHints: ['chat', 'structured'],
    capabilities: modelCapabilities('anthropic', 'standard'),
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-opus-4-6',
    label: 'Opus 4.6',
    reasoningTier: 'advanced',
    defaultTaskHints: ['chat', 'structured', 'summary'],
    capabilities: modelCapabilities('anthropic', 'advanced'),
  },
  {
    providerId: 'mistral',
    modelId: 'mistral-small-2603',
    label: 'Mistral Small 4',
    reasoningTier: 'standard',
    defaultTaskHints: ['chat'],
    capabilities: modelCapabilities('mistral', 'standard'),
  },
  {
    providerId: 'mistral',
    modelId: 'magistral-medium-2509',
    label: 'Magistral Medium',
    reasoningTier: 'advanced',
    defaultTaskHints: ['chat', 'structured', 'summary'],
    capabilities: modelCapabilities('mistral', 'advanced'),
  },
  {
    providerId: 'cohere',
    modelId: 'command-a-03-2025',
    label: 'Command A',
    reasoningTier: 'standard',
    defaultTaskHints: ['chat'],
    capabilities: modelCapabilities('cohere', 'standard'),
  },
  {
    providerId: 'cohere',
    modelId: 'command-a-reasoning-08-2025',
    label: 'Command A R.',
    reasoningTier: 'advanced',
    defaultTaskHints: ['chat', 'structured', 'summary'],
    capabilities: modelCapabilities('cohere', 'advanced'),
  },
] as const satisfies readonly ModelProfile[];

export const providerCapabilityMatrix = providerProfiles;

export const modelCapabilityMatrix = modelProfiles;

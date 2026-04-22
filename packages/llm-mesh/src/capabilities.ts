import type {
  AccountTransportProviderId,
  TokenAuthSourceType,
} from './auth.js';
import type { ReasoningTier } from './providers.js';

export type ToolChoiceMode = 'auto' | 'required' | 'none';

export type StructuredOutputStrategy = 'json-object' | 'json-schema' | 'tool-call';

export type JsonSchemaSupportLevel =
  | 'none'
  | 'json-schema'
  | 'json-schema-subset'
  | 'tool-input-schema';

export interface ToolUseCapabilities {
  supported: boolean;
  parallelCalls: boolean;
  streamedArgumentDeltas: boolean;
  resultContinuation: boolean;
  toolChoice: readonly ToolChoiceMode[];
}

export interface StreamingCapabilities {
  supported: boolean;
  nativeProviderChunks: boolean;
}

export interface JsonSchemaCapabilities {
  level: JsonSchemaSupportLevel;
  strict: boolean;
  unsupportedKeywords?: readonly string[];
  stringEnumsOnly?: boolean;
  maxDepth?: number;
}

export interface StructuredOutputCapabilities {
  supported: boolean;
  strategies: readonly StructuredOutputStrategy[];
  jsonSchema: JsonSchemaCapabilities;
}

export interface ReasoningCapabilities {
  tier: ReasoningTier;
  controls: boolean;
  visibleSummaries: boolean;
  hiddenSignatures: boolean;
  tokenUsageAccounting: boolean;
}

export interface ModalityCapabilities {
  input: readonly ('text' | 'image' | 'audio' | 'file')[];
  output: readonly ('text' | 'json' | 'tool-call')[];
}

export interface AuthCapabilities {
  tokenSources: readonly TokenAuthSourceType[];
  accountTransports: readonly AccountTransportProviderId[];
}

export interface ProviderCapabilities {
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsReasoning: boolean;
  tools: ToolUseCapabilities;
  streaming: StreamingCapabilities;
  structuredOutput: StructuredOutputCapabilities;
  reasoning: ReasoningCapabilities;
  modalities: ModalityCapabilities;
  auth: AuthCapabilities;
}

export interface ModelCapabilities extends ProviderCapabilities {
  contextWindowTokens?: number;
  maxOutputTokens?: number;
}

export const geminiUnsupportedJsonSchemaKeywords = [
  'additionalProperties',
  'unevaluatedProperties',
  'patternProperties',
  'propertyNames',
  'contains',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  '$schema',
  '$id',
  '$anchor',
  '$comment',
] as const;

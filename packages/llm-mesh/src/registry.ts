import type { AuthResolution, AuthSource } from './auth.js';
import type { GenerateRequest, GenerateResponse, StreamRequest, StreamResult } from './generation.js';
import type { ModelProfile, ProviderDescriptor } from './catalog.js';
import type { ProviderId } from './providers.js';
import type { NormalizedProviderError } from './streaming.js';

export interface CredentialValidationResult {
  ok: boolean;
  message?: string;
}

export interface ProviderRuntimeContext {
  auth?: AuthSource | AuthResolution;
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly provider: ProviderDescriptor;
  listModels(): readonly ModelProfile[];
  generate(request: GenerateRequest, context?: ProviderRuntimeContext): Promise<GenerateResponse>;
  stream(request: StreamRequest, context?: ProviderRuntimeContext): Promise<StreamResult>;
  validateAuth(source?: AuthSource | AuthResolution): CredentialValidationResult;
  normalizeError(error: unknown): NormalizedProviderError;
}

export interface ProviderRegistry {
  listProviders(): readonly ProviderDescriptor[];
  listModels(): readonly ModelProfile[];
  getProvider(providerId: ProviderId): ProviderAdapter | null;
  requireProvider(providerId: ProviderId): ProviderAdapter;
}

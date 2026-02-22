import { env } from '../../config/env';
import type {
  CredentialValidationResult,
  ModelCatalogEntry,
  NormalizedProviderError,
  ProviderDescriptor,
  ProviderRuntime,
} from '../provider-runtime';

const GEMINI_MODELS: ModelCatalogEntry[] = [
  {
    providerId: 'gemini',
    modelId: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    reasoningTier: 'standard',
    supportsTools: true,
    supportsStreaming: true,
    defaultContexts: ['chat'],
  },
  {
    providerId: 'gemini',
    modelId: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    reasoningTier: 'advanced',
    supportsTools: true,
    supportsStreaming: true,
    defaultContexts: ['structured', 'summary'],
  },
];

export class GeminiProviderRuntime implements ProviderRuntime {
  readonly provider: ProviderDescriptor;

  constructor() {
    this.provider = {
      providerId: 'gemini',
      label: 'Google Gemini',
      status: 'planned',
      capabilities: {
        supportsTools: true,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        supportsReasoning: true,
      },
    };
  }

  listModels(): ModelCatalogEntry[] {
    return GEMINI_MODELS;
  }

  validateCredential(credential?: string): CredentialValidationResult {
    const apiKey = credential || env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        ok: false,
        message: 'Gemini API key is not configured',
      };
    }

    return { ok: true };
  }

  normalizeError(error: unknown): NormalizedProviderError {
    const message =
      (error instanceof Error && error.message) ||
      'Gemini request failed';

    return {
      providerId: 'gemini',
      message,
    };
  }

  async generate(): Promise<unknown> {
    throw new Error('Gemini runtime is planned for Lot 2');
  }

  async streamGenerate(): Promise<AsyncIterable<unknown>> {
    throw new Error('Gemini runtime is planned for Lot 2');
  }
}

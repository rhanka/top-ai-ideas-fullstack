import { describe, expect, it } from 'vitest';

import { createApiMeshContractProof } from '../../src/services/llm-runtime/mesh-contract-proof';

describe('API LLM mesh contract proof', () => {
  it('loads the package mesh contract from the API runtime boundary', () => {
    const proof = createApiMeshContractProof();

    expect(proof.providers).toEqual(
      expect.arrayContaining(['openai', 'gemini', 'anthropic', 'mistral', 'cohere']),
    );
    expect(proof.providers).toHaveLength(5);
    expect(proof.modelCount).toBeGreaterThanOrEqual(10);
    expect(proof.mesh.listModels().some((model) => model.modelId === 'gpt-5.4')).toBe(true);
  });
});

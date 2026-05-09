import {
  createDefaultProviderAdapters,
  createLlmMesh,
  createProviderRegistry,
  type LlmMesh,
  type ProviderId,
} from '@entropic/llm-mesh';

export type ApiMeshContractProof = {
  providers: readonly ProviderId[];
  modelCount: number;
  mesh: Pick<LlmMesh, 'listProviders' | 'listModels'>;
};

export const createApiMeshContractProof = (): ApiMeshContractProof => {
  const mesh = createLlmMesh({
    registry: createProviderRegistry(createDefaultProviderAdapters()),
  });

  return {
    providers: mesh.listProviders().map((provider) => provider.providerId),
    modelCount: mesh.listModels().length,
    mesh,
  };
};

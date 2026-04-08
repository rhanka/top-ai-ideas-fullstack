const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../ui/src/lib/utils/provider-connections-api.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "providerId: 'codex' | 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'cohere';",
  "providerId: 'codex' | 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'cohere' | 'google';"
);

const newCode = `
export const startGoogleProviderEnrollment = async (input: {
  accountLabel?: string | null;
}): Promise<ProviderConnectionState> =>
  startGoogleProviderEnrollmentWith(input, (path, body) =>
    apiPost<{ provider: ProviderConnectionState }>(path, body ?? {}),
  );

export const startGoogleProviderEnrollmentWith = async (
  input: {
    accountLabel?: string | null;
  },
  requester: ProviderConnectionsPostRequester,
): Promise<ProviderConnectionState> => {
  const payload = await requester('/settings/provider-connections/google/enrollment/start', {
    accountLabel: input.accountLabel ?? null,
  });
  return payload.provider;
};

export const completeGoogleProviderEnrollment = async (input: {
  enrollmentId: string;
  pastedUrl: string;
  accountLabel?: string | null;
}): Promise<ProviderConnectionState> =>
  completeGoogleProviderEnrollmentWith(input, (path, body) =>
    apiPost<{ provider: ProviderConnectionState }>(path, body ?? {}),
  );

export const completeGoogleProviderEnrollmentWith = async (
  input: {
    enrollmentId: string;
    pastedUrl: string;
    accountLabel?: string | null;
  },
  requester: ProviderConnectionsPostRequester,
): Promise<ProviderConnectionState> => {
  const payload = await requester('/settings/provider-connections/google/enrollment/complete', {
    enrollmentId: input.enrollmentId,
    pastedUrl: input.pastedUrl,
    accountLabel: input.accountLabel ?? null,
  });
  return payload.provider;
};

export const disconnectGoogleProviderEnrollment = async (): Promise<ProviderConnectionState> =>
  disconnectGoogleProviderEnrollmentWith((path, body) =>
    apiPost<{ provider: ProviderConnectionState }>(path, body ?? {}),
  );

export const disconnectGoogleProviderEnrollmentWith = async (
  requester: ProviderConnectionsPostRequester,
): Promise<ProviderConnectionState> => {
  const payload = await requester('/settings/provider-connections/google/enrollment/disconnect');
  return payload.provider;
};
`;

content += '\n' + newCode;
fs.writeFileSync(filePath, content, 'utf8');
console.log('UI API patch complete.');

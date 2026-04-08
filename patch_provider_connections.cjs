const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../api/src/services/provider-connections.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const imports = `
import {
  completeGoogleDeviceEnrollment,
  startGoogleDeviceEnrollment,
  type GoogleEnrollmentResult,
} from './google-provider-auth';
`;
content = content.replace("import { settingsService } from './settings';", "import { settingsService } from './settings';" + imports);

// 2. Add 'google' to ProviderConnectionId
content = content.replace(
  "export type ProviderConnectionId = 'codex' | 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'cohere';",
  "export type ProviderConnectionId = 'codex' | 'openai' | 'gemini' | 'anthropic' | 'mistral' | 'cohere' | 'google';"
);

// 3. Add Google payload types
const googleTypes = `
type GoogleConnectionPayload = {
  status: 'connected' | 'pending' | 'disconnected';
  enrollmentId: string | null;
  enrollmentUrl: string | null;
  enrollmentCode: string | null;
  enrollmentExpiresAt: string | null;
  accountLabel: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

type GooglePendingEnrollmentPayload = {
  enrollmentId: string;
  codeVerifier: string;
  state: string;
  expectedAccountLabel: string | null;
};

type GoogleConnectedSecret = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accountLabel: string | null;
  connectedAt: string;
};

const GOOGLE_CONNECTION_SETTINGS_KEY = 'provider_connection:google';
const GOOGLE_CONNECTION_PENDING_SECRET_KEY = 'provider_connection_secret:google_pending';
const GOOGLE_CONNECTION_SECRET_KEY = 'provider_connection_secret:google';
`;
content = content.replace("const CODEX_CONNECTION_SETTINGS_KEY", googleTypes + "\nconst CODEX_CONNECTION_SETTINGS_KEY");

// 4. Add parseGoogleConnectionPayload
const parseGoogleConnectionPayload = `
const parseGoogleConnectionPayload = (
  raw: string | null,
): GoogleConnectionPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleConnectionPayload> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const statusRaw = normalizeText(parsed.status).toLowerCase();
    const status: GoogleConnectionPayload['status'] =
      statusRaw === 'connected' || statusRaw === 'pending' || statusRaw === 'disconnected'
        ? (statusRaw as GoogleConnectionPayload['status'])
        : 'disconnected';
    return {
      status,
      enrollmentId: normalizeOptionalText(parsed.enrollmentId),
      enrollmentUrl: normalizeOptionalText(parsed.enrollmentUrl),
      enrollmentCode: normalizeOptionalText(parsed.enrollmentCode),
      enrollmentExpiresAt: normalizeOptionalText(parsed.enrollmentExpiresAt),
      accountLabel: normalizeOptionalText(parsed.accountLabel),
      updatedAt: normalizeOptionalText(parsed.updatedAt),
      updatedByUserId: normalizeOptionalText(parsed.updatedByUserId),
    };
  } catch {
    return null;
  }
};
`;
content = content.replace("const parseSecretPayload = ", parseGoogleConnectionPayload + "\nconst parseSecretPayload = ");

// 5. Add readGoogleConnection and write functions
const googleStorageFuncs = `
const readGoogleConnection = async (userId: string): Promise<GoogleConnectionPayload | null> => {
  const raw = await settingsService.get(GOOGLE_CONNECTION_SETTINGS_KEY, {
    userId,
    fallbackToGlobal: false,
  });
  return parseGoogleConnectionPayload(raw);
};

const readGooglePendingEnrollment = async (
  userId: string,
): Promise<GooglePendingEnrollmentPayload | null> => {
  const raw = await settingsService.get(GOOGLE_CONNECTION_PENDING_SECRET_KEY, {
    userId,
    fallbackToGlobal: false,
  });
  return parseSecretPayload<GooglePendingEnrollmentPayload>(raw);
};

const writeGoogleConnection = async (
  userId: string,
  payload: GoogleConnectionPayload,
): Promise<void> => {
  await settingsService.set(
    GOOGLE_CONNECTION_SETTINGS_KEY,
    JSON.stringify(payload),
    'Google provider connection state for the current admin user.',
    { userId },
  );
};

const deleteGoogleSecrets = async (userId: string): Promise<void> => {
  await Promise.all([
    deleteUserScopedSetting(userId, GOOGLE_CONNECTION_PENDING_SECRET_KEY),
    deleteUserScopedSetting(userId, GOOGLE_CONNECTION_SECRET_KEY),
  ]);
};
`;
content = content.replace("const writeEncryptedSetting = ", googleStorageFuncs + "\nconst writeEncryptedSetting = ");

// 6. Add toGoogleProviderState and inferGoogleAccountLabel
const googleHelpers = `
const toGoogleProviderState = (
  connection: GoogleConnectionPayload | null,
): ProviderConnectionState => {
  const status = connection?.status ?? 'disconnected';
  const ready = status === 'connected';
  return {
    providerId: 'google',
    label: 'Google Cloud (SSO)',
    ready,
    connectionStatus: status,
    enrollmentId: connection?.enrollmentId ?? null,
    enrollmentUrl: connection?.enrollmentUrl ?? null,
    enrollmentCode: connection?.enrollmentCode ?? null,
    enrollmentExpiresAt: connection?.enrollmentExpiresAt ?? null,
    managedBy: status === 'disconnected' ? 'none' : 'admin_settings',
    accountLabel: connection?.accountLabel ?? null,
    updatedAt: connection?.updatedAt ?? null,
    updatedByUserId: connection?.updatedByUserId ?? null,
    canConfigure: true,
  };
};

const inferGoogleAccountLabel = (
  result: GoogleEnrollmentResult,
  fallbackLabel: string | null,
): string | null => {
  const claims = decodeJwtPayload(result.idToken);
  const email =
    normalizeOptionalText(claims?.email) ||
    normalizeOptionalText(claims?.preferred_username) ||
    normalizeOptionalText(claims?.name);
  return email || fallbackLabel;
};
`;
content = content.replace("const assertExpectedAccountLabel = ", googleHelpers + "\nconst assertExpectedAccountLabel = ");

// 7. Update listProviderConnections
content = content.replace(
  "const [codexConnection, openaiCredential, geminiCredential, anthropicCredential, mistralCredential, cohereCredential] = await Promise.all([",
  "const [codexConnection, googleConnection, openaiCredential, geminiCredential, anthropicCredential, mistralCredential, cohereCredential] = await Promise.all(["
);
content = content.replace(
  "userId ? readCodexConnection(userId) : Promise.resolve(null),",
  "userId ? readCodexConnection(userId) : Promise.resolve(null),\n    userId ? readGoogleConnection(userId) : Promise.resolve(null),"
);
content = content.replace(
  "toCodexProviderState(codexConnection),",
  "toCodexProviderState(codexConnection),\n    toGoogleProviderState(googleConnection),"
);

// 8. Add exported google enrollment functions at the end
const exportedGoogleFuncs = `
export const resolveConnectedGoogleTransport = async (
  userId: string,
): Promise<{ accessToken: string; accountId: string | null } | null> => {
  const secret = parseSecretPayload<GoogleConnectedSecret>(
    await settingsService.get(GOOGLE_CONNECTION_SECRET_KEY, { userId, fallbackToGlobal: false }),
  );
  const accessToken = normalizeOptionalText(secret?.accessToken);
  if (!accessToken) return null;
  return {
    accessToken,
    accountId: inferGoogleAccountLabel({ idToken: secret.idToken } as any, secret.accountLabel),
  };
};

export const startGoogleEnrollment = async (input: {
  accountLabel?: string | null;
  updatedByUserId: string;
}): Promise<ProviderConnectionState> => {
  const enrollment = await startGoogleDeviceEnrollment();
  const enrollmentId = createId();
  const accountLabel = normalizeOptionalText(input.accountLabel);
  const now = new Date().toISOString();
  const visible: GoogleConnectionPayload = {
    status: 'pending',
    enrollmentId,
    enrollmentUrl: enrollment.verificationUrl,
    enrollmentCode: null,
    enrollmentExpiresAt: null,
    accountLabel,
    updatedAt: now,
    updatedByUserId: normalizeOptionalText(input.updatedByUserId),
  };
  const secret: GooglePendingEnrollmentPayload = {
    enrollmentId,
    codeVerifier: enrollment.codeVerifier,
    state: enrollment.state,
    expectedAccountLabel: accountLabel,
  };

  await Promise.all([
    deleteGoogleSecrets(input.updatedByUserId),
    writeGoogleConnection(input.updatedByUserId, visible),
    writeEncryptedSetting(
      input.updatedByUserId,
      GOOGLE_CONNECTION_PENDING_SECRET_KEY,
      secret,
      'Pending Google enrollment secret for the current admin user.',
    ),
  ]);

  return toGoogleProviderState(visible);
};

export const completeGoogleEnrollment = async (input: {
  enrollmentId: string;
  pastedUrl: string;
  accountLabel?: string | null;
  updatedByUserId: string;
}): Promise<ProviderConnectionState> => {
  const [current, pending] = await Promise.all([
    readGoogleConnection(input.updatedByUserId),
    readGooglePendingEnrollment(input.updatedByUserId),
  ]);

  if (!current || current.status !== 'pending' || current.enrollmentId !== input.enrollmentId) {
    throw new Error('Invalid or expired Google enrollment session.');
  }
  if (!pending || pending.enrollmentId !== input.enrollmentId) {
    throw new Error('Missing pending Google enrollment state.');
  }

  const result = await completeGoogleDeviceEnrollment(input.pastedUrl, {
    codeVerifier: pending.codeVerifier,
    state: pending.state,
  });

  const requestedAccountLabel =
    normalizeOptionalText(input.accountLabel) || pending.expectedAccountLabel;
  const connectedAccountLabel = inferGoogleAccountLabel(result, requestedAccountLabel);
  
  if (requestedAccountLabel && connectedAccountLabel && requestedAccountLabel.toLowerCase() !== connectedAccountLabel.toLowerCase()) {
    throw new Error(\`Connected Google account mismatch: expected \${requestedAccountLabel}, got \${connectedAccountLabel}.\`);
  }

  const now = new Date().toISOString();
  const visible: GoogleConnectionPayload = {
    status: 'connected',
    enrollmentId: null,
    enrollmentUrl: null,
    enrollmentCode: null,
    enrollmentExpiresAt: null,
    accountLabel: connectedAccountLabel,
    updatedAt: now,
    updatedByUserId: normalizeOptionalText(input.updatedByUserId),
  };
  const secret: GoogleConnectedSecret = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    idToken: result.idToken,
    accountLabel: connectedAccountLabel,
    connectedAt: now,
  };

  await Promise.all([
    deleteUserScopedSetting(input.updatedByUserId, GOOGLE_CONNECTION_PENDING_SECRET_KEY),
    writeGoogleConnection(input.updatedByUserId, visible),
    writeEncryptedSetting(
      input.updatedByUserId,
      GOOGLE_CONNECTION_SECRET_KEY,
      secret,
      'Google provider credential for the current admin user.',
    ),
  ]);

  return toGoogleProviderState(visible);
};

export const disconnectGoogleEnrollment = async (input: {
  updatedByUserId: string;
}): Promise<ProviderConnectionState> => {
  const next: GoogleConnectionPayload = {
    status: 'disconnected',
    enrollmentId: null,
    enrollmentUrl: null,
    enrollmentCode: null,
    enrollmentExpiresAt: null,
    accountLabel: null,
    updatedAt: new Date().toISOString(),
    updatedByUserId: normalizeOptionalText(input.updatedByUserId),
  };

  await Promise.all([
    writeGoogleConnection(input.updatedByUserId, next),
    deleteGoogleSecrets(input.updatedByUserId),
  ]);

  return toGoogleProviderState(next);
};
`;
content += "\n" + exportedGoogleFuncs;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patch complete.');

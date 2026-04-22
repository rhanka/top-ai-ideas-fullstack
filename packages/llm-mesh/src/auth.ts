import type { ModelId, ProviderId } from './providers.js';

export const tokenAuthSourceTypes = [
  'direct-token',
  'user-token',
  'workspace-token',
  'environment-token',
] as const;

export type TokenAuthSourceType = (typeof tokenAuthSourceTypes)[number];

export const accountTransportProviderIds = [
  'codex',
  'gemini-code-assist',
  'claude-code',
] as const;

export type AccountTransportProviderId = (typeof accountTransportProviderIds)[number];

export type AuthSourceType = TokenAuthSourceType | 'codex-account' | 'account-transport' | 'none';

export interface DirectTokenAuthSource {
  type: 'direct-token';
  token: string;
  label?: string;
}

export interface UserTokenAuthSource {
  type: 'user-token';
  userId: string;
  token?: string;
  tokenRef?: string;
  label?: string;
}

export interface WorkspaceTokenAuthSource {
  type: 'workspace-token';
  workspaceId: string;
  token?: string;
  tokenRef?: string;
  label?: string;
}

export interface EnvironmentTokenAuthSource {
  type: 'environment-token';
  envVar: string;
  token?: string;
  label?: string;
}

export interface CodexAccountAuthSource {
  type: 'codex-account';
  provider: 'codex';
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  accountId?: string | null;
  accountLabel?: string | null;
  expiresAt?: string | null;
}

export interface FutureAccountTransportAuthSource {
  type: 'account-transport';
  provider: Exclude<AccountTransportProviderId, 'codex'> | (string & {});
  status: 'planned';
  accessToken?: string;
  refreshToken?: string;
  accountId?: string | null;
  accountLabel?: string | null;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface NoAuthSource {
  type: 'none';
}

export type AuthSource =
  | DirectTokenAuthSource
  | UserTokenAuthSource
  | WorkspaceTokenAuthSource
  | EnvironmentTokenAuthSource
  | CodexAccountAuthSource
  | FutureAccountTransportAuthSource
  | NoAuthSource;

export interface AuthResolutionRequest {
  providerId: ProviderId;
  modelId?: ModelId;
  userId?: string | null;
  workspaceId?: string | null;
  preferredSources?: readonly AuthSourceType[];
  requestToken?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuthResolution {
  source: AuthSource;
  redactedLabel?: string;
}

export type AuthResolver = (
  request: AuthResolutionRequest,
) => AuthResolution | Promise<AuthResolution>;

export const futureAccountTransportProviderIds = [
  'gemini-code-assist',
  'claude-code',
] as const satisfies readonly AccountTransportProviderId[];

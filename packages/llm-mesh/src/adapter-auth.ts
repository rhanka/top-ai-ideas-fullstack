import type { AuthResolution, AuthSource } from './auth.js';

const hasText = (value: string | null | undefined): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

const unwrapAuthSource = (source?: AuthSource | AuthResolution): AuthSource | undefined => {
  return source && 'source' in source ? source.source : source;
};

export const validateAdapterAuthSource = (
  input?: AuthSource | AuthResolution,
): { ok: boolean; message?: string } => {
  const source = unwrapAuthSource(input);
  if (!source || source.type === 'none') {
    return { ok: false, message: 'Provider auth source is not configured' };
  }

  if (source.type === 'direct-token') {
    return hasText(source.token)
      ? { ok: true }
      : { ok: false, message: 'Direct provider token is empty' };
  }

  if (source.type === 'user-token' || source.type === 'workspace-token') {
    return hasText(source.token) || hasText(source.tokenRef)
      ? { ok: true }
      : { ok: false, message: `${source.type} is missing token or tokenRef` };
  }

  if (source.type === 'environment-token') {
    return hasText(source.token) || hasText(source.envVar)
      ? { ok: true }
      : { ok: false, message: 'Environment token source is missing envVar' };
  }

  if (source.type === 'codex-account') {
    return hasText(source.accessToken)
      ? { ok: true }
      : { ok: false, message: 'Codex account access token is empty' };
  }

  return {
    ok: false,
    message: `${source.provider} account transport is planned, not executable`,
  };
};

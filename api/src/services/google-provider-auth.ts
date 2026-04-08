import crypto from 'crypto';

const GOOGLE_AUTH_ISSUER = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CLIENT_ID = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI = 'http://127.0.0.1:8709/callback';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'profile'
].join(' ');

export type GoogleEnrollmentPending = {
  codeVerifier: string;
  state: string;
};

export type GoogleEnrollmentResult = {
  status: 'connected';
  idToken: string;
  accessToken: string;
  refreshToken: string;
};

const readJsonOrThrow = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string | { message?: string }; message?: string; error_description?: string }
    | null;
  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object'
        ? (payload as {
            error?: string | { message?: string };
            message?: string;
            error_description?: string;
          })
        : null;
    const message =
      typeof errorPayload?.error === 'string'
        ? errorPayload.error
        : errorPayload?.error &&
            typeof errorPayload.error === 'object' &&
            typeof errorPayload.error.message === 'string'
          ? errorPayload.error.message
          : errorPayload?.error_description || errorPayload?.message || null;
    throw new Error(message || fallbackMessage);
  }
  return payload as T;
};

const generateCodeVerifier = () => {
  return crypto.randomBytes(32).toString('base64url');
};

const generateCodeChallenge = (verifier: string) => {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
};

export const startGoogleDeviceEnrollment = async (): Promise<{
  verificationUrl: string;
  codeVerifier: string;
  state: string;
}> => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent'
  });

  return {
    verificationUrl: `${GOOGLE_AUTH_ISSUER}?${params.toString()}`,
    codeVerifier,
    state
  };
};

export const completeGoogleDeviceEnrollment = async (
  pastedUrl: string,
  pending: GoogleEnrollmentPending
): Promise<GoogleEnrollmentResult> => {
  let url: URL;
  try {
    url = new URL(pastedUrl);
  } catch {
    throw new Error('Invalid URL format. Please paste the exact URL from your browser address bar.');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    throw new Error(`Google authorization failed: ${error}`);
  }

  if (!code) {
    throw new Error('Google authorization URL does not contain a code parameter. Make sure you authorized the application.');
  }

  if (state !== pending.state) {
    throw new Error('Google authorization state mismatch. The session might have expired or been manipulated.');
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: GOOGLE_REDIRECT_URI,
    code_verifier: pending.codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  const payload = await readJsonOrThrow<{
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  }>(response, 'Google token exchange failed.');

  if (!payload.id_token || !payload.access_token || !payload.refresh_token) {
    throw new Error('Google token exchange returned an incomplete credential set. Please ensure you consent to all requested permissions.');
  }

  return {
    status: 'connected',
    idToken: payload.id_token,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  };
};
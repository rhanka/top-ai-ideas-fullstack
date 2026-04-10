import { OAuth2Client } from 'google-auth-library';
import { GEMINI_OAUTH_CLIENT_ID, GEMINI_OAUTH_CLIENT_SECRET } from '../generated/gemini-oauth-credentials';
import { createId } from '../utils/id';

const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_API_VERSION = 'v1internal';

export type GoogleCodeAssistTransport = {
  accessToken: string;
  refreshToken: string;
  projectId: string;
  accountId: string | null;
};

const buildOAuth2Client = (transport: GoogleCodeAssistTransport): OAuth2Client => {
  const client = new OAuth2Client({
    clientId: GEMINI_OAUTH_CLIENT_ID,
    clientSecret: GEMINI_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({
    access_token: transport.accessToken,
    refresh_token: transport.refreshToken,
  });
  return client;
};

const getMethodUrl = (method: string): string => {
  return `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`;
};

const wrapRequestBody = (
  model: string,
  body: Record<string, unknown>,
  projectId: string,
  sessionId: string,
): Record<string, unknown> => {
  return {
    model,
    project: projectId,
    user_prompt_id: createId(),
    request: {
      ...body,
      session_id: sessionId,
    },
  };
};

const unwrapResponseChunk = (chunk: Record<string, unknown>): Record<string, unknown> => {
  const inner = chunk.response as Record<string, unknown> | undefined;
  if (!inner) {
    return { candidates: [] };
  }
  return inner;
};

export const codeAssistGenerate = async (
  model: string,
  body: Record<string, unknown>,
  transport: GoogleCodeAssistTransport,
  signal?: AbortSignal,
): Promise<unknown> => {
  const client = buildOAuth2Client(transport);
  const sessionId = `gemini_${Date.now().toString(36)}`;
  const wrapped = wrapRequestBody(model, body, transport.projectId, sessionId);

  const headers = await client.getRequestHeaders(getMethodUrl('generateContent'));
  const response = await fetch(getMethodUrl('generateContent'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(wrapped),
    signal,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Code Assist request failed (${response.status}): ${raw.slice(0, 500)}`);
  }

  const result = await response.json() as Record<string, unknown>;
  return unwrapResponseChunk(result);
};

export const codeAssistStreamGenerate = async (
  model: string,
  body: Record<string, unknown>,
  transport: GoogleCodeAssistTransport,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> => {
  const client = buildOAuth2Client(transport);
  const sessionId = `gemini_${Date.now().toString(36)}`;
  const wrapped = wrapRequestBody(model, body, transport.projectId, sessionId);

  const url = new URL(getMethodUrl('streamGenerateContent'));
  url.searchParams.set('alt', 'sse');

  const headers = await client.getRequestHeaders(url.toString());
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(wrapped),
    signal,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Code Assist stream request failed (${response.status}): ${raw.slice(0, 500)}`);
  }

  if (!response.body) {
    return emptyStream();
  }

  return unwrapSseStream(response.body);
};

async function* emptyStream(): AsyncGenerator<unknown> {
  return;
}

async function* unwrapSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    while (true) {
      const boundary = findSseBoundary(buffer);
      if (!boundary) break;
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary.length);
      const parsed = parseSseEvent(rawEvent);
      if (parsed !== null) {
        // Unwrap the Code Assist envelope
        yield unwrapResponseChunk(parsed as Record<string, unknown>);
      }
    }
  }

  buffer += decoder.decode();
  const trailing = parseSseEvent(buffer);
  if (trailing !== null) {
    yield unwrapResponseChunk(trailing as Record<string, unknown>);
  }
}

function parseSseEvent(rawEvent: string): unknown | null {
  const normalized = rawEvent.replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;
  const lines = normalized
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  if (lines.length === 0) return null;
  const payload = lines.join('\n').trim();
  if (!payload || payload === '[DONE]') return null;
  return JSON.parse(payload) as unknown;
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
  const separators = ['\r\n\r\n', '\n\n', '\r\r'] as const;
  let boundaryIndex = -1;
  let boundaryLength = 0;
  for (const separator of separators) {
    const index = buffer.indexOf(separator);
    if (index >= 0 && (boundaryIndex < 0 || index < boundaryIndex)) {
      boundaryIndex = index;
      boundaryLength = separator.length;
    }
  }
  return boundaryIndex < 0 ? null : { index: boundaryIndex, length: boundaryLength };
}

/**
 * Call loadCodeAssist to obtain the managed projectId and user tier.
 * This should be called once during enrollment completion.
 */
export const loadCodeAssistProject = async (
  accessToken: string,
  refreshToken: string,
): Promise<{ projectId: string; userTier: string }> => {
  const client = new OAuth2Client({
    clientId: GEMINI_OAUTH_CLIENT_ID,
    clientSecret: GEMINI_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const headers = await client.getRequestHeaders(getMethodUrl('loadCodeAssist'));
  const response = await fetch(getMethodUrl('loadCodeAssist'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      metadata: {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Code Assist loadCodeAssist failed (${response.status}): ${raw.slice(0, 500)}`);
  }

  const data = await response.json() as Record<string, unknown>;

  // Check if user has a current tier (already onboarded)
  const currentTier = data.currentTier as Record<string, unknown> | undefined;
  const cloudaicompanionProject = data.cloudaicompanionProject as string | undefined;

  if (currentTier && cloudaicompanionProject) {
    return {
      projectId: cloudaicompanionProject,
      userTier: (currentTier.id as string) || 'STANDARD',
    };
  }

  // Need to onboard — find default free tier
  const allowedTiers = data.allowedTiers as Array<Record<string, unknown>> | undefined;
  const freeTier = allowedTiers?.find((t) => t.isDefault) || allowedTiers?.[0];
  const tierId = (freeTier?.id as string) || 'FREE';

  // Onboard the user
  const onboardHeaders = await client.getRequestHeaders(getMethodUrl('onboardUser'));
  const onboardResponse = await fetch(getMethodUrl('onboardUser'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...onboardHeaders,
    },
    body: JSON.stringify({
      tierId,
      metadata: {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
      },
    }),
  });

  if (!onboardResponse.ok) {
    const raw = await onboardResponse.text().catch(() => '');
    throw new Error(`Code Assist onboardUser failed (${onboardResponse.status}): ${raw.slice(0, 500)}`);
  }

  let lroRes = await onboardResponse.json() as Record<string, unknown>;

  // Poll long-running operation if needed
  while (!lroRes.done && lroRes.name) {
    await new Promise((f) => setTimeout(f, 5000));
    const opHeaders = await client.getRequestHeaders(
      `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}/${lroRes.name}`
    );
    const opResponse = await fetch(
      `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}/${lroRes.name}`,
      { headers: { ...opHeaders } },
    );
    lroRes = await opResponse.json() as Record<string, unknown>;
  }

  const lroResponse = lroRes.response as Record<string, unknown> | undefined;
  const projectFromLro = lroResponse?.cloudaicompanionProject as Record<string, unknown> | undefined;
  const projectId = (projectFromLro?.id as string) || '';

  if (!projectId) {
    throw new Error('Code Assist onboarding did not return a project ID. Your account may require setting GOOGLE_CLOUD_PROJECT.');
  }

  return { projectId, userTier: tierId };
};

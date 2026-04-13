import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';
import * as readline from 'node:readline';
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

const getMethodUrl = (method: string): string =>
  `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`;

const wrapRequestBody = (
  model: string,
  body: Record<string, unknown>,
  projectId: string,
  sessionId: string,
): string =>
  JSON.stringify({
    model,
    project: projectId,
    user_prompt_id: createId(),
    request: { ...body, session_id: sessionId },
  });

const unwrapResponseChunk = (chunk: Record<string, unknown>): Record<string, unknown> => {
  const inner = chunk.response as Record<string, unknown> | undefined;
  if (!inner) return { candidates: [] };
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

  const res = await client.request({
    url: getMethodUrl('generateContent'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: wrapRequestBody(model, body, transport.projectId, sessionId),
    signal,
    retryConfig: { retry: 3, statusCodesToRetry: [[429, 429], [500, 599]] },
  });

  return unwrapResponseChunk(res.data as Record<string, unknown>);
};

export const codeAssistStreamGenerate = async (
  model: string,
  body: Record<string, unknown>,
  transport: GoogleCodeAssistTransport,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> => {
  const client = buildOAuth2Client(transport);
  const sessionId = `gemini_${Date.now().toString(36)}`;

  const res = await client.request({
    url: getMethodUrl('streamGenerateContent'),
    method: 'POST',
    params: { alt: 'sse' },
    headers: { 'Content-Type': 'application/json' },
    responseType: 'stream',
    body: wrapRequestBody(model, body, transport.projectId, sessionId),
    signal,
  });

  return readCodeAssistSse(res.data as NodeJS.ReadableStream);
};

async function* readCodeAssistSse(stream: NodeJS.ReadableStream): AsyncGenerator<unknown> {
  const rl = readline.createInterface({
    input: Readable.from(stream),
    crlfDelay: Infinity,
  });
  let bufferedLines: string[] = [];

  for await (const line of rl) {
    if (line.startsWith('data: ')) {
      bufferedLines.push(line.slice(6).trim());
    } else if (line === '') {
      if (bufferedLines.length === 0) continue;
      const chunk = bufferedLines.join('\n');
      bufferedLines = [];
      try {
        const parsed = JSON.parse(chunk) as Record<string, unknown>;
        yield unwrapResponseChunk(parsed);
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

/**
 * Call loadCodeAssist to obtain the managed projectId and user tier.
 * Called once during enrollment completion.
 */
export const loadCodeAssistProject = async (
  accessToken: string,
  refreshToken: string,
): Promise<{ projectId: string; userTier: string }> => {
  const client = new OAuth2Client({
    clientId: GEMINI_OAUTH_CLIENT_ID,
    clientSecret: GEMINI_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const res = await client.request({
    url: getMethodUrl('loadCodeAssist'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
    }),
  });

  const data = res.data as Record<string, unknown>;
  const currentTier = data.currentTier as Record<string, unknown> | undefined;
  const cloudaicompanionProject = data.cloudaicompanionProject as string | undefined;

  if (currentTier && cloudaicompanionProject) {
    return { projectId: cloudaicompanionProject, userTier: (currentTier.id as string) || 'STANDARD' };
  }

  // Need to onboard
  const allowedTiers = data.allowedTiers as Array<Record<string, unknown>> | undefined;
  const freeTier = allowedTiers?.find((t) => t.isDefault) || allowedTiers?.[0];
  const tierId = (freeTier?.id as string) || 'FREE';

  const onboardRes = await client.request({
    url: getMethodUrl('onboardUser'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tierId,
      metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
    }),
  });

  let lroRes = onboardRes.data as Record<string, unknown>;

  while (!lroRes.done && lroRes.name) {
    await new Promise((f) => setTimeout(f, 5000));
    const opRes = await client.request({
      url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}/${lroRes.name}`,
      method: 'GET',
    });
    lroRes = opRes.data as Record<string, unknown>;
  }

  const lroResponse = lroRes.response as Record<string, unknown> | undefined;
  const projectFromLro = lroResponse?.cloudaicompanionProject as Record<string, unknown> | undefined;
  const projectId = (projectFromLro?.id as string) || '';

  if (!projectId) {
    throw new Error('Code Assist onboarding did not return a project ID.');
  }

  return { projectId, userTier: tierId };
};

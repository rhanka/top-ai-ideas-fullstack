import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  acknowledgeChromeUpstreamCommand,
  closeChromeUpstreamSession,
  createChromeUpstreamSession,
  getChromeUpstreamSession,
  listChromeUpstreamSessionEvents,
  registerChromeUpstreamCommand,
} from '../../services/chrome-upstream-protocol';

const DEFAULT_EXTENSION_VERSION = '0.1.0';
const DEFAULT_EXTENSION_SOURCE = 'ui/chrome-ext';
const DEFAULT_EXTENSION_ZIP_PATH = '/chrome-extension/top-ai-ideas-chrome-extension.zip';

const readConfig = () => {
  const downloadUrl = (process.env.CHROME_EXTENSION_DOWNLOAD_URL ?? env.CHROME_EXTENSION_DOWNLOAD_URL ?? '').trim();
  const version = (process.env.CHROME_EXTENSION_VERSION ?? env.CHROME_EXTENSION_VERSION ?? '').trim();
  const source = (process.env.CHROME_EXTENSION_SOURCE ?? env.CHROME_EXTENSION_SOURCE ?? '').trim();

  return {
    downloadUrl,
    version: version || DEFAULT_EXTENSION_VERSION,
    source: source || DEFAULT_EXTENSION_SOURCE,
  };
};

const normalizeHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const buildFallbackDownloadUrlFromOrigin = (originHeader: string | undefined): string | null => {
  const origin = (originHeader ?? '').trim();
  if (!origin) return null;

  const normalizedOrigin = normalizeHttpUrl(origin);
  if (!normalizedOrigin) return null;

  return new URL(DEFAULT_EXTENSION_ZIP_PATH, normalizedOrigin).toString();
};

export const chromeExtensionRouter = new Hono();

const targetTabInput = z.object({
  tab_id: z.number().int().positive(),
  url: z.string().max(2000).optional(),
  origin: z.string().max(2000).optional(),
  title: z.string().max(1000).optional(),
});

const upstreamSessionInput = z.object({
  extension_runtime_id: z.string().min(1).max(255),
  ws_available: z.boolean().optional(),
  target_tab: targetTabInput.optional(),
});

const upstreamCommandInput = z.object({
  session_id: z.string().min(1).max(255),
  command_id: z.string().min(1).max(255),
  sequence: z.number().int().positive(),
  command_kind: z.literal('tool_execute'),
  tool_name: z.string().min(1).max(96),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
  target_tab: targetTabInput,
  issued_at: z.string().datetime().optional(),
});

const upstreamErrorInput = z.object({
  code: z.enum([
    'session_not_found',
    'session_scope_denied',
    'sequence_conflict',
    'single_tab_violation',
    'unsupported_command',
    'permission_scope_invalid',
    'non_injectable_target',
    'command_not_found',
    'invalid_transition',
    'invalid_ack',
  ]),
  message: z.string().min(1).max(1000),
  details: z.record(z.string(), z.unknown()).optional(),
});

const upstreamAckInput = z.object({
  session_id: z.string().min(1).max(255),
  command_id: z.string().min(1).max(255),
  sequence: z.number().int().positive(),
  status: z.enum(['completed', 'failed', 'rejected']),
  error: upstreamErrorInput.optional(),
});

const upstreamCloseInput = z.object({
  reason: z.string().min(1).max(1000).optional(),
});

chromeExtensionRouter.get('/download', async (c) => {
  const config = readConfig();

  let resolvedDownloadUrl: string | null = null;

  if (config.downloadUrl) {
    resolvedDownloadUrl = normalizeHttpUrl(config.downloadUrl);
    if (!resolvedDownloadUrl) {
      return c.json(
        {
          message:
            'Chrome extension download is unavailable: CHROME_EXTENSION_DOWNLOAD_URL must be a valid http(s) URL, then restart the API.',
        },
        503
      );
    }
  } else {
    resolvedDownloadUrl = buildFallbackDownloadUrlFromOrigin(c.req.header('origin'));
    if (!resolvedDownloadUrl) {
      return c.json(
        {
          message:
            'Chrome extension download is unavailable: set CHROME_EXTENSION_DOWNLOAD_URL in the API environment and restart the API.',
        },
        503
      );
    }
  }

  return c.json({
    version: config.version,
    source: config.source,
    downloadUrl: resolvedDownloadUrl,
  });
});

chromeExtensionRouter.post(
  '/upstream/session',
  zValidator('json', upstreamSessionInput),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    const session = createChromeUpstreamSession({
      user_id: user.userId,
      workspace_id: user.workspaceId,
      extension_runtime_id: body.extension_runtime_id,
      ws_available: body.ws_available !== false,
      target_tab: body.target_tab,
    });

    return c.json({ session }, 201);
  },
);

chromeExtensionRouter.get('/upstream/session/:sessionId', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('sessionId');
  const session = getChromeUpstreamSession(sessionId, user.userId, user.workspaceId);
  if (!session) {
    return c.json({ error: 'Upstream session not found.' }, 404);
  }
  return c.json({ session });
});

chromeExtensionRouter.get('/upstream/session/:sessionId/events', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('sessionId');
  const limitRaw = c.req.query('limit');
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const events = listChromeUpstreamSessionEvents({
    session_id: sessionId,
    user_id: user.userId,
    workspace_id: user.workspaceId,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  });

  if (!events) {
    return c.json({ error: 'Upstream session not found.' }, 404);
  }
  return c.json({ session_id: sessionId, events });
});

chromeExtensionRouter.post(
  '/upstream/session/:sessionId/command',
  zValidator('json', upstreamCommandInput),
  async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const body = c.req.valid('json');
    if (body.session_id !== sessionId) {
      return c.json(
        {
          error:
            'Session identifier mismatch between URL and command envelope.',
        },
        400,
      );
    }

    const ack = registerChromeUpstreamCommand({
      user_id: user.userId,
      workspace_id: user.workspaceId,
      envelope: {
        session_id: body.session_id,
        command_id: body.command_id,
        sequence: body.sequence,
        command_kind: body.command_kind,
        tool_name: body.tool_name,
        arguments: body.arguments,
        target_tab: body.target_tab,
        issued_at: body.issued_at,
      },
    });

    const status = ack.status === 'accepted' ? 202 : 409;
    return c.json({ ack }, status);
  },
);

chromeExtensionRouter.post(
  '/upstream/session/:sessionId/ack',
  zValidator('json', upstreamAckInput),
  async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const body = c.req.valid('json');
    if (body.session_id !== sessionId) {
      return c.json(
        {
          error:
            'Session identifier mismatch between URL and ack payload.',
        },
        400,
      );
    }

    const ack = acknowledgeChromeUpstreamCommand({
      user_id: user.userId,
      workspace_id: user.workspaceId,
      session_id: body.session_id,
      command_id: body.command_id,
      sequence: body.sequence,
      status: body.status,
      error: body.error,
    });

    return c.json({ ack });
  },
);

chromeExtensionRouter.post(
  '/upstream/session/:sessionId/close',
  zValidator('json', upstreamCloseInput),
  async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const body = c.req.valid('json');
    const session = closeChromeUpstreamSession({
      session_id: sessionId,
      user_id: user.userId,
      workspace_id: user.workspaceId,
      reason: body.reason,
    });
    if (!session) {
      return c.json({ error: 'Upstream session not found.' }, 404);
    }
    return c.json({ session });
  },
);

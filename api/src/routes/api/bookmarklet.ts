import { Hono } from 'hono';
import { generateInjectedScript } from '../../upstream/injected-script';
import { register as registerTab } from '../../services/tab-registry';

/**
 * In-memory nonce store: nonce -> expiry timestamp (ms).
 * Nonces are single-use and short-lived (60s).
 */
const nonceStore = new Map<string, number>();

const NONCE_TTL_MS = 60_000;

// --- JSONP token store ---
// Maps token -> { tabId, userId, expiry }
interface JsonpTokenEntry {
  tabId: string;
  userId: string;
  expiry: number;
}
const jsonpTokenStore = new Map<string, JsonpTokenEntry>();
const JSONP_TOKEN_TTL_MS = 5 * 60_000; // 5 minutes

// Maps tabId -> pending command (FIFO queue, one at a time for simplicity)
interface PendingCommand {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
}
const pendingCommands = new Map<string, PendingCommand[]>();

// Maps tabId -> received results
interface ReceivedResult {
  callId: string;
  result: unknown;
}
const receivedResults = new Map<string, ReceivedResult[]>();

function generateJsonpToken(tabId: string, userId: string): string {
  pruneExpiredTokens();
  const token = crypto.randomUUID();
  jsonpTokenStore.set(token, {
    tabId,
    userId,
    expiry: Date.now() + JSONP_TOKEN_TTL_MS,
  });
  return token;
}

function validateJsonpToken(token: string): JsonpTokenEntry | null {
  const entry = jsonpTokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    jsonpTokenStore.delete(token);
    return null;
  }
  return entry;
}

function refreshJsonpToken(token: string): string | null {
  const entry = jsonpTokenStore.get(token);
  if (!entry) return null;
  // Delete old token and issue new one
  jsonpTokenStore.delete(token);
  return generateJsonpToken(entry.tabId, entry.userId);
}

function pruneExpiredTokens(): void {
  const now = Date.now();
  for (const [token, entry] of jsonpTokenStore.entries()) {
    if (entry.expiry < now) {
      jsonpTokenStore.delete(token);
    }
  }
}

/**
 * Push a pending command for a tab (used by chat-service or bridge).
 * Exported for use by other services.
 */
export function pushPendingCommand(tabId: string, cmd: PendingCommand): void {
  const queue = pendingCommands.get(tabId) || [];
  queue.push(cmd);
  pendingCommands.set(tabId, queue);
}

/**
 * Pop the next pending command for a tab.
 */
export function popPendingCommand(tabId: string): PendingCommand | undefined {
  const queue = pendingCommands.get(tabId);
  if (!queue || queue.length === 0) return undefined;
  return queue.shift();
}

/**
 * Push a received result for a tab.
 */
export function pushResult(tabId: string, result: ReceivedResult): void {
  const queue = receivedResults.get(tabId) || [];
  queue.push(result);
  receivedResults.set(tabId, queue);
}

/**
 * Pop all received results for a tab.
 */
export function popResults(tabId: string): ReceivedResult[] {
  const results = receivedResults.get(tabId) || [];
  receivedResults.delete(tabId);
  return results;
}

/**
 * Clear all JSONP state (useful for tests).
 */
export function clearJsonpState(): void {
  jsonpTokenStore.clear();
  pendingCommands.clear();
  receivedResults.clear();
}

function pruneExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiry] of nonceStore.entries()) {
    if (expiry < now) {
      nonceStore.delete(nonce);
    }
  }
}

export const bookmarkletRouter = new Hono();

/**
 * GET /nonce — returns a short-lived random nonce for bridge iframe handshake.
 * Session auth required (applied via middleware in index.ts).
 */
bookmarkletRouter.get('/nonce', async (c) => {
  pruneExpiredNonces();

  const nonce = crypto.randomUUID();
  nonceStore.set(nonce, Date.now() + NONCE_TTL_MS);

  return c.json({ nonce });
});

/**
 * GET /nonce/validate?nonce=X — validates and consumes a nonce.
 * Session auth required (applied via middleware in index.ts).
 */
bookmarkletRouter.get('/nonce/validate', async (c) => {
  const nonce = c.req.query('nonce');
  if (!nonce) {
    return c.json({ valid: false, error: 'missing nonce' }, 400);
  }
  const valid = consumeNonce(nonce);
  if (!valid) {
    return c.json({ valid: false }, 401);
  }
  return c.json({ valid: true });
});

/**
 * Validate and consume a nonce. Returns true if the nonce was valid and not expired.
 * Exported for potential use by other services.
 */
export function consumeNonce(nonce: string): boolean {
  const expiry = nonceStore.get(nonce);
  if (expiry === undefined) return false;
  nonceStore.delete(nonce);
  return Date.now() <= expiry;
}

/**
 * Clear all nonces (useful for tests).
 */
export function clearNonces(): void {
  nonceStore.clear();
}

/**
 * Public bookmarklet routes (no auth required).
 * These must be mounted BEFORE requireAuth middleware.
 */
export const bookmarkletPublicRouter = new Hono();

/**
 * Override CORP header for all public bookmarklet routes.
 * The global secureHeaders middleware sets CORP to 'same-origin',
 * but these scripts must be loadable cross-origin by external pages.
 */
bookmarkletPublicRouter.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
});

/**
 * GET /injected-script.js — serves the injected script for external loading mode.
 * Public, no auth. Headers: CORP cross-origin, Content-Type application/javascript, Cache-Control 300s.
 */
bookmarkletPublicRouter.get('/injected-script.js', async (c) => {
  // In external mode, the actual bridge origin is read from data-bridge-origin attribute
  // at runtime. This fallback is only used for inline mode (which won't use this endpoint).
  // Use the request's origin or a safe default.
  const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/[^/]*$/, '') || '*';
  const script = generateInjectedScript(origin);

  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header('Cache-Control', 'public, max-age=300');

  return c.body(script);
});

/**
 * GET /probe.js — minimal script for the inline script probe.
 * Public, no auth.
 */
bookmarkletPublicRouter.get('/probe.js', async (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header('Cache-Control', 'public, max-age=300');

  return c.body('window.__TOPAI_PROBE_OK=true;');
});

/**
 * GET /register — JSONP registration endpoint for tabs that can't use iframe bridge.
 * Public (no session auth). Creates a tab entry and returns a short-lived token via JSONP callback.
 * Query params: url, title, callback (JSONP function name)
 */
bookmarkletPublicRouter.get('/register', async (c) => {
  const url = c.req.query('url') || '';
  const title = c.req.query('title') || '';
  const callback = c.req.query('callback') || '__TOPAI_REG_CB';

  if (!url) {
    c.header('Content-Type', 'application/javascript; charset=utf-8');
    return c.body(`${callback}({"error":"missing url"})`);
  }

  // Register tab with a dummy userId (JSONP mode has no session auth)
  // In production, this would require a pre-shared secret or be gated differently
  const tabEntry = registerTab({
    source: 'bookmarklet',
    url,
    title,
    userId: 'jsonp-anonymous',
  });

  const token = generateJsonpToken(tabEntry.tab_id, tabEntry.userId);

  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header('Cache-Control', 'no-store');

  return c.body(
    `${callback}(${JSON.stringify({ tab_id: tabEntry.tab_id, token })})`,
  );
});

/**
 * GET /poll?tab_id=X&token=Y — returns pending command as executable JS.
 * Public (auth via short-lived token).
 * Returns: window.__TOPAI_CMD({callId, toolName, args}) or //noop
 */
bookmarkletPublicRouter.get('/poll', async (c) => {
  const tabId = c.req.query('tab_id') || '';
  const token = c.req.query('token') || '';

  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header('Cache-Control', 'no-store');

  if (!tabId || !token) {
    return c.body('//error: missing params');
  }

  const entry = validateJsonpToken(token);
  if (!entry || entry.tabId !== tabId) {
    return c.body('//error: invalid token');
  }

  const cmd = popPendingCommand(tabId);
  if (!cmd) {
    return c.body('//noop');
  }

  return c.body(
    `window.__TOPAI_CMD(${JSON.stringify({ callId: cmd.callId, toolName: cmd.toolName, args: cmd.args })})`,
  );
});

/**
 * GET /result?token=Y&data=JSON — receives results from img.src.
 * Public (auth via token). Returns a 1x1 transparent GIF.
 */
bookmarkletPublicRouter.get('/result', async (c) => {
  const token = c.req.query('token') || '';
  const data = c.req.query('data') || '';

  if (!token) {
    return c.body(null, 400);
  }

  const entry = validateJsonpToken(token);
  if (!entry) {
    return c.body(null, 401);
  }

  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.callId) {
        pushResult(entry.tabId, {
          callId: String(parsed.callId),
          result: parsed.result,
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Return 1x1 transparent GIF
  const gif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );
  c.header('Content-Type', 'image/gif');
  c.header('Cache-Control', 'no-store');
  return c.body(gif);
});

/**
 * POST /result — receives results as POST body (for larger payloads).
 * Public (auth via token in query or body).
 */
bookmarkletPublicRouter.post('/result', async (c) => {
  const token = c.req.query('token') || '';

  if (!token) {
    return c.json({ error: 'missing token' }, 400);
  }

  const entry = validateJsonpToken(token);
  if (!entry) {
    return c.json({ error: 'invalid token' }, 401);
  }

  try {
    const body = await c.req.json();
    if (body.callId) {
      pushResult(entry.tabId, {
        callId: String(body.callId),
        result: body.result,
      });
    }
  } catch {
    return c.json({ error: 'invalid body' }, 400);
  }

  return c.json({ ok: true });
});

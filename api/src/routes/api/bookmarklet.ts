import { Hono } from 'hono';
import { generateInjectedScript } from '../../upstream/injected-script';

/**
 * In-memory nonce store: nonce -> expiry timestamp (ms).
 * Nonces are single-use and short-lived (60s).
 */
const nonceStore = new Map<string, number>();

const NONCE_TTL_MS = 60_000;

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

import { Hono } from 'hono';

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

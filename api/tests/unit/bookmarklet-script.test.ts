import { describe, it, expect } from 'vitest';
import { app } from '../../src/app';

/**
 * Tests for public bookmarklet script endpoints:
 * - GET /api/v1/bookmarklet/injected-script.js
 * - GET /api/v1/bookmarklet/probe.js
 */
describe('bookmarklet script endpoints', () => {
  describe('GET /api/v1/bookmarklet/injected-script.js', () => {
    it('returns status 200', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      expect(res.status).toBe(200);
    });

    it('returns content-type application/javascript', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      expect(res.headers.get('content-type')).toContain('application/javascript');
    });

    it('returns CORP cross-origin header', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    });

    it('returns Cache-Control public max-age=300', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const cc = res.headers.get('cache-control');
      expect(cc).toContain('public');
      expect(cc).toContain('max-age=300');
    });

    it('body contains __TOPAI_ACTIVE re-entrant guard', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const body = await res.text();
      expect(body).toContain('__TOPAI_ACTIVE');
    });

    it('body is wrapped in IIFE', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const body = await res.text();
      expect(body.startsWith('(function()')).toBe(true);
      expect(body.endsWith('})();')).toBe(true);
    });

    it('body contains postMessage listener', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const body = await res.text();
      expect(body).toContain('addEventListener("message"');
    });

    it('body contains tab_read and tab_action handlers', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const body = await res.text();
      expect(body).toContain('handleTabRead');
      expect(body).toContain('handleTabAction');
    });

    it('body supports external loading via document.currentScript', async () => {
      const res = await app.request('/api/v1/bookmarklet/injected-script.js');
      const body = await res.text();
      expect(body).toContain('document.currentScript');
      expect(body).toContain('data-bridge-origin');
    });
  });

  describe('GET /api/v1/bookmarklet/probe.js', () => {
    it('returns status 200', async () => {
      const res = await app.request('/api/v1/bookmarklet/probe.js');
      expect(res.status).toBe(200);
    });

    it('returns content-type application/javascript', async () => {
      const res = await app.request('/api/v1/bookmarklet/probe.js');
      expect(res.headers.get('content-type')).toContain('application/javascript');
    });

    it('returns CORP cross-origin header', async () => {
      const res = await app.request('/api/v1/bookmarklet/probe.js');
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    });

    it('body contains __TOPAI_PROBE_OK', async () => {
      const res = await app.request('/api/v1/bookmarklet/probe.js');
      const body = await res.text();
      expect(body).toContain('__TOPAI_PROBE_OK');
    });

    it('is minimal (under 100 bytes)', async () => {
      const res = await app.request('/api/v1/bookmarklet/probe.js');
      const body = await res.text();
      expect(body.length).toBeLessThan(100);
    });
  });
});

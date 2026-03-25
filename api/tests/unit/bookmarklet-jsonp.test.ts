import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../src/app';
import {
  clearJsonpState,
  pushPendingCommand,
  popPendingCommand,
  pushResult,
  popResults,
} from '../../src/routes/api/bookmarklet';

describe('bookmarklet JSONP endpoints', () => {
  beforeEach(() => {
    clearJsonpState();
  });

  // --- Unit tests for command/result queue ---

  describe('pushPendingCommand / popPendingCommand', () => {
    it('returns undefined when no commands pending', () => {
      expect(popPendingCommand('tab-1')).toBeUndefined();
    });

    it('pushes and pops in FIFO order', () => {
      pushPendingCommand('tab-1', { callId: 'c1', toolName: 'tab_read', args: {} });
      pushPendingCommand('tab-1', { callId: 'c2', toolName: 'tab_action', args: { action: 'click' } });
      expect(popPendingCommand('tab-1')).toEqual({ callId: 'c1', toolName: 'tab_read', args: {} });
      expect(popPendingCommand('tab-1')).toEqual({ callId: 'c2', toolName: 'tab_action', args: { action: 'click' } });
      expect(popPendingCommand('tab-1')).toBeUndefined();
    });

    it('isolates commands per tab', () => {
      pushPendingCommand('tab-1', { callId: 'c1', toolName: 'tab_read', args: {} });
      pushPendingCommand('tab-2', { callId: 'c2', toolName: 'tab_read', args: {} });
      expect(popPendingCommand('tab-1')?.callId).toBe('c1');
      expect(popPendingCommand('tab-2')?.callId).toBe('c2');
    });
  });

  describe('pushResult / popResults', () => {
    it('returns empty array when no results', () => {
      expect(popResults('tab-1')).toEqual([]);
    });

    it('pushes and pops results, clearing the queue', () => {
      pushResult('tab-1', { callId: 'c1', result: { ok: true } });
      pushResult('tab-1', { callId: 'c2', result: { ok: true } });
      const results = popResults('tab-1');
      expect(results).toHaveLength(2);
      expect(results[0].callId).toBe('c1');
      expect(popResults('tab-1')).toEqual([]);
    });
  });

  // --- Integration tests for JSONP register endpoint ---

  describe('GET /api/v1/bookmarklet/register', () => {
    it('returns JSONP callback with tab_id and token', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/register?url=https://example.com&title=Test&callback=__TOPAI_REG_CB',
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/javascript');

      const body = await res.text();
      expect(body).toMatch(/^__TOPAI_REG_CB\(/);
      expect(body).toContain('"tab_id"');
      expect(body).toContain('"token"');
    });

    it('returns error when url is missing', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/register?callback=__TOPAI_REG_CB',
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('"error"');
    });

    it('uses default callback name when not provided', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/register?url=https://example.com',
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/^__TOPAI_REG_CB\(/);
    });
  });

  // --- Integration tests for JSONP poll endpoint ---

  describe('GET /api/v1/bookmarklet/poll', () => {
    async function registerTab(): Promise<{ tab_id: string; token: string }> {
      const res = await app.request(
        '/api/v1/bookmarklet/register?url=https://example.com&title=Test&callback=cb',
      );
      const body = await res.text();
      // Parse JSONP: cb({...})
      const json = body.slice(3, -1); // Remove "cb(" and ")"
      return JSON.parse(json);
    }

    it('returns //noop when no pending commands', async () => {
      const { tab_id, token } = await registerTab();
      const res = await app.request(
        `/api/v1/bookmarklet/poll?tab_id=${tab_id}&token=${token}`,
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('//noop');
    });

    it('returns pending command as window.__TOPAI_CMD(...)', async () => {
      const { tab_id, token } = await registerTab();
      pushPendingCommand(tab_id, {
        callId: 'test-call-1',
        toolName: 'tab_read',
        args: { selector: 'body' },
      });

      const res = await app.request(
        `/api/v1/bookmarklet/poll?tab_id=${tab_id}&token=${token}`,
      );
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/^window\.__TOPAI_CMD\(/);
      expect(body).toContain('"test-call-1"');
      expect(body).toContain('"tab_read"');
    });

    it('consumes the command (second poll returns noop)', async () => {
      const { tab_id, token } = await registerTab();
      pushPendingCommand(tab_id, {
        callId: 'c1',
        toolName: 'tab_read',
        args: {},
      });

      await app.request(`/api/v1/bookmarklet/poll?tab_id=${tab_id}&token=${token}`);
      const res2 = await app.request(
        `/api/v1/bookmarklet/poll?tab_id=${tab_id}&token=${token}`,
      );
      expect(await res2.text()).toBe('//noop');
    });

    it('returns error for invalid token', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/poll?tab_id=foo&token=bad-token',
      );
      const body = await res.text();
      expect(body).toContain('invalid token');
    });

    it('returns error for missing params', async () => {
      const res = await app.request('/api/v1/bookmarklet/poll');
      const body = await res.text();
      expect(body).toContain('missing params');
    });
  });

  // --- Integration tests for result endpoint ---

  describe('GET /api/v1/bookmarklet/result', () => {
    async function registerTab(): Promise<{ tab_id: string; token: string }> {
      const res = await app.request(
        '/api/v1/bookmarklet/register?url=https://example.com&title=Test&callback=cb',
      );
      const body = await res.text();
      const json = body.slice(3, -1);
      return JSON.parse(json);
    }

    it('accepts result via GET (img.src) and returns a GIF', async () => {
      const { tab_id, token } = await registerTab();
      const data = encodeURIComponent(
        JSON.stringify({ callId: 'c1', result: { ok: true } }),
      );

      const res = await app.request(
        `/api/v1/bookmarklet/result?token=${token}&data=${data}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/gif');

      // Verify the result was stored
      const results = popResults(tab_id);
      expect(results).toHaveLength(1);
      expect(results[0].callId).toBe('c1');
    });

    it('returns 401 for invalid token', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/result?token=bad-token&data={}',
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/bookmarklet/result', () => {
    async function registerTab(): Promise<{ tab_id: string; token: string }> {
      const res = await app.request(
        '/api/v1/bookmarklet/register?url=https://example.com&title=Test&callback=cb',
      );
      const body = await res.text();
      const json = body.slice(3, -1);
      return JSON.parse(json);
    }

    it('accepts result via POST body', async () => {
      const { tab_id, token } = await registerTab();

      const res = await app.request(
        `/api/v1/bookmarklet/result?token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: 'c2', result: { dom: '<div>test</div>' } }),
        },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      const results = popResults(tab_id);
      expect(results).toHaveLength(1);
      expect(results[0].callId).toBe('c2');
    });

    it('returns 401 for invalid token', async () => {
      const res = await app.request(
        '/api/v1/bookmarklet/result?token=bad',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: 'c1', result: {} }),
        },
      );
      expect(res.status).toBe(401);
    });
  });
});

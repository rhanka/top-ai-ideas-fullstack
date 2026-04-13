import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

import { app } from '../../src/app';
import { db } from '../../src/db/client';
import {
  authenticatedRequest,
  cleanupAuthData,
  createAuthenticatedUser,
} from '../utils/auth-helper';

const GOOGLE_CONNECTION_SETTINGS_KEY = 'provider_connection:google';
const GOOGLE_CONNECTION_PENDING_SECRET_KEY = 'provider_connection_secret:google_pending';
const GOOGLE_CONNECTION_SECRET_KEY = 'provider_connection_secret:google';

const createJsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

describe('provider connections google API', () => {
  let admin: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let editor: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    admin = await createAuthenticatedUser('admin_app');
    editor = await createAuthenticatedUser('editor');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await db.run(
      sql`DELETE FROM settings WHERE key IN (${GOOGLE_CONNECTION_SETTINGS_KEY}, ${GOOGLE_CONNECTION_PENDING_SECRET_KEY}, ${GOOGLE_CONNECTION_SECRET_KEY})`,
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.run(
      sql`DELETE FROM settings WHERE key IN (${GOOGLE_CONNECTION_SETTINGS_KEY}, ${GOOGLE_CONNECTION_PENDING_SECRET_KEY}, ${GOOGLE_CONNECTION_SECRET_KEY})`,
    );
    await cleanupAuthData();
  });

  it('starts and completes google enrollment in admin route', async () => {
    const startResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/start',
      admin.sessionToken!,
      {
        accountLabel: 'admin@google.com',
      },
    );

    expect(startResponse.status).toBe(200);
    const startPayload = (await startResponse.json()) as {
      provider: {
        providerId: string;
        ready: boolean;
        connectionStatus: string;
        enrollmentId: string | null;
        enrollmentUrl: string | null;
        enrollmentCode: string | null;
        accountLabel: string | null;
      };
    };

    expect(startPayload).toMatchObject({
      provider: {
        providerId: 'google',
        ready: false,
        connectionStatus: 'pending',
        accountLabel: 'admin@google.com',
      },
    });
    expect(startPayload.provider.enrollmentUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    
    // We need to get the state and build a mock pastedUrl
    const url = new URL(startPayload.provider.enrollmentUrl!);
    const state = url.searchParams.get('state');

    const idToken = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ email: 'admin@google.com' })).toString('base64url'),
      'signature',
    ].join('.');

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          id_token: idToken,
          access_token: 'google-oauth-access-token',
          refresh_token: 'google-refresh-token',
        }),
      );

    const pastedUrl = `http://127.0.0.1:8709/callback?state=${state}&code=4/0AX4XfWh_some_auth_code`;

    const completeResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/complete',
      admin.sessionToken!,
      {
        enrollmentId: startPayload.provider.enrollmentId,
        pastedUrl,
        accountLabel: 'admin@google.com',
      },
    );

    expect(completeResponse.status).toBe(200);
    await expect(completeResponse.json()).resolves.toMatchObject({
      provider: {
        providerId: 'google',
        ready: true,
        connectionStatus: 'connected',
        managedBy: 'admin_settings',
        accountLabel: 'admin@google.com',
        enrollmentId: null,
        enrollmentUrl: null,
        enrollmentCode: null,
      },
    });

    const adminReadiness = await authenticatedRequest(
      app,
      'GET',
      '/api/v1/models/provider-readiness',
      admin.sessionToken!,
    );
    expect(adminReadiness.status).toBe(200);
    await expect(adminReadiness.json()).resolves.toMatchObject({
      providers: expect.arrayContaining([
        expect.objectContaining({
          providerId: 'google',
          ready: true,
          managedBy: 'admin_settings',
          accountLabel: 'admin@google.com',
        }),
      ]),
    });
  });

  it('disconnects google enrollment in admin route', async () => {
    const startResponse = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/start',
      admin.sessionToken!,
      {
        accountLabel: 'admin@google.com',
      },
    );
    const startPayload = (await startResponse.json()) as {
      provider: { enrollmentId: string | null; enrollmentUrl: string | null };
    };

    const url = new URL(startPayload.provider.enrollmentUrl!);
    const state = url.searchParams.get('state');

    const idToken = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ email: 'admin@google.com' })).toString('base64url'),
      'signature',
    ].join('.');

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          id_token: idToken,
          access_token: 'google-oauth-access-token',
          refresh_token: 'google-refresh-token',
        }),
      );

    const pastedUrl = `http://127.0.0.1:8709/callback?state=${state}&code=4/0AX4XfWh_some_auth_code`;

    await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/complete',
      admin.sessionToken!,
      {
        enrollmentId: startPayload.provider.enrollmentId,
        pastedUrl,
        accountLabel: 'admin@google.com',
      },
    );

    const response = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/disconnect',
      admin.sessionToken!,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: {
        providerId: 'google',
        ready: false,
        connectionStatus: 'disconnected',
        managedBy: 'none',
        accountLabel: null,
      },
    });
  });

  it('rejects google enrollment start for non-admin users', async () => {
    const response = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/settings/provider-connections/google/enrollment/start',
      editor.sessionToken!,
      {
        accountLabel: 'editor@google.com',
      },
    );

    expect(response.status).toBe(403);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { resetChromeUpstreamSessionsForTests } from "../../src/services/chrome-upstream-protocol";
import {
  authenticatedRequest,
  cleanupAuthData,
  createAuthenticatedUser,
} from "../utils/auth-helper";

describe("Chrome upstream command API", () => {
  let user: any;

  beforeEach(async () => {
    resetChromeUpstreamSessionsForTests();
    user = await createAuthenticatedUser("editor");
  });

  afterEach(async () => {
    resetChromeUpstreamSessionsForTests();
    await cleanupAuthData();
  });

  const createSession = async () => {
    const response = await authenticatedRequest(
      app,
      "POST",
      "/api/v1/chrome-extension/upstream/session",
      user.sessionToken!,
      {
        extension_runtime_id: "ext-runtime-command",
        ws_available: true,
        target_tab: {
          tab_id: 17,
          url: "https://example.com/workspace",
        },
      },
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    return String(payload?.session?.session_id ?? "");
  };

  it("accepts a W1 single-tab command and maps tab_action permission scope", async () => {
    const sessionId = await createSession();

    const response = await authenticatedRequest(
      app,
      "POST",
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(sessionId)}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: "cmd-single-tab-accept",
        sequence: 1,
        command_kind: "tool_execute",
        tool_name: "tab_action",
        arguments: {
          actions: [{ action: "click", selector: "#run" }],
        },
        target_tab: {
          tab_id: 17,
          url: "https://example.com/workspace",
        },
      },
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.ack.status).toBe("accepted");
    expect(payload.ack.permission_scope).toBe("tab_action:click");
    expect(payload.ack.sequence).toBe(1);
  });

  it("rejects non-injectable command targets", async () => {
    const sessionId = await createSession();

    const response = await authenticatedRequest(
      app,
      "POST",
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(sessionId)}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: "cmd-non-injectable",
        sequence: 1,
        command_kind: "tool_execute",
        tool_name: "tab_read",
        arguments: { mode: "dom" },
        target_tab: {
          tab_id: 17,
          url: "chrome://extensions",
        },
      },
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.ack.status).toBe("rejected");
    expect(payload.ack.error.code).toBe("non_injectable_target");
  });

  it("rejects commands that do not map to allowed permission namespaces", async () => {
    const sessionId = await createSession();

    const response = await authenticatedRequest(
      app,
      "POST",
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(sessionId)}/command`,
      user.sessionToken!,
      {
        session_id: sessionId,
        command_id: "cmd-invalid-permission",
        sequence: 1,
        command_kind: "tool_execute",
        tool_name: "workspace_delete",
        arguments: { workspace_id: "ws-1" },
        target_tab: {
          tab_id: 17,
          url: "https://example.com/workspace",
        },
      },
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.ack.status).toBe("rejected");
    expect(payload.ack.error.code).toBe("permission_scope_invalid");
  });

  it("returns 400 when URL session id and payload session id differ", async () => {
    const sessionId = await createSession();

    const response = await authenticatedRequest(
      app,
      "POST",
      `/api/v1/chrome-extension/upstream/session/${encodeURIComponent(sessionId)}/command`,
      user.sessionToken!,
      {
        session_id: "different-session-id",
        command_id: "cmd-session-mismatch",
        sequence: 1,
        command_kind: "tool_execute",
        tool_name: "tab_read",
        arguments: { mode: "info" },
        target_tab: {
          tab_id: 17,
          url: "https://example.com/workspace",
        },
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Session identifier mismatch between URL and command envelope.",
    });
  });
});

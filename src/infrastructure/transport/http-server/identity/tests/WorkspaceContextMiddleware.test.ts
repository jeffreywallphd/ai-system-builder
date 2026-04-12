import { describe, expect, it } from "bun:test";
import type { IncomingMessage } from "node:http";
import { resolveWorkspaceContextFromRequest } from "../middleware/workspace-context";

function createRequest(url: string): IncomingMessage {
  return {
    url,
  } as IncomingMessage;
}

describe("workspace-context middleware utilities", () => {
  it("resolves workspace context from the default workspaceId query parameter", () => {
    const result = resolveWorkspaceContextFromRequest(
      createRequest("/api/v1/assets?workspaceId=workspace-alpha"),
      {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: (message) => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "invalid-request",
            message,
          }),
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected workspace context to resolve from query.");
    }
    expect(result.workspace).toEqual({
      workspaceId: "workspace-alpha",
      source: "query",
      queryParam: "workspaceId",
    });
  });

  it("resolves workspace context from an explicit route-provided workspace id", () => {
    const result = resolveWorkspaceContextFromRequest(
      createRequest("/api/v1/workspaces/workspace-alpha/invitations"),
      {
        workspaceId: "workspace-alpha",
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: (message) => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "invalid-request",
            message,
          }),
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected workspace context to resolve from explicit route scope.");
    }
    expect(result.workspace).toEqual({
      workspaceId: "workspace-alpha",
      source: "explicit",
      queryParam: "workspaceId",
    });
  });

  it("supports route-specific workspace query parameter names", () => {
    const result = resolveWorkspaceContextFromRequest(
      createRequest("/api/v1/runtime/queue?actorWorkspaceId=workspace-beta"),
      {
        workspaceQueryParam: "actorWorkspaceId",
        missingWorkspaceMessage: "actorWorkspaceId is required.",
        buildInvalidResponse: (message) => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "invalid-request",
            message,
          }),
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected workspace context to resolve from custom query key.");
    }
    expect(result.workspace).toEqual({
      workspaceId: "workspace-beta",
      source: "query",
      queryParam: "actorWorkspaceId",
    });
  });

  it("returns an invalid-request payload when workspace scope is missing", () => {
    const result = resolveWorkspaceContextFromRequest(
      createRequest("/api/v1/assets"),
      {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: (message) => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "invalid-request",
            message,
          }),
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing workspace scope to fail.");
    }
    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: "invalid-request",
        message: "workspaceId is required.",
      },
    });
  });

  it("returns an invalid-request payload when provided workspace scope is blank", () => {
    const result = resolveWorkspaceContextFromRequest(
      createRequest("/api/v1/assets?workspaceId=%20%20"),
      {
        missingWorkspaceMessage: "workspaceId is required.",
        buildInvalidResponse: (message) => Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "invalid-request",
            message,
          }),
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected blank workspace scope to fail.");
    }
    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: "invalid-request",
        message: "workspaceId is required.",
      },
    });
  });
});

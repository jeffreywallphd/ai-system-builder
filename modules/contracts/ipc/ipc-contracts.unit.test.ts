import { describe, expect, it } from "vitest";

import {
  createIpcChannel,
  createIpcChannelValue,
  createIpcError,
  createIpcFailureResponse,
  createIpcRequest,
  createIpcSuccessResponse,
} from ".";

describe("ipc contracts", () => {
  it("creates dotted channel values from role-revealing segments", () => {
    const channel = createIpcChannelValue(
      "desktop",
      "workspace",
      "create",
      "request",
    );

    expect(channel).toBe("desktop.workspace.create.request");
  });

  it("rejects empty channel segments so channels stay explicit and stable", () => {
    expect(() => createIpcChannelValue("desktop", "   ")).toThrow(
      "IPC channel segments must be non-empty strings.",
    );
  });

  it("creates a channel mapping without embedding ipc wiring details", () => {
    const channel = createIpcChannel(
      "workspace.create",
      "desktop.workspace.create.request",
    );

    expect(channel).toEqual({
      operation: "workspace.create",
      value: "desktop.workspace.create.request",
    });
  });

  it("creates an ipc request that preserves transport operation identity", () => {
    const channel = createIpcChannel(
      "workspace.create",
      "desktop.workspace.create.request",
    );

    const request = createIpcRequest(
      channel,
      { name: "alpha" },
      {
        requestId: "req-400",
        correlationId: "corr-400",
        metadata: { source: "desktop-ui" },
      },
    );

    expect(request).toEqual({
      channel: "desktop.workspace.create.request",
      operation: "workspace.create",
      payload: { name: "alpha" },
      requestId: "req-400",
      correlationId: "corr-400",
      metadata: { source: "desktop-ui" },
    });
  });

  it("creates ipc error and failure response envelopes with channel context", () => {
    const channel = createIpcChannel(
      "workspace.create",
      "desktop.workspace.create.request",
    );

    const error = createIpcError(
      channel,
      "validation",
      "Workspace name is required",
      {
        details: { field: "name" },
        requestId: "req-401",
        metadata: { source: "desktop-host" },
      },
    );

    const response = createIpcFailureResponse(error, {
      correlationId: "corr-401",
    });

    expect(response).toEqual({
      ok: false,
      error: {
        channel: "desktop.workspace.create.request",
        operation: "workspace.create",
        code: "validation",
        message: "Workspace name is required",
        details: { field: "name" },
        requestId: "req-401",
        correlationId: undefined,
        metadata: { source: "desktop-host" },
      },
      channel: "desktop.workspace.create.request",
      operation: "workspace.create",
      requestId: "req-401",
      correlationId: "corr-401",
      metadata: { source: "desktop-host" },
    });
  });

  it("creates ipc success responses without preload or electron-specific fields", () => {
    const channel = createIpcChannel(
      "workspace.create",
      "desktop.workspace.create.response",
    );

    const response = createIpcSuccessResponse(
      channel,
      { workspaceId: "ws-9" },
      {
        requestId: "req-402",
      },
    );

    expect(response).toEqual({
      ok: true,
      value: { workspaceId: "ws-9" },
      requestId: "req-402",
      correlationId: undefined,
      channel: "desktop.workspace.create.response",
      operation: "workspace.create",
      metadata: undefined,
    });
  });
});

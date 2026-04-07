import { describe, expect, it, mock } from "bun:test";
import { RuntimeOperationsService } from "../RuntimeOperationsService";
import type { RuntimeControlClient } from "@shared/runtime/RuntimeControlClient";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("RuntimeOperationsService", () => {
  it("uses shared runtime client with authenticated session context", async () => {
    const client: RuntimeControlClient = {
      startRun: mock(async () => ({ ok: true, data: {} as any })),
      cancelRun: mock(async () => ({ ok: true, data: {} as any })),
      getRunStatus: mock(async () => ({ ok: true, data: {} as any })),
      getRunResult: mock(async () => ({ ok: true, data: {} as any })),
      getRunTrace: mock(async () => ({ ok: true, data: {} as any })),
      listQueueItems: mock(async () => ({ ok: true, data: { items: [], totalCount: 0 } })),
      dequeueQueueItem: mock(async () => ({ ok: true, data: {} as any })),
    };
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "user-1",
        username: "user",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-07T11:00:00.000Z",
        sessionExpiresAt: "2026-04-07T23:00:00.000Z",
        workspaceContext: Object.freeze({
          requestedWorkspaceId: "workspace-requested",
          resolvedWorkspaceId: "workspace-resolved",
          workspaces: Object.freeze([]),
        }),
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const service = new RuntimeOperationsService(client, sessionStore);
    await service.listQueueItems({ statuses: ["queued"], limit: 5, offset: 2 });
    await service.getRunStatus("execution-1");
    await service.startRun({
      systemId: "system:demo",
      versionId: "system:demo:v1",
      trigger: "manual",
      approvedParameters: Object.freeze({ maxRuntimeSeconds: 120 }),
    });
    await service.cancelRun({ executionId: "execution-1", reason: "cancelled" });
    await service.dequeueQueueItem({ queueItemId: "runtime-queue:execution-1" });
    await service.inspectRun({ executionId: "execution-1", diagnosticsLimit: 5, eventLimit: 6, logLimit: 7 });

    expect(client.listQueueItems).toHaveBeenCalledTimes(1);
    expect(client.getRunStatus).toHaveBeenCalledTimes(2);
    expect(client.startRun).toHaveBeenCalledTimes(1);
    expect(client.cancelRun).toHaveBeenCalledTimes(1);
    expect(client.dequeueQueueItem).toHaveBeenCalledTimes(1);
    expect(client.getRunResult).toHaveBeenCalledTimes(1);
    expect(client.getRunTrace).toHaveBeenCalledTimes(1);
    expect(client.listQueueItems).toHaveBeenCalledWith({
      workspaceId: "workspace-resolved",
      statuses: ["queued"],
      limit: 5,
      offset: 2,
      systemId: undefined,
    }, "token-1");
    expect(client.startRun).toHaveBeenCalledWith({
      workspaceId: "workspace-resolved",
      systemId: "system:demo",
      versionId: "system:demo:v1",
      async: undefined,
      inputPayload: undefined,
      executionId: undefined,
      idempotencyKey: undefined,
      context: {
        trigger: "manual",
        metadata: {
          approvedParameters: {
            maxRuntimeSeconds: 120,
          },
        },
      },
    }, "token-1");
  });

  it("returns shared unauthorized error when session is unavailable", async () => {
    const client: RuntimeControlClient = {
      startRun: mock(async () => ({ ok: true, data: {} as any })),
      cancelRun: mock(async () => ({ ok: true, data: {} as any })),
      getRunStatus: mock(async () => ({ ok: true, data: {} as any })),
      getRunResult: mock(async () => ({ ok: true, data: {} as any })),
      getRunTrace: mock(async () => ({ ok: true, data: {} as any })),
      listQueueItems: mock(async () => ({ ok: true, data: { items: [], totalCount: 0 } })),
      dequeueQueueItem: mock(async () => ({ ok: true, data: {} as any })),
    };
    const sessionStore = {
      getSession: () => undefined,
      isSessionExpired: () => true,
    } as unknown as IdentityAuthSessionStore;

    const service = new RuntimeOperationsService(client, sessionStore);
    const response = await service.listQueueItems();

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("unauthorized");
    expect(client.listQueueItems).toHaveBeenCalledTimes(0);
  });
});


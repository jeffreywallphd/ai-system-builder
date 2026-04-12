import { describe, expect, it } from "bun:test";
import {
  parseRuntimeCancelRunRequest,
  parseRuntimeCancelRunResponse,
  parseRuntimeDequeueRequest,
  parseRuntimeDequeueResponse,
  parseRuntimeQueueListRequest,
  parseRuntimeQueueListResponse,
  parseRuntimeStartRunRequest,
  SystemRuntimeTransportSchemaValidationError,
} from "../SystemRuntimeTransportSchemaContracts";

describe("SystemRuntimeTransportSchemaContracts", () => {
  it("parses start-run and queue requests", () => {
    const start = parseRuntimeStartRunRequest({
      systemId: "system:root",
      versionId: "version:1",
      async: true,
    });
    expect(start.systemId).toBe("system:root");

    const queue = parseRuntimeQueueListRequest({
      workspaceId: "workspace:alpha",
      statuses: ["queued", "running"],
      limit: 10,
      offset: 0,
    });
    expect(queue.statuses?.length).toBe(2);
  });

  it("parses queue list response envelopes", () => {
    const serialized = JSON.stringify({
      ok: true,
      data: {
        items: [
          {
            queueItemId: "queue:1",
            executionId: "exec:1",
            systemId: "system:root",
            status: "queued",
            enqueuedAt: "2026-04-06T10:00:00.000Z",
          },
        ],
        totalCount: 1,
      },
    });
    const response = parseRuntimeQueueListResponse(JSON.parse(serialized));

    expect(response.data?.items[0]?.queueItemId).toBe("queue:1");
  });

  it("rejects malformed runtime queue payloads", () => {
    expect(() => parseRuntimeQueueListRequest({
      workspaceId: "workspace:alpha",
      limit: -1,
    })).toThrow(SystemRuntimeTransportSchemaValidationError);
  });

  it("parses runtime mutation payloads", () => {
    const cancel = parseRuntimeCancelRunRequest({
      executionId: "exec:1",
      reason: "cancel requested",
      idempotencyKey: "mut:cancel:1",
    });
    expect(cancel.executionId).toBe("exec:1");

    const dequeue = parseRuntimeDequeueRequest({
      queueItemId: "runtime-queue:exec:1",
      dequeuedAt: "2026-04-07T12:00:00.000Z",
      idempotencyKey: "mut:dequeue:1",
    });
    expect(dequeue.queueItemId).toBe("runtime-queue:exec:1");

    const cancelResponse = parseRuntimeCancelRunResponse({
      ok: true,
      data: {
        executionId: "exec:1",
        status: "cancelled",
        mutation: {
          changed: true,
          mutationId: "runtime-cancel:exec:1:mut:cancel:1",
          occurredAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    expect(cancelResponse.data?.status).toBe("cancelled");

    const dequeueResponse = parseRuntimeDequeueResponse({
      ok: true,
      data: {
        queueItemId: "runtime-queue:exec:1",
        executionId: "exec:1",
        status: "cancelled",
        mutation: {
          changed: false,
          occurredAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    expect(dequeueResponse.data?.executionId).toBe("exec:1");
  });
});

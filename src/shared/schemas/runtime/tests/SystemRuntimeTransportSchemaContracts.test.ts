import { describe, expect, it } from "bun:test";
import {
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
      limit: -1,
    })).toThrow(SystemRuntimeTransportSchemaValidationError);
  });
});

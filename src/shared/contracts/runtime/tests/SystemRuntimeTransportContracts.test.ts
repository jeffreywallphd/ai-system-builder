import { describe, expect, it } from "bun:test";
import { RuntimeQueueItemStatuses, SystemRuntimeTransportRoutes } from "../SystemRuntimeTransportContracts";

describe("SystemRuntimeTransportContracts", () => {
  it("defines canonical run and queue routes", () => {
    expect(SystemRuntimeTransportRoutes.startRun).toBe("/api/v1/runtime/runs/start");
    expect(SystemRuntimeTransportRoutes.listQueueItems).toBe("/api/v1/runtime/queue");
    expect(SystemRuntimeTransportRoutes.subscribeRealtime).toBe("/api/v1/runtime/realtime");
  });

  it("defines queue item statuses", () => {
    expect(RuntimeQueueItemStatuses.queued).toBe("queued");
    expect(RuntimeQueueItemStatuses.running).toBe("running");
    expect(RuntimeQueueItemStatuses.completed).toBe("completed");
  });
});

import { describe, expect, it } from "bun:test";
import {
  SharedApiContractVersions,
  SharedApiErrorCodes,
  SharedApiQueryDefaults,
  SharedApiRealtimeEventKinds,
  SharedApiSortDirections,
} from "../SharedApiContractPrimitives";

describe("SharedApiContractPrimitives", () => {
  it("defines canonical versions and core error codes", () => {
    expect(SharedApiContractVersions.v1).toBe("shared-api/v1");
    expect(SharedApiErrorCodes.invalidRequest).toBe("invalid-request");
    expect(SharedApiErrorCodes.temporarilyUnavailable).toBe("temporarily-unavailable");
    expect(SharedApiErrorCodes.internal).toBe("internal");
  });

  it("defines realtime event kinds and pagination defaults", () => {
    expect(SharedApiRealtimeEventKinds.runStatusChanged).toBe("run-status-changed");
    expect(SharedApiRealtimeEventKinds.queueItemEnqueued).toBe("queue-item-enqueued");
    expect(SharedApiQueryDefaults.defaultLimit).toBeGreaterThan(0);
    expect(SharedApiQueryDefaults.maxLimit).toBeGreaterThanOrEqual(SharedApiQueryDefaults.defaultLimit);
    expect(SharedApiQueryDefaults.defaultOffset).toBe(0);
    expect(SharedApiSortDirections.ascending).toBe("asc");
    expect(SharedApiSortDirections.descending).toBe("desc");
  });
});

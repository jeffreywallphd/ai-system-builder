import { describe, expect, it } from "bun:test";
import { ReferenceImageCrossStudioSyncService } from "../ReferenceImageCrossStudioSyncService";

describe("ReferenceImageCrossStudioSyncService", () => {
  it("refreshes shared snapshot and keeps outputs/history selection aligned", async () => {
    const service = new ReferenceImageCrossStudioSyncService();
    const calls: string[] = [];

    const result = await service.synchronize({
      refreshSharedStudioSnapshot: async () => { calls.push("refresh"); },
      loadLatestResults: async () => {
        calls.push("outputs");
        return [{ image: { recordId: "record:new" } } as any];
      },
      loadLatestHistory: async () => {
        calls.push("history");
        return [{ inputs: { images: [{ recordId: "record:source" }] } } as any];
      },
      previousActiveResultId: "record:old",
    });

    expect(calls[0]).toBe("refresh");
    expect(result.activeResultId).toBe("record:new");
    expect(result.selectedSourceRecordId).toBe("record:source");
  });
});

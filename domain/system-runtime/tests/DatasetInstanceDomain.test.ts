import { describe, expect, it } from "bun:test";
import {
  createDatasetInstance,
  isDatasetInstanceLifecycleTransitionAllowed,
  patchDatasetInstance,
  transitionDatasetInstanceLifecycle,
} from "../DatasetInstanceDomain";

describe("DatasetInstanceDomain", () => {
  it("enforces deterministic lifecycle transition guards", () => {
    expect(isDatasetInstanceLifecycleTransitionAllowed({
      current: "provisioning",
      next: "ready",
    })).toBeTrue();
    expect(isDatasetInstanceLifecycleTransitionAllowed({
      current: "ready",
      next: "provisioning",
    })).toBeFalse();
    expect(isDatasetInstanceLifecycleTransitionAllowed({
      current: "archived",
      next: "ready",
    })).toBeFalse();
  });

  it("applies immutable patch updates with canonical timestamp ordering", () => {
    const created = createDatasetInstance({
      instanceId: "dataset-instance:test-1",
      systemId: "system:test",
      datasetAssetId: "asset:test-dataset",
      role: "input-store",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      seedMetadata: { bucket: "incoming" },
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const patched = patchDatasetInstance({
      instance: created,
      patch: {
        purpose: "incoming-images",
        seedMetadata: {
          bucket: "incoming-v2",
        },
        updatedAt: "2026-04-01T00:01:00.000Z",
      },
    });
    expect(patched.purpose).toBe("incoming-images");
    expect(patched.seedMetadata?.bucket).toBe("incoming-v2");
    expect(patched.updatedAt).toBe("2026-04-01T00:01:00.000Z");

    const archived = transitionDatasetInstanceLifecycle({
      instance: patched,
      nextLifecycleStatus: "archived",
      nextRuntimeStatus: "unavailable",
      updatedAt: "2026-04-01T00:02:00.000Z",
    });
    expect(archived.lifecycleStatus).toBe("archived");
    expect(archived.runtimeStatus).toBe("unavailable");

    expect(() => transitionDatasetInstanceLifecycle({
      instance: archived,
      nextLifecycleStatus: "ready",
      updatedAt: "2026-04-01T00:03:00.000Z",
    })).toThrow("cannot transition lifecycle");
  });
});

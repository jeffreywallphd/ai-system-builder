import { describe, expect, it } from "bun:test";
import {
  DatasetInstanceStorageContractVersion,
  createDatasetInstance,
  findDatasetInstanceStorageBinding,
  isDatasetInstanceLifecycleTransitionAllowed,
  patchDatasetInstance,
  resolveDatasetInstanceStorageBinding,
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
      storageBindings: [
        {
          storageInstanceId: "storage-instance:reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Areference-runtime",
          bindingArea: "input",
          bindingId: "storage-binding:reference-runtime:input",
          bindingReference: "storage-instance://storage-instance%3Areference-runtime/input",
        },
        {
          storageInstanceId: "storage-instance:reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Areference-runtime",
          bindingArea: "output",
          bindingId: "storage-binding:reference-runtime:output",
          bindingReference: "storage-instance://storage-instance%3Areference-runtime/output",
        },
      ],
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
    expect(patched.storageContractVersion).toBe(DatasetInstanceStorageContractVersion);
    expect(patched.storageBindings?.length).toBe(2);
    expect(findDatasetInstanceStorageBinding({ instance: patched, area: "output" })?.bindingArea).toBe("output");
    expect(resolveDatasetInstanceStorageBinding({ instance: patched, preferredArea: "input" })?.bindingArea).toBe("input");
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

  it("rejects path-like dataset storage binding configuration", () => {
    expect(() => createDatasetInstance({
      instanceId: "dataset-instance:test-2",
      systemId: "system:test",
      datasetAssetId: "asset:test-dataset",
      role: "input-store",
      storageBindings: [{
        storageInstanceId: "/tmp/storage",
        storageInstanceRef: "storage-instance://tmp-storage",
        bindingArea: "input",
        bindingId: "storage-binding:tmp-storage:input",
        bindingReference: "storage-instance://tmp-storage/input",
      }],
    })).toThrow("storage bindings must use storage-instance identities");
  });
});

import { describe, expect, it } from "bun:test";
import { createDatasetInstance } from "../DatasetInstanceDomain";
import {
  createSystemDatasetBindingFromInstance,
  mapSystemBindingRoleToDatasetInstanceRole,
} from "../SystemDatasetBindingDomain";

describe("SystemDatasetBindingDomain", () => {
  it("maps runtime dataset instance roles to explicit system binding roles", () => {
    const inputInstance = createDatasetInstance({
      instanceId: "dataset-instance:input",
      systemId: "system:image-pipeline",
      datasetAssetId: "dataset-asset:image-input",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const outputInstance = createDatasetInstance({
      instanceId: "dataset-instance:output",
      systemId: "system:image-pipeline",
      datasetAssetId: "dataset-asset:image-output",
      datasetAssetVersionId: "1.0.0",
      role: "output-store",
      purpose: "workflow-output-images",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const intermediateInstance = createDatasetInstance({
      instanceId: "dataset-instance:intermediate",
      systemId: "system:image-pipeline",
      datasetAssetId: "dataset-asset:image-stage",
      datasetAssetVersionId: "1.0.0",
      role: "intermediate-store",
      purpose: "stage:enhance",
      lifecycleStatus: "ready",
      runtimeStatus: "idle",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(createSystemDatasetBindingFromInstance(inputInstance).role).toBe("input");
    expect(createSystemDatasetBindingFromInstance(outputInstance).role).toBe("output");
    expect(createSystemDatasetBindingFromInstance(intermediateInstance).role).toBe("intermediate");
  });

  it("maps explicit binding roles back to runtime dataset instance roles", () => {
    expect(mapSystemBindingRoleToDatasetInstanceRole("input")).toBe("input-store");
    expect(mapSystemBindingRoleToDatasetInstanceRole("output")).toBe("output-store");
    expect(mapSystemBindingRoleToDatasetInstanceRole("intermediate")).toBe("intermediate-store");
  });
});

import { describe, expect, it } from "bun:test";
import {
  createStorageInstanceProvisioningRequest,
  createStorageInstanceProvisioningResult,
  createStorageLogicalReference,
  parseStorageLogicalReference,
  validateStorageInstanceProvisioningRequest,
} from "../StorageInstanceProvisioningContract";

describe("StorageInstanceProvisioningContract", () => {
  it("normalizes provisioning requests with deduplicated logical binding areas", () => {
    const request = createStorageInstanceProvisioningRequest({
      instanceId: "storage-instance:alpha",
      requestedBindings: ["input", "output", "reference", "input"],
      reuseExisting: true,
      contractVersion: "1.0.0",
      metadata: { source: "tests" },
    });

    expect(request.requestedBindings).toEqual(["input", "output", "reference"]);
    expect(request.contractVersion).toBe("1.0.0");
  });

  it("provides deterministic logical references for storage bindings", () => {
    expect(createStorageLogicalReference("storage-instance:alpha", "output")).toBe("storage-instance://storage-instance%3Aalpha/output");
  });

  it("validates and freezes provisioning results", () => {
    const result = createStorageInstanceProvisioningResult({
      instanceId: "storage-instance:alpha",
      storageInstanceRef: "storage-instance://storage-instance%3Aalpha",
      provider: "local-filesystem-storage-instance",
      bindings: [
        {
          bindingId: "storage-binding:storage-instance:alpha:input",
          area: "input",
          reference: "storage-instance://storage-instance%3Aalpha/input",
          provider: "local-filesystem-storage-instance",
          metadata: {},
        },
      ],
      metadata: { reused: true },
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.bindings[0]?.area).toBe("input");
  });

  it("rejects invalid provisioning request payloads", () => {
    expect(() => validateStorageInstanceProvisioningRequest({
      instanceId: " ",
      requestedBindings: [],
    })).toThrow();
  });

  it("rejects storage references that include nested path segments beyond logical binding area", () => {
    expect(() => parseStorageLogicalReference(
      "storage-instance://storage-instance%3Aalpha/output/runs/run-1",
    )).toThrow("must target an instance root or a single logical area");
  });
});

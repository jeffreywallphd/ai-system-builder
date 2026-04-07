import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorageInstanceProvisioner } from "../LocalStorageInstanceProvisioner";

describe("LocalStorageInstanceProvisioner", () => {
  it("provisions deterministic instance-backed directories under /storage/{instanceId}", async () => {
    const storageRoot = mkdtempSync(path.join(tmpdir(), "storage-instance-root-"));
    try {
      const provisioner = new LocalStorageInstanceProvisioner({ storageRootDirectory: storageRoot });
      const result = await provisioner.provision({
        instanceId: "instance:image-pipeline",
        requestedBindings: ["input", "output", "reference", "intermediate"],
        reuseExisting: true,
        metadata: {},
      });

      expect(result.provider).toBe("local-filesystem-storage-instance");
      expect(result.storageInstanceRef).toBe("storage-instance://instance%3Aimage-pipeline");
      expect(result.filesystem.instanceDirectory).toBe(path.join(storageRoot, "instance:image-pipeline"));
      expect(result.filesystem.bindings.map((entry) => entry.relativePath)).toEqual([
        "instance:image-pipeline/input",
        "instance:image-pipeline/output",
        "instance:image-pipeline/reference",
        "instance:image-pipeline/intermediate",
      ]);
      expect(result.bindings.map((entry) => entry.reference)).toEqual([
        "storage-instance://instance%3Aimage-pipeline/input",
        "storage-instance://instance%3Aimage-pipeline/output",
        "storage-instance://instance%3Aimage-pipeline/reference",
        "storage-instance://instance%3Aimage-pipeline/intermediate",
      ]);
    } finally {
      rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("keeps filesystem details constrained to infrastructure-specific result extensions", async () => {
    const storageRoot = mkdtempSync(path.join(tmpdir(), "storage-instance-root-"));
    try {
      const provisioner = new LocalStorageInstanceProvisioner({ storageRootDirectory: storageRoot });
      const result = await provisioner.provision({
        instanceId: "instance:shared-output",
        requestedBindings: ["output"],
        reuseExisting: true,
        metadata: { shared: true },
      });

      expect(result.bindings[0]?.area).toBe("output");
      expect(result.bindings[0]?.reference).toBe("storage-instance://instance%3Ashared-output/output");
      expect(result.filesystem.bindings[0]?.absolutePath).toBe(path.join(storageRoot, "instance:shared-output", "output"));
    } finally {
      rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("keeps distinct storage instances isolated under separate deterministic roots", async () => {
    const storageRoot = mkdtempSync(path.join(tmpdir(), "storage-instance-root-"));
    try {
      const provisioner = new LocalStorageInstanceProvisioner({ storageRootDirectory: storageRoot });
      const alpha = await provisioner.provision({
        instanceId: "instance:alpha",
        requestedBindings: ["input", "output"],
        reuseExisting: true,
        metadata: {},
      });
      const beta = await provisioner.provision({
        instanceId: "instance:beta",
        requestedBindings: ["input", "output"],
        reuseExisting: true,
        metadata: {},
      });

      expect(alpha.filesystem.instanceDirectory).toBe(path.join(storageRoot, "instance:alpha"));
      expect(beta.filesystem.instanceDirectory).toBe(path.join(storageRoot, "instance:beta"));
      expect(alpha.filesystem.bindings.map((entry) => entry.absolutePath)).not.toEqual(
        beta.filesystem.bindings.map((entry) => entry.absolutePath),
      );
    } finally {
      rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("keeps storage provisioning isolated from sibling /systems directories", async () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), "storage-systems-separation-"));
    const storageRoot = path.join(appRoot, "storage");
    const systemsRoot = path.join(appRoot, "systems");
    try {
      const provisioner = new LocalStorageInstanceProvisioner({ storageRootDirectory: storageRoot });
      const result = await provisioner.provision({
        instanceId: "instance:shared",
        requestedBindings: ["input", "output"],
        reuseExisting: true,
        metadata: {},
      });
      expect(result.filesystem.instanceDirectory.startsWith(storageRoot)).toBeTrue();
      expect(result.filesystem.instanceDirectory.startsWith(systemsRoot)).toBeFalse();
    } finally {
      rmSync(appRoot, { recursive: true, force: true });
    }
  });
});

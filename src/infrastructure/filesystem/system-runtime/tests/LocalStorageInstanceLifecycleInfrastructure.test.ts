import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStorageInstanceMetadata } from "@application/system-runtime/StorageInstanceMetadataModel";
import { LocalStorageInstanceLifecycleInfrastructure } from "../LocalStorageInstanceLifecycleInfrastructure";

describe("LocalStorageInstanceLifecycleInfrastructure", () => {
  const metadata = createStorageInstanceMetadata({
    instanceId: "storage-instance:test",
    storageInstanceRef: "storage-instance://storage-instance%3Atest",
    provider: "local",
    contractVersion: "1.0.0",
    display: { tags: [] },
    lifecycle: {
      state: "ready",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
    bindings: [
      {
        bindingId: "storage-binding:storage-instance:test:input",
        area: "input",
        reference: "storage-instance://storage-instance%3Atest/input",
        provider: "local",
      },
      {
        bindingId: "storage-binding:storage-instance:test:output",
        area: "output",
        reference: "storage-instance://storage-instance%3Atest/output",
        provider: "local",
      },
      {
        bindingId: "storage-binding:storage-instance:test:reference",
        area: "reference",
        reference: "storage-instance://storage-instance%3Atest/reference",
        provider: "local",
      },
      {
        bindingId: "storage-binding:storage-instance:test:intermediate",
        area: "intermediate",
        reference: "storage-instance://storage-instance%3Atest/intermediate",
        provider: "local",
      },
    ],
    shareability: { mode: "shared", reusable: true },
    attachments: [],
    metadata: {},
  });

  it("initializes/reset/cleanup/delete directories under storage-instance root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "storage-instance-lifecycle-"));
    try {
      const lifecycle = new LocalStorageInstanceLifecycleInfrastructure(root);
      lifecycle.initialize(metadata);

      const inputDir = path.join(root, "storage-instance:test", "input");
      const outputDir = path.join(root, "storage-instance:test", "output");
      const referenceDir = path.join(root, "storage-instance:test", "reference");
      const intermediateDir = path.join(root, "storage-instance:test", "intermediate");
      mkdirSync(path.join(intermediateDir, "tmp"), { recursive: true });
      writeFileSync(path.join(intermediateDir, "tmp", "scratch.txt"), "temp");
      writeFileSync(path.join(inputDir, "source.txt"), "input");

      lifecycle.cleanup(metadata);
      expect(readdirSync(intermediateDir)).toEqual([]);
      expect(readdirSync(inputDir)).toEqual(["source.txt"]);

      lifecycle.reset(metadata);
      expect(readdirSync(inputDir)).toEqual([]);
      expect(readdirSync(outputDir)).toEqual([]);
      expect(readdirSync(referenceDir)).toEqual([]);

      lifecycle.delete(metadata);
      expect(() => readdirSync(path.join(root, "storage-instance:test"))).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});


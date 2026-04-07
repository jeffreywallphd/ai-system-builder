import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileComfyRuntimeInstallerStateStore } from "../FileComfyRuntimeInstallerStateStore";

describe("FileComfyRuntimeInstallerStateStore", () => {
  it("persists and reloads installer state", async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "comfy-state-store-"));
    try {
      const store = new FileComfyRuntimeInstallerStateStore();
      const installDirectory = path.join(tempRoot, "runtime-comfy");
      const now = "2026-04-03T20:00:00.000Z";
      await store.save({
        schemaVersion: 1,
        runtimeDependencyId: "runtime:comfyui",
        runtimeAssetId: "asset:config-profile:comfyui-runtime-installation",
        runtimeAssetVersionId: "asset:config-profile:comfyui-runtime-installation:v1",
        installLocationKey: "runtime-comfy",
        installDirectory,
        runtimeWorkingDirectory: installDirectory,
        runtimeEndpoint: "http://127.0.0.1:8188",
        repositoryState: "installed",
        orchestrationState: "ready",
        phases: {},
        issues: [],
        diagnostics: {},
        startedAt: now,
        updatedAt: now,
      });

      const loaded = await store.load({ installDirectory });
      expect(loaded.state?.runtimeDependencyId).toBe("runtime:comfyui");
      expect(loaded.state?.repositoryState).toBe("installed");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

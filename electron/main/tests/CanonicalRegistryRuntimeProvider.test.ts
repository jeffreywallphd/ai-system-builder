import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCanonicalRegistryRuntimeProvider } from "../runtime/CanonicalRegistryRuntimeProvider";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";

describe("canonical registry runtime provider", () => {
  it("throws when deferred runtime is unavailable", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "canonical-runtime-provider-missing-"));
    const provider = createCanonicalRegistryRuntimeProvider({
      storagePaths: {
        appDataDirectory: tmpRoot,
        storageDirectory: path.join(tmpRoot, "storage"),
        databasePath: path.join(tmpRoot, "storage", "ai-loom-studio.sqlite"),
        runtimeDirectory: path.join(tmpRoot, "runtime"),
        logsDirectory: path.join(tmpRoot, "logs"),
        assetsDirectory: path.join(tmpRoot, "assets"),
        modelsDirectory: path.join(tmpRoot, "models"),
      },
      getDeferredFeatureRuntime: () => undefined,
    });

    await expect(provider.ensureCanonicalRegistryRuntime()).rejects.toThrow("Deferred desktop feature runtime is unavailable.");

    provider.dispose();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("memoizes runtime and rebuilds after dispose", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "canonical-runtime-provider-"));
    const storagePaths = {
      appDataDirectory: tmpRoot,
      storageDirectory: path.join(tmpRoot, "storage"),
      databasePath: path.join(tmpRoot, "storage", "ai-loom-studio.sqlite"),
      runtimeDirectory: path.join(tmpRoot, "runtime"),
      logsDirectory: path.join(tmpRoot, "logs"),
      assetsDirectory: path.join(tmpRoot, "assets"),
      modelsDirectory: path.join(tmpRoot, "models"),
    };
    fs.mkdirSync(storagePaths.assetsDirectory, { recursive: true });

    const deferredRuntime = {
      ensureSystemRuntimeBackendApi: () => ({
        listRecentExecutionsForSystem: async () => ({ ok: true, data: [] }),
      }),
      ensureWorkflowPersistenceRepository: () => ({
        list: async () => [],
      }),
    } as unknown as DeferredDesktopFeatureRuntime;

    const provider = createCanonicalRegistryRuntimeProvider({
      storagePaths,
      getDeferredFeatureRuntime: () => deferredRuntime,
    });

    const first = await provider.ensureCanonicalRegistryRuntime();
    const second = await provider.ensureCanonicalRegistryRuntime();
    expect(second).toBe(first);

    provider.dispose();
    const third = await provider.ensureCanonicalRegistryRuntime();
    expect(third).not.toBe(first);

    provider.dispose();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});

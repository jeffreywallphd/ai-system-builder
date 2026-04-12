import { describe, expect, it } from "bun:test";
import type { IPythonRuntimeManager } from "../interfaces/IPythonRuntimeManager";

describe("IPythonRuntimeManager contract", () => {
  it("supports health checks, ensure, restart, status, and stop", async () => {
    const manager: IPythonRuntimeManager = {
      checkAvailability: async () => true,
      ensureRuntimeAvailability: async () => ({
        status: "healthy",
        isAvailable: true,
        owner: "external",
        lastUpdatedAt: new Date().toISOString(),
      }),
      restartRuntime: async () => ({
        status: "healthy",
        isAvailable: true,
        owner: "external",
        lastUpdatedAt: new Date().toISOString(),
      }),
      getStatus: () => ({
        status: "healthy",
        isAvailable: true,
        owner: "external",
        lastUpdatedAt: new Date().toISOString(),
      }),
      stopManagedRuntime: async () => undefined,
    };

    expect(await manager.checkAvailability()).toBeTrue();
    expect((await manager.ensureRuntimeAvailability()).status).toBe("healthy");
    expect((await manager.restartRuntime()).status).toBe("healthy");
    await expect(manager.stopManagedRuntime()).resolves.toBeUndefined();
  });
});

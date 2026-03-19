import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { RuntimeConsoleStore } from "../RuntimeConsoleStore";

describe("RuntimeConsoleStore", () => {
  it("subscribes to runtime events and supports clear/toggle", () => {
    const eventStore = new RuntimeEventBuffer();
    const store = new RuntimeConsoleStore({
      runtimeEventStore: eventStore,
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({
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
      },
    });

    eventStore.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "boot" }));
    expect(store.getState().events).toHaveLength(1);

    store.toggleExpanded();
    expect(store.getState().isExpanded).toBeTrue();

    store.clearEvents();
    expect(store.getState().events).toHaveLength(0);
  });

  it("initializes runtime once", async () => {
    let calls = 0;
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => {
          calls += 1;
          return {
            status: "healthy" as const,
            isAvailable: true,
            owner: "external" as const,
            lastUpdatedAt: new Date().toISOString(),
          };
        },
        getStatus: () => ({
          status: "healthy",
          isAvailable: true,
          owner: "external",
          lastUpdatedAt: new Date().toISOString(),
        }),
        stopManagedRuntime: async () => undefined,
      },
    });

    await Promise.all([store.initializeRuntime(), store.initializeRuntime()]);
    expect(calls).toBe(1);
  });
  it("swallows runtime initialization failures", async () => {
    const store = new RuntimeConsoleStore({
      runtimeEventStore: new RuntimeEventBuffer(),
      pythonRuntimeManager: {
        checkAvailability: async () => false,
        ensureRuntimeAvailability: async () => {
          throw new Error("runtime unavailable");
        },
        getStatus: () => ({
          status: "unavailable",
          isAvailable: false,
          owner: "none",
          lastUpdatedAt: new Date().toISOString(),
        }),
        stopManagedRuntime: async () => undefined,
      },
    });

    await expect(store.initializeRuntime()).resolves.toBeUndefined();
  });

});

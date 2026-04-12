import { describe, expect, it } from "bun:test";
import { createWorkflowsBridge } from "../bridge/createWorkflowsBridge";

function createIpcRendererStub() {
  const calls: Array<{ method: "sendSync" | "invoke"; channel: string; args: ReadonlyArray<unknown> }> = [];
  return {
    calls,
    ipcRenderer: {
      sendSync(channel: string, ...args: ReadonlyArray<unknown>) {
        calls.push({ method: "sendSync", channel, args });
        if (channel === "ai-loom-desktop-workflows:status") {
          return {
            provider: "desktop",
            workflowsDirectory: "/tmp/workflows",
            indexDatabasePath: "/tmp/index.sqlite",
            degraded: false,
            detail: "ok",
          };
        }
        return null;
      },
      invoke: async () => undefined,
    },
  };
}

describe("createWorkflowsBridge", () => {
  it("returns deferred status and starts warmup when runtime is not ready", () => {
    const { ipcRenderer, calls } = createIpcRendererStub();
    let warmups = 0;
    const bridge = createWorkflowsBridge({
      ipcRenderer,
      isDeferredFeatureApiReady: () => false,
      startDeferredFeatureWarmupOnDemand: () => {
        warmups += 1;
      },
    });

    const status = bridge.getWorkflowPersistenceStatus();

    expect(status.provider).toBe("desktop-runtime-deferred");
    expect(status.degraded).toBe(true);
    expect(warmups).toBe(1);
    expect(calls.length).toBe(0);
  });

  it("queries workflow status once runtime is ready", () => {
    const { ipcRenderer, calls } = createIpcRendererStub();
    const bridge = createWorkflowsBridge({
      ipcRenderer,
      isDeferredFeatureApiReady: () => true,
      startDeferredFeatureWarmupOnDemand: () => {
        throw new Error("should not warmup");
      },
    });

    const status = bridge.getWorkflowPersistenceStatus();

    expect(status.provider).toBe("desktop");
    expect(calls).toEqual([
      {
        method: "sendSync",
        channel: "ai-loom-desktop-workflows:status",
        args: [],
      },
    ]);
  });
});

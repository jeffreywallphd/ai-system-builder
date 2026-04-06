import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "../../../application/common/HostCompositionContracts";
import { DesktopHostRuntime } from "../../HostRuntimeCatalog";
import { createHostLifecycleCoordinator } from "../HostLifecycleCoordinator";

describe("HostLifecycleCoordinator", () => {
  it("records startup completion and readiness markers", async () => {
    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "lifecycle-startup-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });
    const lifecycle = createHostLifecycleCoordinator({ boot });

    await lifecycle.markComposing("compose-desktop-host");
    await lifecycle.markStarting("start-desktop-host");
    await lifecycle.markStartupCompleted({
      transitionReason: "desktop-host-ready",
      completionReason: "desktop-host-startup-completed",
      readinessMarker: "desktop-host:ready",
      metadata: Object.freeze({
        stageCount: "6",
      }),
    });

    expect(lifecycle.phase).toBe("ready");
    expect(lifecycle.readiness?.marker).toBe("desktop-host:ready");
    expect(lifecycle.transitionHistory.map((entry) => entry.to)).toEqual([
      "composing",
      "starting",
      "ready",
    ]);
    expect(lifecycle.lifecycleEvents.some((event) => event.type === "startup-completed")).toBeTrue();
    expect(lifecycle.lifecycleEvents.some((event) => event.type === "readiness-marked")).toBeTrue();
  });

  it("runs shutdown cleanup hooks in order and completes shutdown", async () => {
    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "lifecycle-shutdown-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });
    const lifecycle = createHostLifecycleCoordinator({ boot });
    const observedHooks: string[] = [];

    await lifecycle.markComposing("compose-desktop-host");
    await lifecycle.markStarting("start-desktop-host");
    await lifecycle.markStartupCompleted({
      transitionReason: "desktop-host-ready",
      completionReason: "desktop-host-startup-completed",
      readinessMarker: "desktop-host:ready",
    });
    await lifecycle.shutdown({
      shutdownRequestedReason: "desktop-host-stop-requested",
      shutdownCompletedReason: "desktop-host-stopped",
      shutdownFailureReason: "desktop-host-stop-failed",
      cleanupHooks: [{
        hookId: "runtime-close",
        run: async () => {
          observedHooks.push("runtime-close");
        },
      }, {
        hookId: "runtime-drain",
        run: async () => {
          observedHooks.push("runtime-drain");
        },
      }],
    });

    expect(observedHooks).toEqual(["runtime-close", "runtime-drain"]);
    expect(lifecycle.phase).toBe("stopped");
    expect(lifecycle.lifecycleEvents.some((event) => event.type === "shutdown-requested")).toBeTrue();
    expect(lifecycle.lifecycleEvents.some((event) => event.type === "shutdown-completed")).toBeTrue();
  });

  it("marks lifecycle as failed when startup fails", async () => {
    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "lifecycle-startup-failure-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });
    const lifecycle = createHostLifecycleCoordinator({ boot });
    const failure = new Error("startup failed");

    await lifecycle.markComposing("compose-desktop-host");
    await lifecycle.markStartupFailed("desktop-host-start-failed", failure);

    expect(lifecycle.phase).toBe("failed");
    expect(lifecycle.lifecycleEvents.some((event) => event.type === "startup-failed")).toBeTrue();
  });
});

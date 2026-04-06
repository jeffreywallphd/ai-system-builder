import { describe, expect, it } from "bun:test";
import { HostCapabilityFlags } from "../../../domain/hosts/HostRuntimeDomain";
import { HostBootModes } from "../../../application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  WorkerHostEnvironmentKeys,
  constructWorkerHostAssembly,
  createWorkerHostBootConfiguration,
  resolveWorkerHostEntrypointOptionsFromEnvironment,
  startWorkerHostAssembly,
} from "../WorkerHostEntrypoint";

describe("WorkerHostEntrypoint", () => {
  it("constructs a boot configuration with worker defaults", () => {
    const boot = createWorkerHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:worker:runtime");
    expect(boot.mode).toBe(HostBootModes.coldStart);
    expect(boot.requiredDependencyIds.length).toBe(3);
    expect(boot.requiredDependencyIds).toContain("dep:application:worker-execution-services");
  });

  it("constructs and starts worker host assembly through the dedicated entrypoint", async () => {
    const observedStageOrder: string[] = [];
    let stopCount = 0;

    const assembly = constructWorkerHostAssembly({
      startHost: async () => ({
        close: async () => {
          stopCount += 1;
        },
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: () => {
            observedStageOrder.push(HostBootstrapStageIds.configuration);
          },
          [HostBootstrapStageIds.dependencies]: () => {
            observedStageOrder.push(HostBootstrapStageIds.dependencies);
          },
          [HostBootstrapStageIds.logging]: () => {
            observedStageOrder.push(HostBootstrapStageIds.logging);
          },
          [HostBootstrapStageIds.security]: () => {
            observedStageOrder.push(HostBootstrapStageIds.security);
          },
          [HostBootstrapStageIds.persistence]: () => {
            observedStageOrder.push(HostBootstrapStageIds.persistence);
          },
        },
      },
      boot: {
        startupReason: "worker-host-entrypoint-test",
      },
    });

    expect(assembly.compositionRoot.compositionRootId).toBe("composition-root:host:worker:runtime");
    expect(assembly.boot.startupReason).toBe("worker-host-entrypoint-test");

    const runtime = await startWorkerHostAssembly({
      startHost: async () => ({
        close: async () => {
          stopCount += 1;
        },
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: () => {
            observedStageOrder.push(HostBootstrapStageIds.configuration);
          },
          [HostBootstrapStageIds.dependencies]: () => {
            observedStageOrder.push(HostBootstrapStageIds.dependencies);
          },
          [HostBootstrapStageIds.logging]: () => {
            observedStageOrder.push(HostBootstrapStageIds.logging);
          },
          [HostBootstrapStageIds.security]: () => {
            observedStageOrder.push(HostBootstrapStageIds.security);
          },
          [HostBootstrapStageIds.persistence]: () => {
            observedStageOrder.push(HostBootstrapStageIds.persistence);
          },
        },
      },
      boot: {
        startupReason: "worker-host-entrypoint-test",
      },
    });

    expect(runtime.phase).toBe("ready");
    expect(runtime.enabledCapabilities).toEqual([
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ]);
    expect(observedStageOrder.slice(0, 5)).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "persistence",
    ]);

    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
    expect(stopCount).toBe(1);
  });

  it("resolves worker options from environment", () => {
    const options = resolveWorkerHostEntrypointOptionsFromEnvironment({
      [WorkerHostEnvironmentKeys.enableNodeExecution]: "true",
      [WorkerHostEnvironmentKeys.enableWorkerRuntime]: "true",
      [WorkerHostEnvironmentKeys.nodeRegistrationCapabilities]: "node-execution,worker-runtime",
    });

    expect(options.capabilitySelection?.enableNodeExecution).toBeTrue();
    expect(options.capabilitySelection?.enableWorkerRuntime).toBeTrue();
    expect(options.nodeRegistrationCapabilities).toEqual([
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ]);
  });
});

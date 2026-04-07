import { describe, expect, it } from "bun:test";
import { HostBootModes } from "@application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  HybridHostAssemblyModes,
  HybridHostEnvironmentKeys,
  constructHybridHostAssembly,
  createHybridHostBootConfiguration,
  resolveHybridHostEntrypointOptionsFromEnvironment,
  startHybridHostAssembly,
} from "../HybridHostEntrypoint";
import { HybridHostControlPlaneSources } from "../HybridHostCompositionRoot";

describe("HybridHostEntrypoint", () => {
  it("constructs a boot configuration with hybrid defaults", () => {
    const boot = createHybridHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:hybrid:desktop-worker");
    expect(boot.mode).toBe(HostBootModes.coldStart);
    expect(boot.requiredDependencyIds.length).toBe(4);
    expect(boot.requiredDependencyIds).toContain("dep:application:hybrid-orchestration-services");
  });

  it("constructs and starts hybrid host assembly through the dedicated entrypoint", async () => {
    const observedStageOrder: string[] = [];
    let stopCount = 0;

    const assembly = constructHybridHostAssembly({
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
        startupReason: "hybrid-host-entrypoint-test",
      },
    });

    expect(assembly.assemblyMode).toBe(HybridHostAssemblyModes.hybridClient);
    expect(assembly.compositionRoot?.compositionRootId).toBe("composition-root:host:hybrid:desktop-worker");
    expect(assembly.boot?.startupReason).toBe("hybrid-host-entrypoint-test");

    const runtime = await startHybridHostAssembly({
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
        startupReason: "hybrid-host-entrypoint-test",
      },
    });

    expect(runtime.host.hostId).toBe("host:hybrid:desktop-worker");
    expect(runtime.phase).toBe("ready");
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

  it("can delegate intentionally to authoritative server assembly mode", async () => {
    const runtime = await startHybridHostAssembly({
      assemblyMode: HybridHostAssemblyModes.authoritativeServerHost,
      authoritativeServerOptions: {
        hostOptions: {
          databasePath: "test.sqlite",
        },
        startHost: async () => ({
          port: 7300,
          address: "127.0.0.1:7300",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        }),
      },
    });

    expect(runtime.host.hostId).toBe("host:server:authoritative");
    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
  });

  it("resolves hybrid client options from environment", () => {
    const options = resolveHybridHostEntrypointOptionsFromEnvironment({
      [HybridHostEnvironmentKeys.mode]: HybridHostAssemblyModes.hybridClient,
      [HybridHostEnvironmentKeys.controlPlaneSource]: HybridHostControlPlaneSources.remoteAuthoritativeServer,
      [HybridHostEnvironmentKeys.enableNodeExecution]: "true",
      [HybridHostEnvironmentKeys.enableWorkerRuntime]: "true",
    });

    expect(options.assemblyMode).toBe(HybridHostAssemblyModes.hybridClient);
    expect(options.controlPlaneSource).toBe(HybridHostControlPlaneSources.remoteAuthoritativeServer);
    expect(options.capabilitySelection?.enableNodeExecution).toBeTrue();
    expect(options.capabilitySelection?.enableWorkerRuntime).toBeTrue();
  });

  it("resolves authoritative delegation mode from environment", () => {
    const options = resolveHybridHostEntrypointOptionsFromEnvironment({
      [HybridHostEnvironmentKeys.mode]: HybridHostAssemblyModes.authoritativeServerHost,
      AI_LOOM_SERVER_DATABASE_PATH: "C:/tmp/authoritative.sqlite",
      AI_LOOM_SERVER_PORT: "7400",
    });

    expect(options.assemblyMode).toBe(HybridHostAssemblyModes.authoritativeServerHost);
    expect(options.authoritativeServerOptions?.hostOptions.databasePath).toBe("C:/tmp/authoritative.sqlite");
    expect(options.authoritativeServerOptions?.hostOptions.port).toBe(7400);
  });
});


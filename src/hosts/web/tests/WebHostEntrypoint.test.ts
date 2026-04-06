import { describe, expect, it } from "bun:test";
import { HostBootModes } from "../../../application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  WebHostEnvironmentKeys,
  constructWebHostAssembly,
  createWebHostBootConfiguration,
  resolveWebHostEntrypointOptionsFromEnvironment,
  startWebHostAssembly,
} from "../WebHostEntrypoint";

describe("WebHostEntrypoint", () => {
  it("constructs a boot configuration with web defaults", () => {
    const boot = createWebHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:web:thin-client");
    expect(boot.mode).toBe(HostBootModes.coldStart);
    expect(boot.requiredDependencyIds.length).toBe(3);
    expect(boot.requiredDependencyIds).toContain("dep:application:web-runtime-services");
  });

  it("constructs and starts web host assembly through the dedicated entrypoint", async () => {
    const observedStageOrder: string[] = [];
    let stopCount = 0;

    const assembly = constructWebHostAssembly({
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
        startupReason: "web-host-entrypoint-test",
      },
    });

    expect(assembly.compositionRoot.compositionRootId).toBe("composition-root:host:web:thin-client");
    expect(assembly.boot.startupReason).toBe("web-host-entrypoint-test");

    const runtime = await startWebHostAssembly({
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
        startupReason: "web-host-entrypoint-test",
      },
    });

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

  it("resolves runtime options from environment", () => {
    const options = resolveWebHostEntrypointOptionsFromEnvironment({
      [WebHostEnvironmentKeys.deliveryMode]: "static-shell",
      [WebHostEnvironmentKeys.basePath]: "/app",
    });

    expect(options.hostOptions?.deliveryMode).toBe("static-shell");
    expect(options.hostOptions?.basePath).toBe("/app");
    expect(options.boot?.environment?.[WebHostEnvironmentKeys.basePath]).toBe("/app");
  });
});

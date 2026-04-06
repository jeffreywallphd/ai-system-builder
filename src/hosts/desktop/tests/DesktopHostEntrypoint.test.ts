import { describe, expect, it } from "bun:test";
import { HostBootModes } from "../../../application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  constructDesktopHostAssembly,
  createDesktopHostBootConfiguration,
  startDesktopHostAssembly,
} from "../DesktopHostEntrypoint";

describe("DesktopHostEntrypoint", () => {
  it("constructs a boot configuration with desktop defaults", () => {
    const boot = createDesktopHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:desktop:app-shell");
    expect(boot.mode).toBe(HostBootModes.coldStart);
    expect(boot.requiredDependencyIds.length).toBe(4);
    expect(boot.requiredDependencyIds).toContain("dep:application:desktop-runtime-services");
  });

  it("constructs and starts desktop host assembly through the dedicated entrypoint", async () => {
    const observedStageOrder: string[] = [];
    let stopCount = 0;

    const assembly = constructDesktopHostAssembly({
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
        startupReason: "desktop-host-entrypoint-test",
      },
    });

    expect(assembly.compositionRoot.compositionRootId).toBe("composition-root:host:desktop:app-shell");
    expect(assembly.boot.startupReason).toBe("desktop-host-entrypoint-test");

    const runtime = await startDesktopHostAssembly({
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
        startupReason: "desktop-host-entrypoint-test",
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
});

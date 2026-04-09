import { describe, expect, it } from "bun:test";
import { HostBootModes } from "@application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  AuthoritativeServerHostEnvironmentKeys,
  constructAuthoritativeServerHostAssembly,
  createAuthoritativeServerHostBootConfiguration,
  resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment,
  startAuthoritativeServerHostAssembly,
} from "../AuthoritativeServerHostEntrypoint";

describe("AuthoritativeServerHostEntrypoint", () => {
  it("constructs a boot configuration with authoritative defaults", () => {
    const boot = createAuthoritativeServerHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:server:authoritative");
    expect(boot.mode).toBe(HostBootModes.coldStart);
    expect(boot.requiredDependencyIds.length).toBe(4);
    expect(boot.requiredDependencyIds).toContain("dep:application:control-plane-services");
  });

  it("constructs a server assembly and starts it through the dedicated entrypoint", async () => {
    const observedStageOrder: string[] = [];
    let stopCount = 0;

    const assembly = constructAuthoritativeServerHostAssembly({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 6200,
        address: "127.0.0.1:6200",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
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
        startupReason: "authoritative-server-entrypoint-test",
      },
    });

    expect(assembly.compositionRoot.compositionRootId).toBe("composition-root:host:server:authoritative");
    expect(assembly.boot.startupReason).toBe("authoritative-server-entrypoint-test");

    const runtime = await startAuthoritativeServerHostAssembly({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 6200,
        address: "127.0.0.1:6200",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
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
        startupReason: "authoritative-server-entrypoint-test",
      },
    });

    expect(runtime.phase).toBe("ready");
    expect(runtime.address).toBe("127.0.0.1:6200");
    expect(typeof runtime.startupCorrelationId).toBe("string");
    expect((runtime.startupCorrelationId ?? "").length).toBeGreaterThan(10);
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
    const options = resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment({
      [AuthoritativeServerHostEnvironmentKeys.databasePath]: "C:/tmp/host.sqlite",
      [AuthoritativeServerHostEnvironmentKeys.host]: "127.0.0.1",
      [AuthoritativeServerHostEnvironmentKeys.port]: "4300",
    });

    expect(options.hostOptions.databasePath).toBe("C:/tmp/host.sqlite");
    expect(options.hostOptions.host).toBe("127.0.0.1");
    expect(options.hostOptions.port).toBe(4300);
    expect(options.boot?.environment?.[AuthoritativeServerHostEnvironmentKeys.databasePath]).toBe("C:/tmp/host.sqlite");
  });
});


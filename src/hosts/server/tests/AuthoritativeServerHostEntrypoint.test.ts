import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { HostBootModes } from "@application/common/HostCompositionContracts";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  AuthoritativeServerHostEnvironmentKeys,
  constructAuthoritativeServerHostAssembly,
  createAuthoritativeServerHostBootConfiguration,
  resolveAuthoritativeServerHostEntrypointOptionsFromEnvironment,
  startAuthoritativeServerHostAssembly,
} from "../AuthoritativeServerHostEntrypoint";
import { DefaultAuthoritativeServerStartupBaselineFileName } from "../AuthoritativeServerStartupBaselineRecorder";

class CapturingHostLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly warnEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(event: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(event);
  }

  public warn(event: Readonly<Record<string, unknown>>): void {
    this.warnEvents.push(event);
  }

  public error(event: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(event);
  }
}

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
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-authoritative-entrypoint-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");

    try {
      const assembly = constructAuthoritativeServerHostAssembly({
        hostOptions: {
          databasePath,
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
          databasePath,
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
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("creates and updates a local startup baseline JSON file across startup runs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-authoritative-baseline-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");
    const baselinePath = path.join(tempRoot, DefaultAuthoritativeServerStartupBaselineFileName);

    try {
      const firstRuntime = await startAuthoritativeServerHostAssembly({
        hostOptions: {
          databasePath,
        },
        startHost: async () => ({
          port: 6210,
          address: "127.0.0.1:6210",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        }),
        boot: {
          startupReason: "authoritative-server-baseline-recording-test-first-run",
          environment: {
            NODE_ENV: "development",
          },
        },
      });
      await firstRuntime.stop();

      const firstBaseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
        readonly hostId: string;
        readonly sampleCount: number;
        readonly samples: ReadonlyArray<{
          readonly startupReason: string;
          readonly durationMs: number;
        }>;
      };
      expect(firstBaseline.hostId).toBe("host:server:authoritative");
      expect(firstBaseline.sampleCount).toBe(1);
      expect(firstBaseline.samples[0]?.startupReason).toBe("authoritative-server-baseline-recording-test-first-run");
      expect((firstBaseline.samples[0]?.durationMs ?? 0)).toBeGreaterThanOrEqual(0);

      const secondRuntime = await startAuthoritativeServerHostAssembly({
        hostOptions: {
          databasePath,
        },
        startHost: async () => ({
          port: 6211,
          address: "127.0.0.1:6211",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        }),
        boot: {
          startupReason: "authoritative-server-baseline-recording-test-second-run",
          environment: {
            NODE_ENV: "development",
          },
        },
      });
      await secondRuntime.stop();

      const secondBaseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
        readonly sampleCount: number;
        readonly samples: ReadonlyArray<{
          readonly startupReason: string;
          readonly durationMs: number;
        }>;
      };
      expect(secondBaseline.sampleCount).toBe(2);
      expect(secondBaseline.samples[1]?.startupReason).toBe("authoritative-server-baseline-recording-test-second-run");
      expect((secondBaseline.samples[1]?.durationMs ?? 0)).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("emits regression warning when startup duration exceeds configured threshold", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-authoritative-baseline-warning-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");
    const logger = new CapturingHostLogger();

    try {
      const firstRuntime = await startAuthoritativeServerHostAssembly({
        hostOptions: {
          databasePath,
          logger,
        },
        startHost: async () => ({
          port: 6212,
          address: "127.0.0.1:6212",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        }),
        boot: {
          startupReason: "authoritative-server-baseline-warning-test-first-run",
          environment: {
            NODE_ENV: "development",
            [AuthoritativeServerHostEnvironmentKeys.startupRegressionWarningThresholdMs]: "0",
          },
        },
      });
      await firstRuntime.stop();

      const secondRuntime = await startAuthoritativeServerHostAssembly({
        hostOptions: {
          databasePath,
          logger,
        },
        startHost: async () => ({
          port: 6213,
          address: "127.0.0.1:6213",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        }),
        bootstrap: {
          stageHandlers: {
            [HostBootstrapStageIds.logging]: async () => {
              await new Promise((resolve) => {
                setTimeout(resolve, 15);
              });
            },
          },
        },
        boot: {
          startupReason: "authoritative-server-baseline-warning-test-second-run",
          environment: {
            NODE_ENV: "development",
            [AuthoritativeServerHostEnvironmentKeys.startupRegressionWarningThresholdMs]: "0",
          },
        },
      });
      await secondRuntime.stop();

      const regressionWarning = logger.warnEvents.find(
        (event) => event.event === "authoritative-server.startup.baseline-regression.detected",
      );
      expect(regressionWarning).toBeDefined();
      expect(regressionWarning?.thresholdMs).toBe(0);
      expect(regressionWarning?.regressionDurationMs).toBeTypeOf("number");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
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

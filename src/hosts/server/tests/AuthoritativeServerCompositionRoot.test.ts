import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  createHostRuntimeIdentity,
} from "../../../domain/hosts/HostRuntimeDomain";
import {
  HostCompositionContractError,
  createHostBootConfiguration,
} from "../../../application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerCompositionRoot } from "../AuthoritativeServerCompositionRoot";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import type { HostServiceRegistrationPlan } from "../../../infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "../../../infrastructure/config/HostServiceRegistration";
import { AuthoritativeServerServiceRegistrationPlanArtifactKey } from "../AuthoritativeServerCompositionRoot";
import {
  HostDeploymentProfileIds,
  HostStartupEnvironmentKeys,
} from "../../../infrastructure/config/HostStartupConfiguration";
import type { SqlitePersistenceRuntime } from "../../../infrastructure/persistence/sqlite/SqlitePersistenceRuntime";

describe("AuthoritativeServerCompositionRoot", () => {
  it("composes and stops authoritative server runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 4100,
        address: "127.0.0.1:4100",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.port).toBe(4100);
    expect(runtime.phase).toBe("ready");
    expect(runtime.runtimeMetadata.hostId).toBe("host:server:authoritative");
    expect(runtime.runtimeMetadata.roleInspection.isAuthoritativeControlPlane).toBeTrue();
    expect(runtime.runtimeMetadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
    expect(runtime.readiness?.marker).toBe("authoritative-server:feature-registration-complete");
    expect(runtime.lifecycleEvents?.some((event) => event.type === "startup-completed")).toBeTrue();
    expect(runtime.transitionHistory.map((entry) => entry.to)).toEqual([
      "composing",
      "starting",
      "ready",
    ]);

    await runtime.stop();
    expect(closed).toBeTrue();
    expect(runtime.phase).toBe("stopped");
    expect(runtime.lifecycleEvents?.some((event) => event.type === "shutdown-completed")).toBeTrue();
  });

  it("rejects non-authoritative hosts for authoritative composition root", async () => {
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonAuthoritativeHost = createHostRuntimeIdentity({
      hostId: "host:worker:runtime",
      kind: HostRuntimeKinds.worker,
      controlPlaneRole: HostControlPlaneRoles.none,
      capabilities: [
        HostCapabilityFlags.workerRuntime,
        HostCapabilityFlags.nodeExecution,
      ],
      responsibilities: [
        "execute workloads",
      ],
      startupDependencies: AuthoritativeServerHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonAuthoritativeHost,
      mode: "cold-start",
      startupReason: "invalid-authority-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5200,
        address: "127.0.0.1:5200",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: () => {
            observedStages.push(HostBootstrapStageIds.configuration);
          },
          [HostBootstrapStageIds.dependencies]: () => {
            observedStages.push(HostBootstrapStageIds.dependencies);
          },
          [HostBootstrapStageIds.logging]: () => {
            observedStages.push(HostBootstrapStageIds.logging);
          },
          [HostBootstrapStageIds.security]: () => {
            observedStages.push(HostBootstrapStageIds.security);
          },
          [HostBootstrapStageIds.persistence]: () => {
            observedStages.push(HostBootstrapStageIds.persistence);
          },
        },
        hostSpecificStages: [{
          stageId: "host:server:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:server:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-customization-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:server:post-security-bootstrap",
      "persistence",
    ]);
    expect(runtime.phase).toBe("ready");
    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
  });

  it("runs default dependencies composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5300,
        address: "127.0.0.1:5300",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              AuthoritativeServerServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-dependency-stage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(AuthoritativeServerHostRuntime.hostId);
    await runtime.stop();
  });

  it("fails compose when authoritative service coverage assertions fail", async () => {
    let started = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 5400,
          address: "127.0.0.1:5400",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: AuthoritativeServerHostRuntime.hostId,
          selectedServices: Object.freeze([]),
          startupDependencyCoverage: Object.freeze({}),
          servicesByLayer: Object.freeze({
            "shared-contracts": Object.freeze([]),
            domain: Object.freeze([]),
            application: Object.freeze([]),
            infrastructure: Object.freeze([]),
            host: Object.freeze([]),
          }),
        }),
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });

  it("resolves deployment profile and enabled capabilities through shared startup configuration", async () => {
    let observedProfileId: string | undefined;
    let observedEnvironmentName: string | undefined;
    let observedCapabilities: ReadonlyArray<string> | undefined;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5500,
        address: "127.0.0.1:5500",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: (context) => {
            observedProfileId = context.deploymentProfile.profileId;
            observedEnvironmentName = context.deploymentProfile.environmentName;
            observedCapabilities = context.enabledCapabilities;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-startup-config-resolution-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        [HostStartupEnvironmentKeys.deploymentProfile]: HostDeploymentProfileIds.organization,
        [HostStartupEnvironmentKeys.environmentName]: "production",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedProfileId).toBe(HostDeploymentProfileIds.organization);
    expect(observedEnvironmentName).toBe("production");
    expect(observedCapabilities).toContain(HostCapabilityFlags.controlPlaneAuthority);
    await runtime.stop();
  });

  it("initializes and disposes persistence runtime through bootstrap and lifecycle cleanup", async () => {
    const calls: string[] = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5600,
        address: "127.0.0.1:5600",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          calls.push("host-close");
        },
      }),
      bootstrap: {
        createPersistenceRuntime: ({ hostConfiguration, environment }) => {
          expect(hostConfiguration.databasePath).toBe("test.sqlite");
          expect(environment.NODE_ENV).toBe("test");
          return Object.freeze({
            configuration: Object.freeze({
              databasePath: hostConfiguration.databasePath,
              pragmas: Object.freeze({
                journalMode: "WAL",
                foreignKeys: true,
              }),
            }),
            start: async () => {
              calls.push("persistence-start");
              return Object.freeze({
                databasePath: hostConfiguration.databasePath,
                migrationIdsApplied: Object.freeze([]),
              });
            },
            getConnection: () => {
              throw new Error("not needed for composition test");
            },
            dispose: async () => {
              calls.push("persistence-dispose");
            },
          }) satisfies SqlitePersistenceRuntime;
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-persistence-lifecycle-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        NODE_ENV: "test",
      },
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(calls).toEqual(["persistence-start"]);

    await runtime.stop();
    expect(calls).toEqual([
      "persistence-start",
      "host-close",
      "persistence-dispose",
    ]);
  });
});


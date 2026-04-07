import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  createHostRuntimeIdentity,
} from "@domain/hosts/HostRuntimeDomain";
import {
  HostCompositionContractError,
  createHostBootConfiguration,
} from "@application/common/HostCompositionContracts";
import { WorkerHostRuntime } from "../../HostRuntimeCatalog";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  WorkerEnabledCapabilitiesArtifactKey,
  WorkerServiceRegistrationPlanArtifactKey,
  createWorkerCompositionRoot,
} from "../WorkerHostCompositionRoot";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "@infrastructure/config/HostServiceRegistration";
import {
  HostDeploymentProfileIds,
  HostStartupEnvironmentKeys,
} from "@infrastructure/config/HostStartupConfiguration";

describe("WorkerHostCompositionRoot", () => {
  it("composes and stops worker host runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createWorkerCompositionRoot({
      startHost: async () => ({
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: WorkerHostRuntime,
      mode: "cold-start",
      startupReason: "worker-host-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(runtime.enabledCapabilities).toEqual([
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ]);
    expect(runtime.nodeRegistrationCapabilities).toEqual([
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ]);
    expect(runtime.runtimeMetadata.hostId).toBe("host:worker:runtime");
    expect(runtime.runtimeMetadata.roleInspection.supportsNodeExecution).toBeTrue();
    expect(runtime.runtimeMetadata.metadata.nodeRegistrationCapabilities).toBe("node-execution,worker-runtime");
    expect(runtime.readiness?.marker).toBe("worker-host:feature-registration-complete");
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

  it("rejects non-worker hosts for worker composition root", async () => {
    const root = createWorkerCompositionRoot({
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonWorkerHost = createHostRuntimeIdentity({
      hostId: "host:web:thin-client",
      kind: HostRuntimeKinds.web,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [HostCapabilityFlags.browserRuntime, HostCapabilityFlags.userInterfaceRendering],
      responsibilities: ["render browser ui"],
      startupDependencies: WorkerHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonWorkerHost,
      mode: "cold-start",
      startupReason: "invalid-worker-host-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("rejects disallowed capability combinations for worker composition", () => {
    expect(() => createWorkerCompositionRoot({
      capabilitySelection: {
        enableNodeExecution: true,
        enableWorkerRuntime: false,
      },
      startHost: async () => ({
        close: async () => {},
      }),
    })).toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createWorkerCompositionRoot({
      startHost: async () => ({
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
          stageId: "host:worker:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:worker:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: WorkerHostRuntime,
      mode: "cold-start",
      startupReason: "worker-host-customization-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:worker:post-security-bootstrap",
      "persistence",
    ]);
    await runtime.stop();
  });

  it("runs default dependency composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    let observedCapabilities: ReadonlyArray<string> | undefined;
    const root = createWorkerCompositionRoot({
      startHost: async () => ({
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              WorkerServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
            observedCapabilities = context.getArtifact<ReadonlyArray<string>>(WorkerEnabledCapabilitiesArtifactKey);
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: WorkerHostRuntime,
      mode: "cold-start",
      startupReason: "worker-host-dependency-stage-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(WorkerHostRuntime.hostId);
    expect(observedCapabilities).toContain(HostCapabilityFlags.nodeExecution);
    await runtime.stop();
  });

  it("fails compose when worker service coverage assertions fail", async () => {
    let started = false;
    const root = createWorkerCompositionRoot({
      startHost: async () => {
        started = true;
        return {
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: WorkerHostRuntime.hostId,
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
      host: WorkerHostRuntime,
      mode: "cold-start",
      startupReason: "worker-host-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });

  it("rejects node registration capabilities that are not enabled", () => {
    expect(() => createWorkerCompositionRoot({
      nodeRegistrationCapabilities: [HostCapabilityFlags.localPersistence],
      startHost: async () => ({
        close: async () => {},
      }),
    })).toThrow(HostCompositionContractError);
  });

  it("resolves deployment profile through shared startup configuration", async () => {
    let observedProfileId: string | undefined;
    let observedEnvironmentName: string | undefined;
    const root = createWorkerCompositionRoot({
      startHost: async () => ({
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: (context) => {
            observedProfileId = context.deploymentProfile.profileId;
            observedEnvironmentName = context.deploymentProfile.environmentName;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: WorkerHostRuntime,
      mode: "cold-start",
      startupReason: "worker-startup-config-resolution-test",
      requiredDependencyIds: ["dep:application:worker-execution-services"],
      environment: {
        [HostStartupEnvironmentKeys.deploymentProfile]: HostDeploymentProfileIds.organization,
        [HostStartupEnvironmentKeys.environmentName]: "production",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedProfileId).toBe(HostDeploymentProfileIds.organization);
    expect(observedEnvironmentName).toBe("production");
    expect(runtime.enabledCapabilities).toContain(HostCapabilityFlags.nodeExecution);
    await runtime.stop();
  });
});


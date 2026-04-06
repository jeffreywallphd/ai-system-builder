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
import { HybridHostRuntime } from "../../HostRuntimeCatalog";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  HybridEnabledCapabilitiesArtifactKey,
  HybridHostControlPlaneSources,
  HybridServiceRegistrationPlanArtifactKey,
  createHybridCompositionRoot,
} from "../HybridHostCompositionRoot";
import type { HostServiceRegistrationPlan } from "../../../infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "../../../infrastructure/config/HostServiceRegistration";

describe("HybridHostCompositionRoot", () => {
  it("composes and stops hybrid host runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createHybridCompositionRoot({
      startHost: async () => ({
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "hybrid-host-test",
      requiredDependencyIds: ["dep:application:hybrid-orchestration-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(runtime.controlPlaneSource).toBe(HybridHostControlPlaneSources.remoteAuthoritativeServer);
    expect(runtime.enabledCapabilities).toEqual([
      HostCapabilityFlags.desktopShell,
      HostCapabilityFlags.userInterfaceRendering,
      HostCapabilityFlags.ipcBridge,
      HostCapabilityFlags.localPersistence,
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ]);
    expect(runtime.transitionHistory.map((entry) => entry.to)).toEqual([
      "composing",
      "starting",
      "ready",
    ]);

    await runtime.stop();
    expect(closed).toBeTrue();
    expect(runtime.phase).toBe("stopped");
  });

  it("rejects non-hybrid hosts for hybrid composition root", async () => {
    const root = createHybridCompositionRoot({
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonHybridHost = createHostRuntimeIdentity({
      hostId: "host:desktop:app-shell",
      kind: HostRuntimeKinds.desktop,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [HostCapabilityFlags.desktopShell, HostCapabilityFlags.userInterfaceRendering],
      responsibilities: ["render desktop shell"],
      startupDependencies: HybridHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonHybridHost,
      mode: "cold-start",
      startupReason: "invalid-hybrid-host-test",
      requiredDependencyIds: ["dep:application:hybrid-orchestration-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("rejects disallowed capability combinations for hybrid composition", () => {
    expect(() => createHybridCompositionRoot({
      capabilitySelection: {
        enableNodeExecution: true,
        enableWorkerRuntime: false,
      },
      startHost: async () => ({
        close: async () => {},
      }),
    })).toThrow(HostCompositionContractError);
  });

  it("rejects local authoritative control-plane source for hybrid composition root", () => {
    expect(() => createHybridCompositionRoot({
      controlPlaneSource: HybridHostControlPlaneSources.localAuthoritativeServerDelegated,
      startHost: async () => ({
        close: async () => {},
      }),
    })).toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createHybridCompositionRoot({
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
          stageId: "host:hybrid:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:hybrid:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "hybrid-host-customization-test",
      requiredDependencyIds: ["dep:application:hybrid-orchestration-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:hybrid:post-security-bootstrap",
      "persistence",
    ]);
    await runtime.stop();
  });

  it("runs default dependency composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    let observedCapabilities: ReadonlyArray<string> | undefined;
    const root = createHybridCompositionRoot({
      startHost: async () => ({
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              HybridServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
            observedCapabilities = context.getArtifact<ReadonlyArray<string>>(HybridEnabledCapabilitiesArtifactKey);
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "hybrid-host-dependency-stage-test",
      requiredDependencyIds: ["dep:application:hybrid-orchestration-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(HybridHostRuntime.hostId);
    expect(observedCapabilities).toContain(HostCapabilityFlags.nodeExecution);
    await runtime.stop();
  });

  it("fails compose when hybrid service coverage assertions fail", async () => {
    let started = false;
    const root = createHybridCompositionRoot({
      startHost: async () => {
        started = true;
        return {
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: HybridHostRuntime.hostId,
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
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "hybrid-host-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:hybrid-orchestration-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });
});

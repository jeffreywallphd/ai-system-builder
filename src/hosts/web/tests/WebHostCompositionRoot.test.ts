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
import { WebHostRuntime } from "../../HostRuntimeCatalog";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import { createWebCompositionRoot, WebServiceRegistrationPlanArtifactKey } from "../WebHostCompositionRoot";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "@infrastructure/config/HostServiceRegistration";
import {
  HostDeploymentProfileIds,
  HostStartupEnvironmentKeys,
} from "@infrastructure/config/HostStartupConfiguration";

describe("WebHostCompositionRoot", () => {
  it("composes and stops web host runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createWebCompositionRoot({
      startHost: async () => ({
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: WebHostRuntime,
      mode: "cold-start",
      startupReason: "web-host-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(runtime.delivery.deliveryMode).toBe("thin-client");
    expect(runtime.runtimeMetadata.hostId).toBe("host:web:thin-client");
    expect(runtime.runtimeMetadata.roleInspection.supportsUserInterface).toBeTrue();
    expect(runtime.runtimeMetadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.browserRuntime)).toBeTrue();
    expect(runtime.readiness?.marker).toBe("web-host:feature-registration-complete");
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

  it("rejects non-web hosts for web composition root", async () => {
    const root = createWebCompositionRoot({
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonWebHost = createHostRuntimeIdentity({
      hostId: "host:desktop:app-shell",
      kind: HostRuntimeKinds.desktop,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [HostCapabilityFlags.desktopShell, HostCapabilityFlags.userInterfaceRendering],
      responsibilities: ["render desktop shell"],
      startupDependencies: WebHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonWebHost,
      mode: "cold-start",
      startupReason: "invalid-web-host-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createWebCompositionRoot({
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
          stageId: "host:web:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:web:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: WebHostRuntime,
      mode: "cold-start",
      startupReason: "web-host-customization-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:web:post-security-bootstrap",
      "persistence",
    ]);
    await runtime.stop();
  });

  it("runs default dependencies composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    const root = createWebCompositionRoot({
      startHost: async () => ({
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              WebServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: WebHostRuntime,
      mode: "cold-start",
      startupReason: "web-host-dependency-stage-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(WebHostRuntime.hostId);
    await runtime.stop();
  });

  it("fails compose when web service coverage assertions fail", async () => {
    let started = false;
    const root = createWebCompositionRoot({
      startHost: async () => {
        started = true;
        return {
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: WebHostRuntime.hostId,
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
      host: WebHostRuntime,
      mode: "cold-start",
      startupReason: "web-host-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });

  it("resolves deployment profile and enabled capabilities through shared startup configuration", async () => {
    let observedProfileId: string | undefined;
    let observedEnvironmentName: string | undefined;
    let observedCapabilities: ReadonlyArray<string> | undefined;
    const root = createWebCompositionRoot({
      startHost: async () => ({
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
      host: WebHostRuntime,
      mode: "cold-start",
      startupReason: "web-startup-config-resolution-test",
      requiredDependencyIds: ["dep:application:web-runtime-services"],
      environment: {
        [HostStartupEnvironmentKeys.deploymentProfile]: HostDeploymentProfileIds.classroom,
        [HostStartupEnvironmentKeys.environmentName]: "test",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedProfileId).toBe(HostDeploymentProfileIds.classroom);
    expect(observedEnvironmentName).toBe("test");
    expect(observedCapabilities).toContain(HostCapabilityFlags.browserRuntime);
    await runtime.stop();
  });
});


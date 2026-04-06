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
import { DesktopHostRuntime } from "../../HostRuntimeCatalog";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import { createDesktopCompositionRoot, DesktopServiceRegistrationPlanArtifactKey } from "../DesktopHostCompositionRoot";
import type { HostServiceRegistrationPlan } from "../../../infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "../../../infrastructure/config/HostServiceRegistration";

describe("DesktopHostCompositionRoot", () => {
  it("composes and stops desktop host runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createDesktopCompositionRoot({
      startHost: async () => ({
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "desktop-host-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(runtime.runtimeMetadata.hostId).toBe("host:desktop:app-shell");
    expect(runtime.runtimeMetadata.roleInspection.isControlPlaneClient).toBeTrue();
    expect(runtime.runtimeMetadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.desktopShell)).toBeTrue();
    expect(runtime.readiness?.marker).toBe("desktop-host:feature-registration-complete");
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

  it("rejects non-desktop hosts for desktop composition root", async () => {
    const root = createDesktopCompositionRoot({
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonDesktopHost = createHostRuntimeIdentity({
      hostId: "host:web:thin-client",
      kind: HostRuntimeKinds.web,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [HostCapabilityFlags.browserRuntime, HostCapabilityFlags.userInterfaceRendering],
      responsibilities: ["render UI"],
      startupDependencies: DesktopHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonDesktopHost,
      mode: "cold-start",
      startupReason: "invalid-desktop-host-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createDesktopCompositionRoot({
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
          stageId: "host:desktop:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:desktop:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "desktop-host-customization-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:desktop:post-security-bootstrap",
      "persistence",
    ]);
    await runtime.stop();
  });

  it("runs default dependencies composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    const root = createDesktopCompositionRoot({
      startHost: async () => ({
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              DesktopServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "desktop-host-dependency-stage-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(DesktopHostRuntime.hostId);
    await runtime.stop();
  });

  it("fails compose when desktop service coverage assertions fail", async () => {
    let started = false;
    const root = createDesktopCompositionRoot({
      startHost: async () => {
        started = true;
        return {
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: DesktopHostRuntime.hostId,
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
      host: DesktopHostRuntime,
      mode: "cold-start",
      startupReason: "desktop-host-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:desktop-runtime-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });
});

import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  HostStartupDependencyBoundaryLayers,
  createHostRuntimeIdentity,
} from "../../../domain/hosts/HostRuntimeDomain";
import {
  HostCompositionContractError,
  HostLifecycleEventTypes,
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  assertHostCanRunAsControlPlane,
  createHostRuntimeMetadata,
  createHostBootConfiguration,
  resolveHostCapabilityMatrix,
  transitionHostLifecyclePhase,
} from "../HostCompositionContracts";

const authoritativeHost = createHostRuntimeIdentity({
  hostId: "host:server:authoritative",
  kind: HostRuntimeKinds.server,
  controlPlaneRole: HostControlPlaneRoles.authoritativeServer,
  capabilities: [
    HostCapabilityFlags.controlPlaneAuthority,
    HostCapabilityFlags.httpServing,
    HostCapabilityFlags.transportTermination,
  ],
  responsibilities: [
    "compose control plane",
  ],
  startupDependencies: [{
    dependencyId: "dep:app:identity",
    description: "Identity use cases",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
  }],
});

describe("HostCompositionContracts", () => {
  it("builds host boot configuration with dependency checks", () => {
    const boot = createHostBootConfiguration({
      host: authoritativeHost,
      mode: "cold-start",
      startupReason: "unit-test",
      requiredDependencyIds: ["dep:app:identity"],
    });

    expect(boot.mode).toBe("cold-start");
    expect(boot.requiredDependencyIds).toEqual(["dep:app:identity"]);
    expect(() => assertHostCanRunAsControlPlane(boot)).not.toThrow();
  });

  it("rejects unknown required dependencies in boot configuration", () => {
    expect(() => createHostBootConfiguration({
      host: authoritativeHost,
      mode: "cold-start",
      startupReason: "unit-test",
      requiredDependencyIds: ["dep:missing"],
    })).toThrow(HostCompositionContractError);
  });

  it("validates composition-root dependency boundary against boot requirements", () => {
    const boot = createHostBootConfiguration({
      host: authoritativeHost,
      mode: "cold-start",
      startupReason: "unit-test",
      requiredDependencyIds: ["dep:app:identity"],
    });

    expect(() => assertExecutableHostBoundarySatisfiesBootConfiguration({
      compositionRootId: "root:server:authoritative",
      host: authoritativeHost,
      dependencyBoundary: authoritativeHost.startupDependencies,
    }, boot)).not.toThrow();
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() => transitionHostLifecyclePhase({
      hostId: authoritativeHost.hostId,
      from: HostLifecyclePhases.configured,
      to: HostLifecyclePhases.ready,
      reason: "invalid jump",
    })).toThrow(HostCompositionContractError);
  });

  it("projects capability matrix with explicit authority-vs-execution split", () => {
    const matrix = resolveHostCapabilityMatrix(authoritativeHost);
    expect(matrix.controlPlaneAuthority).toBeTrue();
    expect(matrix.nodeExecution).toBeFalse();
    expect(matrix.splitAuthorityFromExecution).toBeTrue();
  });

  it("defines stable lifecycle event types and runtime handle lifecycle fields", () => {
    expect(HostLifecycleEventTypes.startupCompleted).toBe("startup-completed");
    expect(HostLifecycleEventTypes.readinessMarked).toBe("readiness-marked");
    expect(HostLifecycleEventTypes.shutdownRequested).toBe("shutdown-requested");
  });

  it("builds host runtime metadata with role inspection and capability descriptors", () => {
    const metadata = createHostRuntimeMetadata({
      host: authoritativeHost,
      metadata: {
        compositionRootId: "composition-root:host:server:authoritative",
      },
    });

    expect(metadata.hostId).toBe(authoritativeHost.hostId);
    expect(metadata.roleInspection.isAuthoritativeControlPlane).toBeTrue();
    expect(metadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
    expect(metadata.metadata.compositionRootId).toBe("composition-root:host:server:authoritative");
  });
});


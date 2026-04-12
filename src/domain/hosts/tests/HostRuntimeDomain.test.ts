import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeDomainError,
  HostRuntimeKinds,
  HostStartupDependencyBoundaryLayers,
  assertHostIdentitySupportsAuthoritativeControlPlane,
  createHostRuntimeIdentity,
  hasHostCapability,
  inspectHostRuntimeRole,
  resolveHostCapabilityDescriptors,
  resolveStartupDependenciesByBoundaryLayer,
} from "../HostRuntimeDomain";

describe("HostRuntimeDomain", () => {
  it("creates an authoritative server host identity with explicit control-plane authority", () => {
    const host = createHostRuntimeIdentity({
      hostId: "host:server:authoritative",
      kind: HostRuntimeKinds.server,
      controlPlaneRole: HostControlPlaneRoles.authoritativeServer,
      capabilities: [
        HostCapabilityFlags.controlPlaneAuthority,
        HostCapabilityFlags.httpServing,
        HostCapabilityFlags.transportTermination,
      ],
      responsibilities: [
        "compose control-plane services",
        "publish authoritative APIs",
      ],
      startupDependencies: [{
        dependencyId: "dep:application:identity",
        description: "Identity application use cases",
        boundaryLayer: HostStartupDependencyBoundaryLayers.application,
      }],
    });

    expect(host.kind).toBe(HostRuntimeKinds.server);
    expect(host.controlPlaneRole).toBe(HostControlPlaneRoles.authoritativeServer);
    expect(hasHostCapability(host, HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
    expect(() => assertHostIdentitySupportsAuthoritativeControlPlane(host)).not.toThrow();
  });

  it("rejects control-plane authority capability for non-authoritative roles", () => {
    expect(() => createHostRuntimeIdentity({
      hostId: "host:desktop:main",
      kind: HostRuntimeKinds.desktop,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [
        HostCapabilityFlags.controlPlaneAuthority,
        HostCapabilityFlags.desktopShell,
      ],
      responsibilities: [
        "render desktop shell",
      ],
    })).toThrow(HostRuntimeDomainError);
  });

  it("keeps authoritative control-plane role separate from node execution capability", () => {
    const worker = createHostRuntimeIdentity({
      hostId: "host:worker:job-runner",
      kind: HostRuntimeKinds.worker,
      controlPlaneRole: HostControlPlaneRoles.none,
      capabilities: [
        HostCapabilityFlags.workerRuntime,
        HostCapabilityFlags.nodeExecution,
      ],
      responsibilities: [
        "execute background workloads",
      ],
    });

    expect(hasHostCapability(worker, HostCapabilityFlags.nodeExecution)).toBeTrue();
    expect(worker.controlPlaneRole).toBe(HostControlPlaneRoles.none);
    expect(() => assertHostIdentitySupportsAuthoritativeControlPlane(worker)).toThrow(
      HostRuntimeDomainError,
    );
  });

  it("groups startup dependencies by boundary layer", () => {
    const host = createHostRuntimeIdentity({
      hostId: "host:hybrid:desktop-worker",
      kind: HostRuntimeKinds.hybrid,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [
        HostCapabilityFlags.desktopShell,
        HostCapabilityFlags.workerRuntime,
        HostCapabilityFlags.nodeExecution,
      ],
      responsibilities: [
        "compose desktop renderer",
        "dispatch local worker tasks",
      ],
      startupDependencies: [{
        dependencyId: "dep:shared:host-contracts",
        description: "Shared host contracts",
        boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
      }, {
        dependencyId: "dep:infra:ipc",
        description: "IPC bridge adapter",
        boundaryLayer: HostStartupDependencyBoundaryLayers.infrastructure,
      }],
    });

    const grouped = resolveStartupDependenciesByBoundaryLayer(host);
    expect(grouped[HostStartupDependencyBoundaryLayers.sharedContracts]).toHaveLength(1);
    expect(grouped[HostStartupDependencyBoundaryLayers.infrastructure]).toHaveLength(1);
    expect(grouped[HostStartupDependencyBoundaryLayers.host]).toHaveLength(0);
  });

  it("resolves capability descriptors and role inspection without brittle string checks", () => {
    const host = createHostRuntimeIdentity({
      hostId: "host:desktop:app-shell",
      kind: HostRuntimeKinds.desktop,
      controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
      capabilities: [
        HostCapabilityFlags.desktopShell,
        HostCapabilityFlags.userInterfaceRendering,
        HostCapabilityFlags.localPersistence,
      ],
      responsibilities: [
        "compose desktop runtime",
      ],
    });

    const descriptors = resolveHostCapabilityDescriptors(host.capabilities);
    expect(descriptors.map((descriptor) => descriptor.capability)).toEqual([
      HostCapabilityFlags.desktopShell,
      HostCapabilityFlags.userInterfaceRendering,
      HostCapabilityFlags.localPersistence,
    ]);

    const inspection = inspectHostRuntimeRole(host);
    expect(inspection.isAuthoritativeControlPlane).toBeFalse();
    expect(inspection.isControlPlaneClient).toBeTrue();
    expect(inspection.supportsUserInterface).toBeTrue();
    expect(inspection.supportsNodeExecution).toBeFalse();
  });
});


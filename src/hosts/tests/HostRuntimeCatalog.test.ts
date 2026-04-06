import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
} from "../../domain/hosts/HostRuntimeDomain";
import {
  AuthoritativeServerHostRuntime,
  HostRuntimeCatalog,
  resolveHostRuntimeFromCatalog,
} from "../HostRuntimeCatalog";

describe("HostRuntimeCatalog", () => {
  it("defines runtime entries for server, desktop, hybrid, web, and worker", () => {
    expect(Object.keys(HostRuntimeCatalog).sort()).toEqual([
      HostRuntimeKinds.desktop,
      HostRuntimeKinds.hybrid,
      HostRuntimeKinds.server,
      HostRuntimeKinds.web,
      HostRuntimeKinds.worker,
    ]);
  });

  it("keeps authoritative server role explicit and separate from node execution", () => {
    const server = resolveHostRuntimeFromCatalog(HostRuntimeKinds.server);
    const worker = resolveHostRuntimeFromCatalog(HostRuntimeKinds.worker);
    expect(server.controlPlaneRole).toBe(HostControlPlaneRoles.authoritativeServer);
    expect(server.capabilities.includes(HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
    expect(server.capabilities.includes(HostCapabilityFlags.nodeExecution)).toBeFalse();
    expect(worker.capabilities.includes(HostCapabilityFlags.nodeExecution)).toBeTrue();
    expect(worker.controlPlaneRole).toBe(HostControlPlaneRoles.none);
  });

  it("publishes explicit responsibilities and startup dependencies for each host", () => {
    for (const host of Object.values(HostRuntimeCatalog)) {
      expect(host.responsibilities.length).toBeGreaterThan(0);
      expect(host.startupDependencies.length).toBeGreaterThan(0);
    }
    expect(AuthoritativeServerHostRuntime.responsibilities.join(" ")).toContain("authoritative");
  });
});


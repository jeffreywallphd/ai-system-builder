import { describe, expect, it } from "bun:test";
import { HostCapabilityFlags, HostRuntimeKinds } from "../../domain/hosts/HostRuntimeDomain";
import {
  advertiseHostRuntimeMetadata,
  listHostRuntimeMetadataCatalog,
  resolveHostRuntimeMetadataFromCatalog,
} from "../HostRuntimeMetadataCatalog";
import { HybridHostRuntime } from "../HostRuntimeCatalog";

describe("HostRuntimeMetadataCatalog", () => {
  it("resolves metadata from catalog with role inspection and capability descriptors", () => {
    const metadata = resolveHostRuntimeMetadataFromCatalog(HostRuntimeKinds.server);

    expect(metadata.hostId).toBe("host:server:authoritative");
    expect(metadata.roleInspection.isAuthoritativeControlPlane).toBeTrue();
    expect(metadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
  });

  it("supports metadata advertisement with runtime capability narrowing", () => {
    const metadata = advertiseHostRuntimeMetadata({
      host: HybridHostRuntime,
      advertisedCapabilities: [
        HostCapabilityFlags.desktopShell,
        HostCapabilityFlags.userInterfaceRendering,
        HostCapabilityFlags.nodeExecution,
      ],
      metadata: {
        controlPlaneSource: "remote-authoritative-server",
      },
    });

    expect(metadata.advertisedCapabilities).toHaveLength(3);
    expect(metadata.roleInspection.supportsNodeExecution).toBeTrue();
    expect(metadata.metadata.controlPlaneSource).toBe("remote-authoritative-server");
  });

  it("lists metadata for all canonical host runtime entries", () => {
    const catalog = listHostRuntimeMetadataCatalog();
    expect(catalog).toHaveLength(5);
    expect(catalog.map((entry) => entry.hostId).sort()).toEqual([
      "host:desktop:app-shell",
      "host:hybrid:desktop-worker",
      "host:server:authoritative",
      "host:web:thin-client",
      "host:worker:runtime",
    ]);
  });
});

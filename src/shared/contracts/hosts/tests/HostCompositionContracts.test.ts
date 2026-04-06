import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  HostStartupDependencyBoundaryLayers,
  createHostRuntimeIdentity,
} from "../../../../domain/hosts/HostRuntimeDomain";
import { createHostBootConfiguration } from "../../../../application/common/HostCompositionContracts";
import {
  HostCompositionContractScopes,
  HostCompositionContractVersions,
  toHostBootConfigurationDto,
  toHostRuntimeIdentityDto,
} from "../HostCompositionContracts";

describe("HostCompositionContracts", () => {
  it("defines stable host composition contract scope and version", () => {
    expect(HostCompositionContractScopes.hostInternal).toBe("host-internal");
    expect(HostCompositionContractScopes.runtimeTransport).toBe("runtime-transport");
    expect(HostCompositionContractVersions.v1).toBe("host-composition/v1");
  });

  it("projects host runtime identity and boot configuration to shared DTOs", () => {
    const host = createHostRuntimeIdentity({
      hostId: "host:server:authoritative",
      kind: HostRuntimeKinds.server,
      controlPlaneRole: HostControlPlaneRoles.authoritativeServer,
      capabilities: [
        HostCapabilityFlags.controlPlaneAuthority,
        HostCapabilityFlags.httpServing,
      ],
      responsibilities: [
        "compose control plane services",
      ],
      startupDependencies: [{
        dependencyId: "dep:shared:contracts",
        description: "Shared host contracts",
        boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
      }],
    });
    const boot = createHostBootConfiguration({
      host,
      mode: "cold-start",
      startupReason: "shared-contract-test",
      requiredDependencyIds: ["dep:shared:contracts"],
    });

    const hostDto = toHostRuntimeIdentityDto(host);
    const bootDto = toHostBootConfigurationDto(boot);
    expect(hostDto.contractVersion).toBe("host-composition/v1");
    expect(hostDto.controlPlaneRole).toBe("authoritative-server");
    expect(bootDto.mode).toBe("cold-start");
    expect(bootDto.requiredDependencyIds).toEqual(["dep:shared:contracts"]);
  });
});


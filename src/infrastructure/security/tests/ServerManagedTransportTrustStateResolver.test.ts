import { describe, expect, it } from "bun:test";
import {
  CertificateTrustEvaluationStatuses,
} from "../../../shared/dto/security/CertificateAuthorityDtos";
import { AuthenticatedTrustStates } from "../../../domain/security/TransportSecurityDomain";
import { DeviceTrustStatuses } from "../../../domain/identity/TrustedDeviceDomain";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  type NodeType,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeIdentityPersistenceRecord,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { ICertificateRevocationStatusRegistry } from "../../../application/security/ports/ICertificateRevocationStatusRegistry";
import { ServerManagedTransportTrustStateResolver } from "../ServerManagedTransportTrustStateResolver";

describe("ServerManagedTransportTrustStateResolver", () => {
  it("resolves trusted device state from trusted-device service", async () => {
    const resolver = new ServerManagedTransportTrustStateResolver({
      trustedDeviceManagementService: {
        async getTrustedDeviceById() {
          return Object.freeze({
            id: "device:trusted",
            userIdentityId: "user:1",
            workspaceId: undefined,
            displayName: Object.freeze({ value: "Device 1" }),
            fingerprint: Object.freeze({
              algorithm: "sha256",
              value: "abc",
              capturedAt: "2026-04-05T10:00:00.000Z",
            }),
            pairingMethod: "one-time-code",
            trustStatus: DeviceTrustStatuses.trusted,
            trustMaterialRef: Object.freeze({
              materialId: "material:device:trusted",
              kind: "session-signing-key",
              issuedAt: "2026-04-05T10:00:00.000Z",
            }),
            registeredAt: "2026-04-05T10:00:00.000Z",
            pairedAt: "2026-04-05T10:01:00.000Z",
            lastSeenAt: "2026-04-05T10:05:00.000Z",
            metadata: Object.freeze({}),
            updatedAt: "2026-04-05T10:05:00.000Z",
          });
        },
      },
    });

    const resolved = await resolver.resolveTrustedDeviceState({
      trustedDeviceId: "device:trusted",
      userIdentityId: "user:1",
    });

    expect(resolved.trustState).toBe(AuthenticatedTrustStates.trusted);
    expect(resolved.resolution).toBe("resolved");
  });

  it("maps revoked node lifecycle state to revoked transport trust", async () => {
    const resolver = new ServerManagedTransportTrustStateResolver({
      nodeTrustIdentityRepository: {
        async findNodeById() {
          return createNodeRecord({
            trustState: NodeTrustStates.revoked,
            revocationState: NodeRevocationStates.revoked,
          });
        },
      },
    });

    const resolved = await resolver.resolveNodeState({
      nodeId: "node:revoked",
    });

    expect(resolved.trustState).toBe(AuthenticatedTrustStates.revoked);
    expect(resolved.resolution).toBe("resolved");
  });

  it("resolves active certificate status as trusted and revoked as revoked", async () => {
    const registry: ICertificateRevocationStatusRegistry = {
      async resolveCertificateRevocationStatus(input) {
        return Object.freeze({
          serialNumber: input.serialNumber,
          certificateAuthorityId: "ca:internal",
          status: input.serialNumber === "AA11" ? CertificateTrustEvaluationStatuses.active : CertificateTrustEvaluationStatuses.revoked,
          certificateStatus: input.serialNumber === "AA11" ? "issued" : "revoked",
          revoked: input.serialNumber !== "AA11",
          active: input.serialNumber === "AA11",
          expired: false,
          usable: input.serialNumber === "AA11",
          checkedAt: "2026-04-05T12:00:00.000Z",
        });
      },
    };
    const resolver = new ServerManagedTransportTrustStateResolver({
      certificateRevocationStatusRegistry: registry,
    });

    const active = await resolver.resolvePeerCertificateState({
      certificatePresented: true,
      serialNumber: "AA11",
    });
    const revoked = await resolver.resolvePeerCertificateState({
      certificatePresented: true,
      serialNumber: "BB22",
    });

    expect(active.trustState).toBe(AuthenticatedTrustStates.trusted);
    expect(revoked.trustState).toBe(AuthenticatedTrustStates.revoked);
  });
});

function createNodeRecord(input: {
  readonly trustState: string;
  readonly revocationState: string;
}): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId: "node:1",
    nodeType: "hybrid" as NodeType,
    displayName: "Node 1",
    capabilityProfile: Object.freeze({
      enabledCapabilities: Object.freeze(["api"]),
      supportsRemoteScheduling: true,
    }),
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: input.trustState as NodeIdentityPersistenceRecord["trustState"],
    certificate: Object.freeze({
      certificateRef: "cert:node:1",
      certificateAssignedAt: "2026-04-05T10:00:00.000Z",
      certificateAuthorityRef: "ca:internal",
    }),
    deploymentTags: Object.freeze(["prod"]),
    revocation: Object.freeze({
      state: input.revocationState as NodeIdentityPersistenceRecord["revocation"]["state"],
    }),
    enrolledAt: "2026-04-05T09:00:00.000Z",
    createdAt: "2026-04-05T09:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-05T10:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

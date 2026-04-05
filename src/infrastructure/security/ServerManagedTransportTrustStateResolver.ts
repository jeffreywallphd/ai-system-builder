import type { ITrustedDeviceManagementService } from "../../../application/identity/ports/ITrustedDeviceManagementService";
import { DeviceTrustStatuses } from "../../domain/identity/TrustedDeviceDomain";
import { NodeApprovalStatuses, NodeRevocationStates, NodeTrustStates } from "../../domain/nodes/NodeTrustDomain";
import {
  AuthenticatedTrustStates,
  type AuthenticatedTrustState,
} from "../../domain/security/TransportSecurityDomain";
import type { INodeTrustIdentityPersistenceRepository } from "../../application/nodes/ports/INodeTrustIdentityPersistenceRepository";
import type { ICertificateRevocationStatusRegistry } from "../../application/security/ports/ICertificateRevocationStatusRegistry";
import type { IIssuedCertificatePersistenceRepository } from "../../application/security/ports/IIssuedCertificatePersistenceRepository";
import type {
  ITransportNodeStateResolverPort,
  ITransportPeerCertificateStateResolverPort,
  ITransportTrustedDeviceStateResolverPort,
  ResolveTransportNodeStateInput,
  ResolveTransportNodeStateResult,
  ResolveTransportPeerCertificateStateInput,
  ResolveTransportPeerCertificateStateResult,
  ResolveTransportTrustedDeviceStateInput,
  ResolveTransportTrustedDeviceStateResult,
} from "../../application/security/ports/TransportTrustValidationPorts";

interface ServerManagedTransportTrustStateResolverDependencies {
  readonly trustedDeviceManagementService?: Pick<ITrustedDeviceManagementService, "getTrustedDeviceById">;
  readonly nodeTrustIdentityRepository?: Pick<INodeTrustIdentityPersistenceRepository, "findNodeById">;
  readonly certificateRevocationStatusRegistry?: ICertificateRevocationStatusRegistry;
  readonly issuedCertificateRepository?: Pick<IIssuedCertificatePersistenceRepository, "findIssuedCertificateBySerialNumber">;
}

export class ServerManagedTransportTrustStateResolver
  implements
    ITransportTrustedDeviceStateResolverPort,
    ITransportNodeStateResolverPort,
    ITransportPeerCertificateStateResolverPort {
  public constructor(private readonly dependencies: ServerManagedTransportTrustStateResolverDependencies) {}

  public async resolveTrustedDeviceState(
    input: ResolveTransportTrustedDeviceStateInput,
  ): Promise<ResolveTransportTrustedDeviceStateResult> {
    const trustedDeviceId = normalizeRequired(input.trustedDeviceId);
    if (!this.dependencies.trustedDeviceManagementService) {
      return this.notResolvedDevice(trustedDeviceId, "trusted-device-service-not-configured", input.asOf);
    }

    try {
      const trustedDevice = await this.dependencies.trustedDeviceManagementService.getTrustedDeviceById(trustedDeviceId);
      if (!trustedDevice) {
        return Object.freeze({
          trustedDeviceId,
          trustState: AuthenticatedTrustStates.unknown,
          resolution: "not-found",
          reasonCode: "trusted-device-not-found",
          checkedAt: resolveCheckedAt(input.asOf),
        });
      }
      if (input.userIdentityId && normalizeOptional(input.userIdentityId) !== trustedDevice.userIdentityId) {
        return Object.freeze({
          trustedDeviceId,
          trustState: AuthenticatedTrustStates.revoked,
          resolution: "resolved",
          reasonCode: "trusted-device-user-mismatch",
          checkedAt: resolveCheckedAt(input.asOf),
        });
      }

      return Object.freeze({
        trustedDeviceId,
        trustState: mapDeviceTrustStatusToAuthenticatedTrustState(trustedDevice.trustStatus),
        resolution: "resolved",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    } catch {
      return this.notResolvedDevice(trustedDeviceId, "trusted-device-resolution-failed", input.asOf);
    }
  }

  public async resolveNodeState(
    input: ResolveTransportNodeStateInput,
  ): Promise<ResolveTransportNodeStateResult> {
    const nodeId = normalizeRequired(input.nodeId);
    if (!this.dependencies.nodeTrustIdentityRepository) {
      return this.notResolvedNode(nodeId, "node-state-repository-not-configured", input.asOf);
    }

    try {
      const node = await this.dependencies.nodeTrustIdentityRepository.findNodeById(nodeId);
      if (!node) {
        return Object.freeze({
          nodeId,
          trustState: AuthenticatedTrustStates.unknown,
          resolution: "not-found",
          reasonCode: "node-not-found",
          checkedAt: resolveCheckedAt(input.asOf),
        });
      }

      const trustState = mapNodeStateToAuthenticatedTrustState({
        approvalStatus: node.approvalStatus,
        trustState: node.trustState,
        revocationState: node.revocation.state,
        hasCertificate: Boolean(node.certificate?.certificateRef),
      });

      return Object.freeze({
        nodeId,
        trustState,
        certificateRef: node.certificate?.certificateRef,
        resolution: "resolved",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    } catch {
      return this.notResolvedNode(nodeId, "node-state-resolution-failed", input.asOf);
    }
  }

  public async resolvePeerCertificateState(
    input: ResolveTransportPeerCertificateStateInput,
  ): Promise<ResolveTransportPeerCertificateStateResult> {
    const serialNumber = normalizeOptional(input.serialNumber)?.toUpperCase();
    if (!input.certificatePresented) {
      return Object.freeze({
        certificatePresented: false,
        serialNumber,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "not-presented",
        reasonCode: "peer-certificate-not-presented",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    }
    if (!serialNumber) {
      return Object.freeze({
        certificatePresented: true,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "not-found",
        reasonCode: "peer-certificate-serial-missing",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    }

    if (!this.dependencies.certificateRevocationStatusRegistry && !this.dependencies.issuedCertificateRepository) {
      return Object.freeze({
        certificatePresented: true,
        serialNumber,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error",
        reasonCode: "peer-certificate-resolver-not-configured",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    }

    try {
      if (this.dependencies.certificateRevocationStatusRegistry) {
        const status = await this.dependencies.certificateRevocationStatusRegistry.resolveCertificateRevocationStatus({
          serialNumber,
          asOf: input.asOf,
        });

        return Object.freeze({
          certificatePresented: true,
          serialNumber,
          trustState: mapCertificateRegistryStatusToAuthenticatedTrustState(status.status),
          resolution: status.status === "not-found" ? "not-found" : "resolved",
          reasonCode: status.status === "not-found" ? "certificate-not-found" : undefined,
          checkedAt: status.checkedAt,
        });
      }

      const certificate = await this.dependencies.issuedCertificateRepository?.findIssuedCertificateBySerialNumber(serialNumber);
      if (!certificate) {
        return Object.freeze({
          certificatePresented: true,
          serialNumber,
          trustState: AuthenticatedTrustStates.unknown,
          resolution: "not-found",
          reasonCode: "certificate-not-found",
          checkedAt: resolveCheckedAt(input.asOf),
        });
      }

      return Object.freeze({
        certificatePresented: true,
        serialNumber,
        trustState: certificate.status === "issued" ? AuthenticatedTrustStates.trusted : AuthenticatedTrustStates.revoked,
        resolution: "resolved",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    } catch {
      return Object.freeze({
        certificatePresented: true,
        serialNumber,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error",
        reasonCode: "peer-certificate-resolution-failed",
        checkedAt: resolveCheckedAt(input.asOf),
      });
    }
  }

  private notResolvedDevice(
    trustedDeviceId: string,
    reasonCode: string,
    asOf: string | undefined,
  ): ResolveTransportTrustedDeviceStateResult {
    return Object.freeze({
      trustedDeviceId,
      trustState: AuthenticatedTrustStates.unknown,
      resolution: "error",
      reasonCode,
      checkedAt: resolveCheckedAt(asOf),
    });
  }

  private notResolvedNode(
    nodeId: string,
    reasonCode: string,
    asOf: string | undefined,
  ): ResolveTransportNodeStateResult {
    return Object.freeze({
      nodeId,
      trustState: AuthenticatedTrustStates.unknown,
      resolution: "error",
      reasonCode,
      checkedAt: resolveCheckedAt(asOf),
    });
  }
}

function mapDeviceTrustStatusToAuthenticatedTrustState(trustStatus: string): AuthenticatedTrustState {
  if (trustStatus === DeviceTrustStatuses.trusted) {
    return AuthenticatedTrustStates.trusted;
  }
  if (trustStatus === DeviceTrustStatuses.pendingPairing) {
    return AuthenticatedTrustStates.pending;
  }
  if (trustStatus === DeviceTrustStatuses.revoked || trustStatus === DeviceTrustStatuses.expired) {
    return AuthenticatedTrustStates.revoked;
  }
  return AuthenticatedTrustStates.unknown;
}

function mapNodeStateToAuthenticatedTrustState(input: {
  readonly approvalStatus: string;
  readonly trustState: string;
  readonly revocationState: string;
  readonly hasCertificate: boolean;
}): AuthenticatedTrustState {
  if (
    input.revocationState === NodeRevocationStates.revoked
    || input.trustState === NodeTrustStates.revoked
    || input.trustState === NodeTrustStates.quarantined
  ) {
    return AuthenticatedTrustStates.revoked;
  }
  if (
    input.trustState === NodeTrustStates.trusted
    && input.approvalStatus === NodeApprovalStatuses.approved
    && input.hasCertificate
  ) {
    return AuthenticatedTrustStates.trusted;
  }
  if (
    input.trustState === NodeTrustStates.pendingEnrollment
    || input.trustState === NodeTrustStates.pendingApproval
  ) {
    return AuthenticatedTrustStates.pending;
  }
  return AuthenticatedTrustStates.unknown;
}

function mapCertificateRegistryStatusToAuthenticatedTrustState(status: string): AuthenticatedTrustState {
  if (status === "active") {
    return AuthenticatedTrustStates.trusted;
  }
  if (status === "not-found") {
    return AuthenticatedTrustStates.unknown;
  }
  if (status === "not-yet-valid") {
    return AuthenticatedTrustStates.pending;
  }
  return AuthenticatedTrustStates.revoked;
}

function resolveCheckedAt(asOf: string | undefined): string {
  const normalized = normalizeOptional(asOf);
  return normalized ?? new Date().toISOString();
}

function normalizeRequired(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Value is required.");
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}


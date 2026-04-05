import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeTrustStates,
} from "../../domain/nodes/NodeTrustDomain";
import { AuthenticatedTrustStates } from "../../domain/security/TransportSecurityDomain";
import type {
  ResolveNodePeerCertificateIdentityRequest,
  ResolveNodePeerCertificateIdentityResult,
  INodePeerCertificateIdentityResolverPort,
} from "../../application/security/ports/NodePeerCommunicationPolicyPorts";
import type { INodeTrustIdentityPersistenceRepository } from "../../application/nodes/ports/INodeTrustIdentityPersistenceRepository";

type NodeLookupPort = Pick<INodeTrustIdentityPersistenceRepository, "findNodeById">;

export class NodePeerCertificateIdentityResolver implements INodePeerCertificateIdentityResolverPort {
  public constructor(private readonly nodeRepository: NodeLookupPort) {}

  public async resolveNodePeerCertificateIdentity(
    request: ResolveNodePeerCertificateIdentityRequest,
  ): Promise<ResolveNodePeerCertificateIdentityResult> {
    const nodeId = normalizeRequired(request.nodeId, "nodeId");
    const checkedAt = normalizeOptional(request.asOf) ?? new Date().toISOString();
    const certificateSerialNumber = normalizeCertificateSerialNumber(request.certificateSerialNumber);
    const certificateFingerprintSha256 = normalizeFingerprint(request.certificateFingerprintSha256);

    const node = await this.nodeRepository.findNodeById(nodeId);
    if (!node) {
      return Object.freeze({
        nodeId,
        approved: false,
        trusted: false,
        revoked: false,
        certificateBound: false,
        nodeTrustState: AuthenticatedTrustStates.unknown,
        resolution: "not-found",
        reasonCode: "node-not-found",
        checkedAt,
      });
    }

    const configuredCertificateRef = normalizeCertificateSerialNumber(node.certificate?.certificateRef);
    const configuredCertificateThumbprint = normalizeFingerprint(node.certificate?.certificateThumbprint);
    const certificateBound = resolveCertificateBindingMatch({
      certificateSerialNumber,
      certificateFingerprintSha256,
      configuredCertificateRef,
      configuredCertificateThumbprint,
    });

    const approved = node.approvalStatus === NodeApprovalStatuses.approved;
    const trusted = node.trustState === NodeTrustStates.trusted;
    const revoked = node.revocation.state === NodeRevocationStates.revoked
      || node.trustState === NodeTrustStates.revoked
      || Boolean(node.revokedAt)
      || Boolean(node.revocation.revokedAt);

    return Object.freeze({
      nodeId,
      approved,
      trusted,
      revoked,
      certificateBound,
      nodeTrustState: trusted
        ? AuthenticatedTrustStates.trusted
        : revoked
          ? AuthenticatedTrustStates.revoked
          : AuthenticatedTrustStates.pending,
      resolution: certificateBound ? "resolved" : "mismatch",
      reasonCode: certificateBound ? undefined : "peer-certificate-identity-mismatch",
      checkedAt,
    });
  }
}

function resolveCertificateBindingMatch(input: {
  readonly certificateSerialNumber?: string;
  readonly certificateFingerprintSha256?: string;
  readonly configuredCertificateRef?: string;
  readonly configuredCertificateThumbprint?: string;
}): boolean {
  if (!input.certificateSerialNumber && !input.certificateFingerprintSha256) {
    return false;
  }
  if (!input.configuredCertificateRef && !input.configuredCertificateThumbprint) {
    return false;
  }
  if (
    input.certificateSerialNumber
    && input.configuredCertificateRef
    && input.certificateSerialNumber !== input.configuredCertificateRef
  ) {
    return false;
  }
  if (
    input.certificateFingerprintSha256
    && input.configuredCertificateThumbprint
    && input.certificateFingerprintSha256 !== input.configuredCertificateThumbprint
  ) {
    return false;
  }
  if (input.configuredCertificateThumbprint && !input.certificateFingerprintSha256) {
    return false;
  }
  if (!input.configuredCertificateThumbprint && !input.certificateSerialNumber) {
    return false;
  }
  return true;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Node peer certificate identity ${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeCertificateSerialNumber(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizeFingerprint(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.replace(/[^a-fA-F0-9]/g, "").toUpperCase() : undefined;
}

import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import {
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseOutcome,
  enforceNodeAuthenticatedOperationTrust,
  normalizeOptional,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface ResolveNodeMutualTlsTransportIdentityUseCaseDependencies {
  readonly nodeRepository: Pick<INodeTrustIdentityPersistenceRepository, "findNodeById">;
}

export interface ResolveNodeMutualTlsTransportIdentityRequest {
  readonly nodeId: string;
  readonly certificateSerialNumber?: string;
  readonly certificateFingerprintSha256?: string;
}

export interface ResolveNodeMutualTlsTransportIdentityResult {
  readonly nodeId: string;
  readonly certificateRef: string;
  readonly certificateThumbprint?: string;
}

export class ResolveNodeMutualTlsTransportIdentityUseCase {
  public constructor(private readonly dependencies: ResolveNodeMutualTlsTransportIdentityUseCaseDependencies) {}

  public async execute(
    request: ResolveNodeMutualTlsTransportIdentityRequest,
  ): Promise<NodeTrustUseCaseOutcome<ResolveNodeMutualTlsTransportIdentityResult>> {
    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "nodeId is required.");
    }

    const certificateSerialNumber = normalizeCertificateSerialNumber(request.certificateSerialNumber);
    const certificateFingerprintSha256 = normalizeFingerprint(request.certificateFingerprintSha256);
    if (!certificateSerialNumber && !certificateFingerprintSha256) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidRequest,
        "Client certificate serialNumber or fingerprint is required for node mutual TLS authentication.",
      );
    }

    const node = await this.dependencies.nodeRepository.findNodeById(nodeId);
    if (!node) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }

    const transportTrustFailure = enforceNodeAuthenticatedOperationTrust<ResolveNodeMutualTlsTransportIdentityResult>(
      node,
      "establish mutually authenticated transport",
    );
    if (transportTrustFailure) {
      return transportTrustFailure;
    }

    const configuredCertificateRef = normalizeOptional(node.certificate?.certificateRef);
    const configuredCertificateThumbprint = normalizeFingerprint(node.certificate?.certificateThumbprint);
    if (!configuredCertificateRef) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        `Node '${nodeId}' is missing certificate identity binding metadata.`,
      );
    }

    if (configuredCertificateThumbprint) {
      if (!certificateFingerprintSha256) {
        return toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.forbidden,
          `Node '${nodeId}' certificate fingerprint is missing from transport evidence.`,
        );
      }
      if (configuredCertificateThumbprint !== certificateFingerprintSha256) {
        return toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.forbidden,
          `Node '${nodeId}' certificate fingerprint did not match trusted node records.`,
        );
      }
    }

    if (certificateSerialNumber) {
      if (normalizeCertificateSerialNumber(configuredCertificateRef) !== certificateSerialNumber) {
        return toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.forbidden,
          `Node '${nodeId}' certificate serial did not match trusted node records.`,
        );
      }
    } else if (!configuredCertificateThumbprint) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        `Node '${nodeId}' certificate serial is required when no certificate fingerprint is registered.`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        nodeId,
        certificateRef: configuredCertificateRef,
        certificateThumbprint: configuredCertificateThumbprint,
      }),
    };
  }
}

function normalizeCertificateSerialNumber(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  return normalized.toUpperCase();
}

function normalizeFingerprint(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  return normalized.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

import {
  TransportConnectionActorTypes,
  TransportPeerTypes,
  TransportSecurityScenarios,
  type TransportChannelType,
} from "../../../domain/security/TransportSecurityDomain";
import type {
  NodePeerCapability,
  NodePeerOperationClass,
  INodePeerCertificateIdentityResolverPort,
  INodePeerCommunicationPolicyResolverPort,
} from "../ports/NodePeerCommunicationPolicyPorts";
import type { ValidateTransportConnectionTrustUseCase } from "./ValidateTransportConnectionTrustUseCase";

export const AuthorizeNodePeerCommunicationErrorCodes = Object.freeze({
  invalidRequest: "authorize-node-peer-communication-invalid-request",
  internal: "authorize-node-peer-communication-internal",
});

export type AuthorizeNodePeerCommunicationErrorCode =
  typeof AuthorizeNodePeerCommunicationErrorCodes[keyof typeof AuthorizeNodePeerCommunicationErrorCodes];

export const NodePeerCommunicationRejectionReasons = Object.freeze({
  peerChannelsDisabledByPolicy: "peer-channels-disabled-by-policy",
  operationClassNotAllowed: "operation-class-not-allowed",
  remotePeerNotAllowed: "remote-peer-not-allowed",
  peerCertificateIdentityRequired: "peer-certificate-identity-required",
  transportTrustRejected: "transport-trust-rejected",
  peerCertificateIdentityMismatch: "peer-certificate-identity-mismatch",
  peerApprovalRequired: "peer-approval-required",
  peerTrustRequired: "peer-trust-required",
  peerRevoked: "peer-revoked",
});

export type NodePeerCommunicationRejectionReason =
  typeof NodePeerCommunicationRejectionReasons[keyof typeof NodePeerCommunicationRejectionReasons];

export interface AuthorizeNodePeerCommunicationRequest {
  readonly connectionId: string;
  readonly direction: "inbound" | "outbound";
  readonly localNodeId: string;
  readonly remoteNodeId: string;
  readonly operationClass: NodePeerOperationClass;
  readonly channelType: TransportChannelType;
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly lanTrustAssumed: boolean;
  readonly certificateSerialNumber?: string;
  readonly certificateFingerprintSha256?: string;
  readonly evaluatedAt?: string;
}

export interface AuthorizeNodePeerCommunicationResult {
  readonly accepted: boolean;
  readonly connectionId: string;
  readonly localNodeId: string;
  readonly remoteNodeId: string;
  readonly operationClass: NodePeerOperationClass;
  readonly exposedCapabilities: ReadonlyArray<NodePeerCapability>;
  readonly rejectionReasons: ReadonlyArray<NodePeerCommunicationRejectionReason>;
  readonly evaluatedAt: string;
  readonly policy: {
    readonly policyId: string;
    readonly source: "baseline" | "configured";
    readonly peerChannelsEnabled: boolean;
  };
  readonly transport?: {
    readonly policyId: string;
    readonly rejectionReasons: ReadonlyArray<string>;
  };
}

export type AuthorizeNodePeerCommunicationOutcome =
  | {
    readonly ok: true;
    readonly value: AuthorizeNodePeerCommunicationResult;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: AuthorizeNodePeerCommunicationErrorCode;
      readonly message: string;
    };
  };

interface AuthorizeNodePeerCommunicationUseCaseDependencies {
  readonly nodePeerPolicyResolverPort: INodePeerCommunicationPolicyResolverPort;
  readonly nodePeerCertificateIdentityResolverPort: INodePeerCertificateIdentityResolverPort;
  readonly validateTransportConnectionTrustUseCase: Pick<ValidateTransportConnectionTrustUseCase, "execute">;
}

export class AuthorizeNodePeerCommunicationUseCase {
  public constructor(private readonly dependencies: AuthorizeNodePeerCommunicationUseCaseDependencies) {}

  public async execute(
    request: AuthorizeNodePeerCommunicationRequest,
  ): Promise<AuthorizeNodePeerCommunicationOutcome> {
    const normalized = normalizeRequest(request);
    if (!normalized) {
      return failure("invalidRequest", "Node peer communication request is invalid.");
    }

    let policy;
    try {
      policy = await this.dependencies.nodePeerPolicyResolverPort.resolveNodePeerCommunicationPolicy({
        localNodeId: normalized.localNodeId,
        remoteNodeId: normalized.remoteNodeId,
        direction: normalized.direction,
        operationClass: normalized.operationClass,
        asOf: normalized.evaluatedAt,
      });
    } catch {
      return failure("internal", "Node peer communication policy resolution failed.");
    }

    const rejectionReasons: NodePeerCommunicationRejectionReason[] = [];
    if (!policy.peerChannelsEnabled) {
      rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerChannelsDisabledByPolicy);
    }
    if (!policy.allowedOperationClasses.includes(normalized.operationClass)) {
      rejectionReasons.push(NodePeerCommunicationRejectionReasons.operationClassNotAllowed);
    }
    if (
      policy.allowedPeerNodeIds
      && policy.allowedPeerNodeIds.length > 0
      && !policy.allowedPeerNodeIds.includes(normalized.remoteNodeId)
    ) {
      rejectionReasons.push(NodePeerCommunicationRejectionReasons.remotePeerNotAllowed);
    }

    if (!normalized.certificateSerialNumber && !normalized.certificateFingerprintSha256) {
      rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerCertificateIdentityRequired);
    }

    let transport: AuthorizeNodePeerCommunicationResult["transport"];
    if (rejectionReasons.length === 0) {
      const transportOutcome = await this.dependencies.validateTransportConnectionTrustUseCase.execute({
        connectionId: normalized.connectionId,
        direction: normalized.direction,
        scenario: TransportSecurityScenarios.nodeToNode,
        channelType: normalized.channelType,
        actorType: TransportConnectionActorTypes.nodeIdentity,
        localPeerType: TransportPeerTypes.nodeRuntime,
        remotePeerType: TransportPeerTypes.nodeRuntime,
        encryptedTransportEstablished: normalized.encryptedTransportEstablished,
        mutualTlsEstablished: normalized.mutualTlsEstablished,
        lanTrustAssumed: normalized.lanTrustAssumed,
        nodeEvidence: Object.freeze({
          nodeId: normalized.remoteNodeId,
        }),
        peerCertificateEvidence: Object.freeze({
          certificatePresented: true,
          serialNumber: normalized.certificateSerialNumber,
        }),
        evaluatedAt: normalized.evaluatedAt,
      });

      if (!transportOutcome.ok) {
        return failure("internal", "Node peer transport trust validation failed.");
      }
      if (!transportOutcome.value.trustValidation.accepted) {
        rejectionReasons.push(NodePeerCommunicationRejectionReasons.transportTrustRejected);
        transport = Object.freeze({
          policyId: transportOutcome.value.policy.policyId,
          rejectionReasons: transportOutcome.value.trustValidation.rejectionReasons,
        });
      } else {
        transport = Object.freeze({
          policyId: transportOutcome.value.policy.policyId,
          rejectionReasons: Object.freeze([]),
        });
      }
    }

    if (rejectionReasons.length === 0) {
      const peerIdentity = await this.dependencies.nodePeerCertificateIdentityResolverPort.resolveNodePeerCertificateIdentity({
        nodeId: normalized.remoteNodeId,
        certificateSerialNumber: normalized.certificateSerialNumber,
        certificateFingerprintSha256: normalized.certificateFingerprintSha256,
        asOf: normalized.evaluatedAt,
      });

      if (!peerIdentity.certificateBound) {
        rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerCertificateIdentityMismatch);
      }
      if (!peerIdentity.approved) {
        rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerApprovalRequired);
      }
      if (!peerIdentity.trusted) {
        rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerTrustRequired);
      }
      if (peerIdentity.revoked) {
        rejectionReasons.push(NodePeerCommunicationRejectionReasons.peerRevoked);
      }
    }

    const accepted = rejectionReasons.length === 0;
    return {
      ok: true,
      value: Object.freeze({
        accepted,
        connectionId: normalized.connectionId,
        localNodeId: normalized.localNodeId,
        remoteNodeId: normalized.remoteNodeId,
        operationClass: normalized.operationClass,
        exposedCapabilities: accepted ? policy.exposedCapabilities : Object.freeze([]),
        rejectionReasons: Object.freeze([...new Set(rejectionReasons)]),
        evaluatedAt: normalized.evaluatedAt ?? new Date().toISOString(),
        policy: Object.freeze({
          policyId: policy.policyId,
          source: policy.source,
          peerChannelsEnabled: policy.peerChannelsEnabled,
        }),
        transport,
      }),
    };
  }
}

function normalizeRequest(
  request: AuthorizeNodePeerCommunicationRequest,
): AuthorizeNodePeerCommunicationRequest | undefined {
  const connectionId = normalizeOptional(request.connectionId);
  const localNodeId = normalizeOptional(request.localNodeId);
  const remoteNodeId = normalizeOptional(request.remoteNodeId);
  if (!connectionId || !localNodeId || !remoteNodeId) {
    return undefined;
  }

  return Object.freeze({
    ...request,
    connectionId,
    localNodeId,
    remoteNodeId,
    certificateSerialNumber: normalizeCertificateSerialNumber(request.certificateSerialNumber),
    certificateFingerprintSha256: normalizeFingerprint(request.certificateFingerprintSha256),
    evaluatedAt: normalizeOptional(request.evaluatedAt),
  });
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

function failure(
  key: "invalidRequest" | "internal",
  message: string,
): AuthorizeNodePeerCommunicationOutcome {
  return {
    ok: false,
    error: Object.freeze({
      code: AuthorizeNodePeerCommunicationErrorCodes[key],
      message,
    }),
  };
}

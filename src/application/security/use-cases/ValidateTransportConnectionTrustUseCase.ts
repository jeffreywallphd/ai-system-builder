import {
  AuthenticatedTrustStates,
  TransportConnectionRejectionReasons,
  type TransportConnectionContext,
} from "../../../domain/security/TransportSecurityDomain";
import type {
  TransportTrustValidationFailureReason,
  TransportTrustValidationPorts,
  ValidateTransportConnectionTrustRequest,
  ValidateTransportConnectionTrustResult,
} from "../ports/TransportTrustValidationPorts";
import { EvaluateTransportConnectionPolicyUseCase } from "./EvaluateTransportConnectionPolicyUseCase";

export const ValidateTransportConnectionTrustErrorCodes = Object.freeze({
  invalidRequest: "validate-transport-connection-trust-invalid-request",
  internal: "validate-transport-connection-trust-internal",
});

export type ValidateTransportConnectionTrustErrorCode =
  typeof ValidateTransportConnectionTrustErrorCodes[keyof typeof ValidateTransportConnectionTrustErrorCodes];

export type ValidateTransportConnectionTrustOutcome =
  | {
    readonly ok: true;
    readonly value: ValidateTransportConnectionTrustResult;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: ValidateTransportConnectionTrustErrorCode;
      readonly message: string;
    };
  };

const RejectionReasonDescriptors: Readonly<Record<string, TransportTrustValidationFailureReason>> = Object.freeze({
  [TransportConnectionRejectionReasons.invalidPolicy]: Object.freeze({
    code: TransportConnectionRejectionReasons.invalidPolicy,
    category: "policy",
    message: "Transport security policy is invalid for this connection.",
    safeMessage: "Connection policy is invalid.",
  }),
  [TransportConnectionRejectionReasons.scenarioMismatch]: Object.freeze({
    code: TransportConnectionRejectionReasons.scenarioMismatch,
    category: "policy",
    message: "Transport scenario does not match the selected policy.",
    safeMessage: "Connection scenario does not satisfy policy.",
  }),
  [TransportConnectionRejectionReasons.actorTypeMismatch]: Object.freeze({
    code: TransportConnectionRejectionReasons.actorTypeMismatch,
    category: "actor",
    message: "Connection actor type does not match policy requirements.",
    safeMessage: "Connection actor is not allowed.",
  }),
  [TransportConnectionRejectionReasons.remotePeerTypeNotAllowed]: Object.freeze({
    code: TransportConnectionRejectionReasons.remotePeerTypeNotAllowed,
    category: "policy",
    message: "Remote peer type is not allowed by transport policy.",
    safeMessage: "Remote peer is not allowed.",
  }),
  [TransportConnectionRejectionReasons.insecureFallbackNotAllowed]: Object.freeze({
    code: TransportConnectionRejectionReasons.insecureFallbackNotAllowed,
    category: "transport",
    message: "Insecure fallback is not allowed.",
    safeMessage: "Insecure transport fallback is denied.",
  }),
  [TransportConnectionRejectionReasons.insecureChannelType]: Object.freeze({
    code: TransportConnectionRejectionReasons.insecureChannelType,
    category: "transport",
    message: "Transport channel type is not allowed or not secure.",
    safeMessage: "Secure channel requirements were not met.",
  }),
  [TransportConnectionRejectionReasons.transportNotEncrypted]: Object.freeze({
    code: TransportConnectionRejectionReasons.transportNotEncrypted,
    category: "transport",
    message: "Encrypted transport was not established.",
    safeMessage: "Encrypted transport is required.",
  }),
  [TransportConnectionRejectionReasons.lanNotTrustedByDefault]: Object.freeze({
    code: TransportConnectionRejectionReasons.lanNotTrustedByDefault,
    category: "transport",
    message: "LAN trust assumptions are rejected by default.",
    safeMessage: "LAN trust assumptions are not allowed.",
  }),
  [TransportConnectionRejectionReasons.missingAuthenticatedUserSession]: Object.freeze({
    code: TransportConnectionRejectionReasons.missingAuthenticatedUserSession,
    category: "actor",
    message: "Authenticated user session evidence is missing or invalid.",
    safeMessage: "Authenticated session is required.",
  }),
  [TransportConnectionRejectionReasons.trustedDeviceRequired]: Object.freeze({
    code: TransportConnectionRejectionReasons.trustedDeviceRequired,
    category: "device",
    message: "Trusted device state is required but not satisfied.",
    safeMessage: "Trusted device requirements were not met.",
  }),
  [TransportConnectionRejectionReasons.trustedNodeRequired]: Object.freeze({
    code: TransportConnectionRejectionReasons.trustedNodeRequired,
    category: "node",
    message: "Trusted node state is required but not satisfied.",
    safeMessage: "Trusted node requirements were not met.",
  }),
  [TransportConnectionRejectionReasons.peerCertificateTrustRequired]: Object.freeze({
    code: TransportConnectionRejectionReasons.peerCertificateTrustRequired,
    category: "certificate",
    message: "Peer certificate trust is required but not satisfied.",
    safeMessage: "Peer certificate trust requirements were not met.",
  }),
  [TransportConnectionRejectionReasons.mutualTlsRequired]: Object.freeze({
    code: TransportConnectionRejectionReasons.mutualTlsRequired,
    category: "transport",
    message: "Mutual TLS is required for this connection policy.",
    safeMessage: "Mutual TLS requirements were not met.",
  }),
});

export class ValidateTransportConnectionTrustUseCase {
  private readonly evaluatePolicyUseCase: EvaluateTransportConnectionPolicyUseCase;

  public constructor(private readonly ports: TransportTrustValidationPorts) {
    this.evaluatePolicyUseCase = new EvaluateTransportConnectionPolicyUseCase(ports);
  }

  public async execute(
    request: ValidateTransportConnectionTrustRequest,
  ): Promise<ValidateTransportConnectionTrustOutcome> {
    const normalizedRequest = normalizeRequest(request);
    if (!normalizedRequest) {
      return failure("invalidRequest", "Transport trust validation request is invalid.");
    }

    const trustedDevice = await this.resolveTrustedDevice(normalizedRequest);
    const trustedNode = await this.resolveTrustedNode(normalizedRequest);
    const peerCertificate = await this.resolvePeerCertificate(normalizedRequest);

    const context: TransportConnectionContext = Object.freeze({
      connectionId: normalizedRequest.connectionId,
      scenario: normalizedRequest.scenario,
      channelType: normalizedRequest.channelType,
      actorType: normalizedRequest.actorType,
      localPeerType: normalizedRequest.localPeerType,
      remotePeerType: normalizedRequest.remotePeerType,
      encryptedTransportEstablished: normalizedRequest.encryptedTransportEstablished,
      mutualTlsEstablished: normalizedRequest.mutualTlsEstablished,
      lanTrustAssumed: normalizedRequest.lanTrustAssumed,
      userSessionTrust: normalizedRequest.userSessionEvidence
        ? Object.freeze({
            userIdentityId: normalizedRequest.userSessionEvidence.userIdentityId,
            loginAuthenticated: normalizedRequest.userSessionEvidence.loginAuthenticated,
          })
        : undefined,
      deviceTrust: trustedDevice
        ? Object.freeze({
            trustedDeviceId: trustedDevice.trustedDeviceId,
            trustState: trustedDevice.trustState,
          })
        : undefined,
      nodeTrust: trustedNode
        ? Object.freeze({
            nodeId: trustedNode.nodeId,
            trustState: trustedNode.trustState,
          })
        : undefined,
      peerCertificateTrust: peerCertificate
        ? Object.freeze({
            certificatePresented: peerCertificate.certificatePresented,
            trustState: peerCertificate.trustState,
          })
        : undefined,
      occurredAt: normalizedRequest.evaluatedAt,
    });

    const evaluation = await this.evaluatePolicyUseCase.execute({
      context,
      policyOverride: normalizedRequest.policyOverride,
      evaluatedAt: normalizedRequest.evaluatedAt,
    });
    if (!evaluation.ok) {
      return failure("internal", evaluation.error.message);
    }

    return {
      ok: true,
      value: Object.freeze({
        direction: normalizedRequest.direction,
        policy: evaluation.value.policy,
        source: evaluation.value.source,
        trustValidation: evaluation.value.trustValidation,
        failureReasons: Object.freeze(
          evaluation.value.trustValidation.rejectionReasons.map((reason) => (
            RejectionReasonDescriptors[reason]
            ?? Object.freeze({
              code: reason,
              category: "request",
              message: `Connection was rejected for reason '${reason}'.`,
              safeMessage: "Connection trust validation failed.",
            })
          )),
        ),
        resolvedTrustState: Object.freeze({
          userSessionAuthenticated: Boolean(normalizedRequest.userSessionEvidence?.loginAuthenticated),
          trustedDevice,
          trustedNode,
          peerCertificate,
        }),
      }),
    };
  }

  private async resolveTrustedDevice(request: ValidateTransportConnectionTrustRequest) {
    const trustedDeviceId = normalizeOptional(request.userSessionEvidence?.trustedDeviceId);
    if (!trustedDeviceId) {
      return undefined;
    }
    if (!this.ports.trustedDeviceStateResolverPort) {
      return Object.freeze({
        trustedDeviceId,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "trusted-device-resolver-not-configured",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }

    try {
      return await this.ports.trustedDeviceStateResolverPort.resolveTrustedDeviceState({
        trustedDeviceId,
        userIdentityId: normalizeOptional(request.userSessionEvidence?.userIdentityId),
        asOf: request.evaluatedAt,
      });
    } catch {
      return Object.freeze({
        trustedDeviceId,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "trusted-device-resolution-failed",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }
  }

  private async resolveTrustedNode(request: ValidateTransportConnectionTrustRequest) {
    const nodeId = normalizeOptional(request.nodeEvidence?.nodeId);
    if (!nodeId) {
      return undefined;
    }
    if (!this.ports.nodeStateResolverPort) {
      return Object.freeze({
        nodeId,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "node-state-resolver-not-configured",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }

    try {
      return await this.ports.nodeStateResolverPort.resolveNodeState({
        nodeId,
        asOf: request.evaluatedAt,
      });
    } catch {
      return Object.freeze({
        nodeId,
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "node-state-resolution-failed",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }
  }

  private async resolvePeerCertificate(request: ValidateTransportConnectionTrustRequest) {
    if (!request.peerCertificateEvidence) {
      return undefined;
    }
    if (!this.ports.peerCertificateStateResolverPort) {
      return Object.freeze({
        certificatePresented: request.peerCertificateEvidence.certificatePresented,
        serialNumber: normalizeOptional(request.peerCertificateEvidence.serialNumber),
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "peer-certificate-resolver-not-configured",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }

    try {
      return await this.ports.peerCertificateStateResolverPort.resolvePeerCertificateState({
        certificatePresented: request.peerCertificateEvidence.certificatePresented,
        serialNumber: normalizeOptional(request.peerCertificateEvidence.serialNumber),
        asOf: request.evaluatedAt,
      });
    } catch {
      return Object.freeze({
        certificatePresented: request.peerCertificateEvidence.certificatePresented,
        serialNumber: normalizeOptional(request.peerCertificateEvidence.serialNumber),
        trustState: AuthenticatedTrustStates.unknown,
        resolution: "error" as const,
        reasonCode: "peer-certificate-resolution-failed",
        checkedAt: request.evaluatedAt ?? new Date().toISOString(),
      });
    }
  }
}

function normalizeRequest(
  request: ValidateTransportConnectionTrustRequest,
): ValidateTransportConnectionTrustRequest | undefined {
  const connectionId = normalizeOptional(request.connectionId);
  if (!connectionId) {
    return undefined;
  }
  return Object.freeze({
    ...request,
    connectionId,
    evaluatedAt: normalizeOptional(request.evaluatedAt),
    userSessionEvidence: request.userSessionEvidence
      ? Object.freeze({
          userIdentityId: request.userSessionEvidence.userIdentityId,
          loginAuthenticated: request.userSessionEvidence.loginAuthenticated,
          trustedDeviceId: normalizeOptional(request.userSessionEvidence.trustedDeviceId),
        })
      : undefined,
    nodeEvidence: request.nodeEvidence
      ? Object.freeze({
          nodeId: request.nodeEvidence.nodeId,
        })
      : undefined,
    peerCertificateEvidence: request.peerCertificateEvidence
      ? Object.freeze({
          certificatePresented: request.peerCertificateEvidence.certificatePresented,
          serialNumber: normalizeOptional(request.peerCertificateEvidence.serialNumber),
        })
      : undefined,
  });
}

function failure(
  key: "invalidRequest" | "internal",
  message: string,
): ValidateTransportConnectionTrustOutcome {
  return {
    ok: false,
    error: Object.freeze({
      code: ValidateTransportConnectionTrustErrorCodes[key],
      message,
    }),
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}


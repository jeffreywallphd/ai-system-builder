import type { ValidateTransportConnectionTrustRequest } from "../../../../application/security/ports/TransportTrustValidationPorts";
import { TransportConnectionDirections } from "../../../../application/security/ports/TransportTrustValidationPorts";
import {
  TransportConnectionActorTypes,
  TransportPeerTypes,
  TransportSecurityScenarios,
  type TransportChannelType,
} from "../../../../domain/security/TransportSecurityDomain";
import type { HttpTransportTrustValidationResult } from "../../../../infrastructure/transport/TransportTrustValidationAdapters";
import type {
  NodeTrustApiErrorCode,
  NodeTrustApiResponse,
  ResolveNodeMutualTlsTransportIdentityApiResponse,
} from "../../../api/nodes/sdk/PublicNodeTrustApiContract";

const DefaultReconnectPolicy = Object.freeze({
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
});

export interface NodeMutualTlsTransportConnectionState {
  readonly channelType: TransportChannelType;
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly peerCertificatePresented: boolean;
  readonly peerCertificateSerialNumber?: string;
  readonly peerCertificateFingerprintSha256?: string;
}

export interface NodeMutualTlsTransportValidationPorts {
  readonly trustValidator: {
    validate(request: ValidateTransportConnectionTrustRequest): Promise<HttpTransportTrustValidationResult>;
  };
  readonly nodeIdentityResolver: {
    resolveNodeMutualTlsTransportIdentity(request: {
      readonly nodeId: string;
      readonly certificateSerialNumber?: string;
      readonly certificateFingerprintSha256?: string;
    }): Promise<NodeTrustApiResponse<ResolveNodeMutualTlsTransportIdentityApiResponse>>;
  };
}

export interface NodeMutualTlsReconnectDirective {
  readonly allowed: boolean;
  readonly attempt: number;
  readonly nextDelayMs?: number;
  readonly reason?: string;
}

export type NodeMutualTlsTransportValidationResult =
  | {
    readonly ok: true;
    readonly node: ResolveNodeMutualTlsTransportIdentityApiResponse;
    readonly trust: {
      readonly enforced: true;
      readonly scenario: typeof TransportSecurityScenarios.nodeToControlPlane;
      readonly actorType: typeof TransportConnectionActorTypes.nodeIdentity;
      readonly remotePeerType: typeof TransportPeerTypes.nodeRuntime;
    };
    readonly lifecycle: {
      readonly certificateRotated: boolean;
      readonly reconnect: NodeMutualTlsReconnectDirective;
    };
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly body: NodeTrustApiResponse<never>;
    readonly lifecycle: {
      readonly certificateRotated: boolean;
      readonly reconnect: NodeMutualTlsReconnectDirective;
    };
  };

export async function validateNodeMutualTlsTransport(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly transportState: NodeMutualTlsTransportConnectionState;
  readonly previousPeerCertificateSerialNumber?: string;
  readonly previousPeerCertificateFingerprintSha256?: string;
  readonly reconnectAttempt?: number;
  readonly ports: NodeMutualTlsTransportValidationPorts;
}): Promise<NodeMutualTlsTransportValidationResult> {
  const reconnectAttempt = normalizeReconnectAttempt(input.reconnectAttempt);
  const certificateRotated = hasCertificateRotated(input);
  const normalizedNodeId = input.nodeId.trim();
  if (!normalizedNodeId) {
    return failure(400, "invalid-request", "nodeId is required.", certificateRotated, reconnectAttempt);
  }

  const trustValidationRequest: ValidateTransportConnectionTrustRequest = Object.freeze({
    connectionId: `identity-http:${input.requestId}`,
    direction: TransportConnectionDirections.inbound,
    scenario: TransportSecurityScenarios.nodeToControlPlane,
    channelType: input.transportState.channelType,
    actorType: TransportConnectionActorTypes.nodeIdentity,
    localPeerType: TransportPeerTypes.authoritativeServer,
    remotePeerType: TransportPeerTypes.nodeRuntime,
    encryptedTransportEstablished: input.transportState.encryptedTransportEstablished,
    mutualTlsEstablished: input.transportState.mutualTlsEstablished,
    lanTrustAssumed: false,
    nodeEvidence: Object.freeze({
      nodeId: normalizedNodeId,
    }),
    peerCertificateEvidence: Object.freeze({
      certificatePresented: input.transportState.peerCertificatePresented,
      serialNumber: input.transportState.peerCertificateSerialNumber,
    }),
  });
  const trustValidation = await input.ports.trustValidator.validate(trustValidationRequest);
  if (!trustValidation.ok) {
    return Object.freeze({
      ok: false,
      statusCode: trustValidation.statusCode,
      body: Object.freeze({
        ok: false,
        error: Object.freeze({
          code: trustValidation.body.error.code,
          message: trustValidation.body.error.message,
        }),
      }),
      lifecycle: Object.freeze({
        certificateRotated,
        reconnect: buildReconnectDirective({
          attempt: reconnectAttempt,
          statusCode: trustValidation.statusCode,
          errorCode: trustValidation.body.error.code,
        }),
      }),
    });
  }

  const identity = await input.ports.nodeIdentityResolver.resolveNodeMutualTlsTransportIdentity({
    nodeId: normalizedNodeId,
    certificateSerialNumber: input.transportState.peerCertificateSerialNumber,
    certificateFingerprintSha256: input.transportState.peerCertificateFingerprintSha256,
  });
  if (!identity.ok || !identity.data) {
    return Object.freeze({
      ok: false,
      statusCode: mapNodeTrustErrorCodeToStatusCode(identity.error?.code),
      body: Object.freeze({
        ok: false,
        error: Object.freeze({
          code: identity.error?.code ?? "internal",
          message: identity.error?.message ?? "Node certificate identity validation failed.",
        }),
      }),
      lifecycle: Object.freeze({
        certificateRotated,
        reconnect: buildReconnectDirective({
          attempt: reconnectAttempt,
          statusCode: mapNodeTrustErrorCodeToStatusCode(identity.error?.code),
          errorCode: identity.error?.code,
        }),
      }),
    });
  }

  return Object.freeze({
    ok: true,
    node: identity.data,
    trust: Object.freeze({
      enforced: true as const,
      scenario: TransportSecurityScenarios.nodeToControlPlane,
      actorType: TransportConnectionActorTypes.nodeIdentity,
      remotePeerType: TransportPeerTypes.nodeRuntime,
    }),
    lifecycle: Object.freeze({
      certificateRotated,
      reconnect: Object.freeze({
        allowed: true as const,
        attempt: reconnectAttempt,
      }),
    }),
  });
}

function mapNodeTrustErrorCodeToStatusCode(code: string | undefined): number {
  if (code === "invalid-request") {
    return 400;
  }
  if (code === "authentication-failed") {
    return 401;
  }
  if (code === "forbidden") {
    return 403;
  }
  if (code === "not-found") {
    return 404;
  }
  if (code === "conflict") {
    return 409;
  }
  return 500;
}

function failure(
  statusCode: number,
  code: NodeTrustApiErrorCode,
  message: string,
  certificateRotated: boolean,
  reconnectAttempt: number,
): NodeMutualTlsTransportValidationResult {
  return Object.freeze({
    ok: false,
    statusCode,
    body: Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
      }),
    }),
    lifecycle: Object.freeze({
      certificateRotated,
      reconnect: buildReconnectDirective({
        attempt: reconnectAttempt,
        statusCode,
        errorCode: code,
      }),
    }),
  });
}

function buildReconnectDirective(input: {
  readonly attempt: number;
  readonly statusCode: number;
  readonly errorCode?: string;
}): NodeMutualTlsReconnectDirective {
  if (input.errorCode === "authentication-failed" || input.errorCode === "forbidden" || input.errorCode === "conflict") {
    return Object.freeze({
      allowed: false,
      attempt: input.attempt,
      reason: "Node trust policy rejected this certificate-authenticated channel.",
    });
  }
  if (input.statusCode >= 500) {
    const exponent = Math.max(0, input.attempt - 1);
    const nextDelayMs = Math.min(
      DefaultReconnectPolicy.maxDelayMs,
      DefaultReconnectPolicy.baseDelayMs * Math.pow(2, exponent),
    );
    return Object.freeze({
      allowed: input.attempt <= DefaultReconnectPolicy.maxAttempts,
      attempt: input.attempt,
      nextDelayMs,
      reason: input.attempt <= DefaultReconnectPolicy.maxAttempts
        ? "Transient node transport validation failure."
        : "Reconnect attempt budget exhausted.",
    });
  }
  return Object.freeze({
    allowed: false,
    attempt: input.attempt,
    reason: "Node channel request is invalid for node mTLS policy.",
  });
}

function hasCertificateRotated(input: {
  readonly transportState: NodeMutualTlsTransportConnectionState;
  readonly previousPeerCertificateSerialNumber?: string;
  readonly previousPeerCertificateFingerprintSha256?: string;
}): boolean {
  const previousSerial = normalizeOptional(input.previousPeerCertificateSerialNumber)?.toUpperCase();
  const previousFingerprint = normalizeFingerprint(input.previousPeerCertificateFingerprintSha256);
  const currentSerial = normalizeOptional(input.transportState.peerCertificateSerialNumber)?.toUpperCase();
  const currentFingerprint = normalizeFingerprint(input.transportState.peerCertificateFingerprintSha256);

  return Boolean(
    (previousSerial && currentSerial && previousSerial !== currentSerial)
    || (previousFingerprint && currentFingerprint && previousFingerprint !== currentFingerprint),
  );
}

function normalizeReconnectAttempt(value?: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value as number));
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeFingerprint(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.replace(/[^a-fA-F0-9]/g, "").toUpperCase() : undefined;
}

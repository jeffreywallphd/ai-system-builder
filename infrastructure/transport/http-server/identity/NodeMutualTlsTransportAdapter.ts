import type { ValidateTransportConnectionTrustRequest } from "../../../../src/application/security/ports/TransportTrustValidationPorts";
import { TransportConnectionDirections } from "../../../../src/application/security/ports/TransportTrustValidationPorts";
import {
  TransportConnectionActorTypes,
  TransportPeerTypes,
  TransportSecurityScenarios,
  type TransportChannelType,
} from "../../../../src/domain/security/TransportSecurityDomain";
import type { HttpTransportTrustValidationResult } from "../../../../src/infrastructure/transport/TransportTrustValidationAdapters";
import type {
  NodeTrustApiErrorCode,
  NodeTrustApiResponse,
  ResolveNodeMutualTlsTransportIdentityApiResponse,
} from "../../../api/nodes/sdk/PublicNodeTrustApiContract";

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
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly body: NodeTrustApiResponse<never>;
  };

export async function validateNodeMutualTlsTransport(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly transportState: NodeMutualTlsTransportConnectionState;
  readonly ports: NodeMutualTlsTransportValidationPorts;
}): Promise<NodeMutualTlsTransportValidationResult> {
  const normalizedNodeId = input.nodeId.trim();
  if (!normalizedNodeId) {
    return failure(400, "invalid-request", "nodeId is required.");
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
  });
}

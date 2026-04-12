import type { NodeTrustApiResponse } from "../../../../api/nodes/sdk/PublicNodeTrustApiContract";
import type { NodeMutualTlsTransportValidationResult } from "../NodeMutualTlsTransportAdapter";

type NodeMutualTlsAcceptedTrust = Extract<NodeMutualTlsTransportValidationResult, { readonly ok: true }>["trust"];

export interface NodeRouteTransportContext<TConnectionState, TTrustValidation> {
  readonly nodeId: string;
  readonly transport: {
    readonly connection: TConnectionState;
    readonly trustValidation: TTrustValidation;
  };
}

export interface SessionNodeRouteAuthorizationContext<TConnectionState, TTrustValidation> {
  readonly principal: {
    readonly userIdentityId: string;
    readonly username: string;
  };
  readonly session: {
    readonly providerSubject: string;
  };
  readonly transport: {
    readonly connection: TConnectionState;
    readonly trustValidation: TTrustValidation;
  };
}

export type SessionNodeRouteAuthorizationResolution<TFailureBody> =
  | {
    readonly ok: true;
  }
  | {
    readonly ok: false;
    readonly statusCode: 403;
    readonly body: TFailureBody;
    readonly requestLogPayload: Readonly<Record<string, unknown>>;
  };

export type NodeRouteRequiredNodeIdResolution<TFailureBody> =
  | {
    readonly ok: true;
    readonly nodeId: string;
  }
  | {
    readonly ok: false;
    readonly statusCode: 400;
    readonly body: TFailureBody;
    readonly requestLogPayload: Readonly<Record<string, unknown>>;
  };

export type NodeRouteMutualTlsResolution<TConnectionState> =
  | {
    readonly ok: true;
    readonly context: NodeRouteTransportContext<TConnectionState, NodeMutualTlsAcceptedTrust>;
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly body: NodeTrustApiResponse<never>;
    readonly requestLogPayload: Readonly<Record<string, unknown>>;
  };

export function resolveRequiredNodeRouteNodeId<TFailureBody>(input: {
  readonly nodeId: string | undefined;
  readonly buildInvalidResponse(message: string): TFailureBody;
}): NodeRouteRequiredNodeIdResolution<TFailureBody> {
  const nodeId = normalizeOptionalString(input.nodeId);
  if (!nodeId) {
    return Object.freeze({
      ok: false,
      statusCode: 400 as const,
      body: input.buildInvalidResponse("nodeId is required."),
      requestLogPayload: Object.freeze({}),
    });
  }

  return Object.freeze({
    ok: true,
    nodeId,
  });
}

export function authorizeSessionNodeRoutePrincipal<TConnectionState, TTrustValidation, TFailureBody>(input: {
  readonly nodeId: string;
  readonly context: SessionNodeRouteAuthorizationContext<TConnectionState, TTrustValidation>;
  readonly buildForbiddenResponse(message: string): TFailureBody;
}): SessionNodeRouteAuthorizationResolution<TFailureBody> {
  if (isSessionPrincipalBoundToNodeId(input.context, input.nodeId)) {
    return Object.freeze({
      ok: true,
    });
  }

  return Object.freeze({
    ok: false,
    statusCode: 403 as const,
    body: input.buildForbiddenResponse(
      `Authenticated session is not authorized to establish node transport for '${input.nodeId}'.`,
    ),
    requestLogPayload: Object.freeze({
      nodeId: input.nodeId,
      principalUserIdentityId: input.context.principal.userIdentityId,
      principalUsername: input.context.principal.username,
      sessionProviderSubject: input.context.session.providerSubject,
    }),
  });
}

export function buildSessionNodeRouteTransportContext<TConnectionState, TTrustValidation>(input: {
  readonly nodeId: string;
  readonly context: SessionNodeRouteAuthorizationContext<TConnectionState, TTrustValidation>;
}): NodeRouteTransportContext<TConnectionState, TTrustValidation> {
  return Object.freeze({
    nodeId: input.nodeId,
    transport: Object.freeze({
      connection: input.context.transport.connection,
      trustValidation: input.context.transport.trustValidation,
    }),
  });
}

export function resolveMutualTlsNodeRouteTransportContext<TConnectionState>(input: {
  readonly nodeId: string;
  readonly transportState: TConnectionState & {
    readonly channelType: string;
    readonly encryptedTransportEstablished: boolean;
    readonly mutualTlsEstablished: boolean;
    readonly peerCertificatePresented: boolean;
    readonly peerCertificateSerialNumber?: string;
  };
  readonly validation: NodeMutualTlsTransportValidationResult;
}): NodeRouteMutualTlsResolution<TConnectionState> {
  if (!input.validation.ok) {
    return Object.freeze({
      ok: false,
      statusCode: input.validation.statusCode,
      body: input.validation.body,
      requestLogPayload: Object.freeze({
        nodeId: input.nodeId,
        transport: Object.freeze({
          channelType: input.transportState.channelType,
          encryptedTransportEstablished: input.transportState.encryptedTransportEstablished,
          mutualTlsEstablished: input.transportState.mutualTlsEstablished,
          peerCertificatePresented: input.transportState.peerCertificatePresented,
          peerCertificateSerialNumber: input.transportState.peerCertificateSerialNumber,
        }),
      }),
    });
  }

  return Object.freeze({
    ok: true,
    context: Object.freeze({
      nodeId: input.validation.node.nodeId,
      transport: Object.freeze({
        connection: input.transportState,
        trustValidation: input.validation.trust,
      }),
    }),
  });
}

function isSessionPrincipalBoundToNodeId<TConnectionState, TTrustValidation>(
  context: SessionNodeRouteAuthorizationContext<TConnectionState, TTrustValidation>,
  nodeId: string,
): boolean {
  const expectedNodeId = nodeId.trim();
  if (!expectedNodeId) {
    return false;
  }

  const candidateValues = [
    context.principal.userIdentityId,
    context.principal.username,
    context.session.providerSubject,
  ];
  return candidateValues.some((candidate) => candidate.trim() === expectedNodeId);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

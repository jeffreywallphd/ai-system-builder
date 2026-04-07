import {
  type TransportConnectionContext,
  type TransportConnectionTrustValidationResult,
  type TransportSecurityPolicy,
  evaluateTransportConnectionTrust,
} from "@domain/security/TransportSecurityDomain";
import type { TransportSecurityPolicyEvaluationPorts } from "../ports/TransportSecurityPorts";

export const EvaluateTransportConnectionPolicyErrorCodes = Object.freeze({
  invalidRequest: "evaluate-transport-connection-policy-invalid-request",
  internal: "evaluate-transport-connection-policy-internal",
});

export type EvaluateTransportConnectionPolicyErrorCode =
  typeof EvaluateTransportConnectionPolicyErrorCodes[keyof typeof EvaluateTransportConnectionPolicyErrorCodes];

export type EvaluateTransportConnectionPolicyOutcome =
  | {
    readonly ok: true;
    readonly value: {
      readonly policy: TransportSecurityPolicy;
      readonly trustValidation: TransportConnectionTrustValidationResult;
      readonly source: "baseline" | "override";
    };
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: EvaluateTransportConnectionPolicyErrorCode;
      readonly message: string;
    };
  };

export interface EvaluateTransportConnectionPolicyUseCaseInput {
  readonly context: TransportConnectionContext;
  readonly policyOverride?: TransportSecurityPolicy;
  readonly evaluatedAt?: string;
}

export class EvaluateTransportConnectionPolicyUseCase {
  public constructor(private readonly ports: TransportSecurityPolicyEvaluationPorts) {}

  public async execute(
    input: EvaluateTransportConnectionPolicyUseCaseInput,
  ): Promise<EvaluateTransportConnectionPolicyOutcome> {
    const context = normalizeContext(input.context);
    if (!context) {
      return failure("invalidRequest", "Transport connection context is required.");
    }

    let resolved: { readonly policy: TransportSecurityPolicy; readonly source: "baseline" | "override" };
    try {
      if (input.policyOverride) {
        resolved = Object.freeze({
          policy: input.policyOverride,
          source: "override",
        });
      } else {
        resolved = await this.ports.transportSecurityPolicyResolverPort.resolveTransportSecurityPolicy({
          scenario: context.scenario,
          localPeerType: context.localPeerType,
          remotePeerType: context.remotePeerType,
        });
      }
    } catch {
      return failure("internal", "Transport security policy resolution failed.");
    }

    let trustValidation: TransportConnectionTrustValidationResult;
    try {
      trustValidation = await this.ports.transportConnectionPolicyEvaluatorPort.evaluateTransportConnectionPolicy({
        policy: resolved.policy,
        context,
        evaluatedAt: input.evaluatedAt,
      });
    } catch {
      trustValidation = evaluateTransportConnectionTrust({
        policy: resolved.policy,
        context,
        evaluatedAt: input.evaluatedAt,
      });
    }

    await this.audit(context, resolved.policy, trustValidation);

    return {
      ok: true,
      value: Object.freeze({
        policy: resolved.policy,
        trustValidation,
        source: resolved.source,
      }),
    };
  }

  private async audit(
    context: TransportConnectionContext,
    policy: TransportSecurityPolicy,
    trustValidation: TransportConnectionTrustValidationResult,
  ): Promise<void> {
    if (!this.ports.transportConnectionPolicyAuditPort) {
      return;
    }

    try {
      await this.ports.transportConnectionPolicyAuditPort.recordTransportConnectionPolicyDecision({
        event: trustValidation.accepted ? "transport-connection-accepted" : "transport-connection-rejected",
        connectionId: context.connectionId,
        scenario: context.scenario,
        policyId: policy.policyId,
        actorType: context.actorType,
        localPeerType: context.localPeerType,
        remotePeerType: context.remotePeerType,
        channelType: context.channelType,
        rejectionReasons: trustValidation.rejectionReasons,
        resolvedTrustState: Object.freeze({
          userSessionAuthenticated: Boolean(context.userSessionTrust?.loginAuthenticated),
          trustedDevice: context.deviceTrust
            ? Object.freeze({
                trustedDeviceId: context.deviceTrust.trustedDeviceId,
                trustState: context.deviceTrust.trustState,
              })
            : undefined,
          trustedNode: context.nodeTrust
            ? Object.freeze({
                nodeId: context.nodeTrust.nodeId,
                trustState: context.nodeTrust.trustState,
              })
            : undefined,
          peerCertificate: context.peerCertificateTrust
            ? Object.freeze({
                certificatePresented: context.peerCertificateTrust.certificatePresented,
                trustState: context.peerCertificateTrust.trustState,
              })
            : undefined,
        }),
        occurredAt: trustValidation.evaluatedAt,
      });
    } catch {
      // Intentionally non-fatal for transport decisioning.
    }
  }
}

function normalizeContext(context: TransportConnectionContext): TransportConnectionContext | undefined {
  if (!context || !context.connectionId.trim()) {
    return undefined;
  }
  return context;
}

function failure(
  key: "invalidRequest" | "internal",
  message: string,
): EvaluateTransportConnectionPolicyOutcome {
  return {
    ok: false,
    error: Object.freeze({
      code: EvaluateTransportConnectionPolicyErrorCodes[key],
      message,
    }),
  };
}


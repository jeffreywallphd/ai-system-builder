import { describe, expect, it } from "bun:test";
import {
  AuthenticatedTrustStates,
  TransportChannelTypes,
  TransportConnectionActorTypes,
  TransportConnectionRejectionReasons,
  TransportPeerTypes,
  TransportSecurityScenarios,
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
  TransportConnectionPolicyDecisionAuditEvent,
  ITransportConnectionPolicyAuditPort,
  ITransportConnectionPolicyEvaluatorPort,
  ITransportSecurityPolicyResolverPort,
} from "../ports/TransportSecurityPorts";
import { EvaluateTransportConnectionPolicyUseCase } from "../use-cases/EvaluateTransportConnectionPolicyUseCase";

class InMemoryTransportPolicyResolver implements ITransportSecurityPolicyResolverPort {
  async resolveTransportSecurityPolicy(request: ResolveTransportSecurityPolicyRequest) {
    return {
      policy: resolveBaselineTransportSecurityPolicy(request.scenario),
      source: "baseline" as const,
    };
  }
}

class DomainBackedTransportConnectionEvaluator implements ITransportConnectionPolicyEvaluatorPort {
  async evaluateTransportConnectionPolicy(
    request: EvaluateTransportConnectionPolicyRequest,
  ) {
    return evaluateTransportConnectionTrust({
      policy: request.policy,
      context: request.context,
      evaluatedAt: request.evaluatedAt,
    });
  }
}

class InMemoryTransportAuditPort implements ITransportConnectionPolicyAuditPort {
  public readonly events: TransportConnectionPolicyDecisionAuditEvent[] = [];

  async recordTransportConnectionPolicyDecision(
    event: TransportConnectionPolicyDecisionAuditEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

describe("EvaluateTransportConnectionPolicyUseCase", () => {
  it("evaluates thin-client control-plane requests with baseline policy", async () => {
    const useCase = new EvaluateTransportConnectionPolicyUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
    });

    const outcome = await useCase.execute({
      context: {
        connectionId: "conn:thin:1",
        scenario: TransportSecurityScenarios.thinClientToControlPlane,
        channelType: TransportChannelTypes.https,
        actorType: TransportConnectionActorTypes.userSession,
        localPeerType: TransportPeerTypes.thinClient,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        lanTrustAssumed: false,
        userSessionTrust: {
          userIdentityId: "user:thin",
          loginAuthenticated: false,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.source).toBe("baseline");
    expect(outcome.value.trustValidation.accepted).toBeFalse();
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.missingAuthenticatedUserSession,
    );
  });

  it("supports policy overrides and emits audit events", async () => {
    const auditPort = new InMemoryTransportAuditPort();
    const useCase = new EvaluateTransportConnectionPolicyUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
      transportConnectionPolicyAuditPort: auditPort,
    });
    const override = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.desktopClientToControlPlane);

    const outcome = await useCase.execute({
      policyOverride: override,
      context: {
        connectionId: "conn:desktop:override:1",
        scenario: TransportSecurityScenarios.desktopClientToControlPlane,
        channelType: TransportChannelTypes.wss,
        actorType: TransportConnectionActorTypes.userSession,
        localPeerType: TransportPeerTypes.desktopClient,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        lanTrustAssumed: false,
        userSessionTrust: {
          userIdentityId: "user:desktop",
          loginAuthenticated: true,
        },
        deviceTrust: {
          trustedDeviceId: "device:desktop",
          trustState: AuthenticatedTrustStates.trusted,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.source).toBe("override");
    expect(outcome.value.trustValidation.accepted).toBeTrue();
    expect(auditPort.events).toHaveLength(1);
    expect(auditPort.events[0]?.event).toBe("transport-connection-accepted");
    expect(auditPort.events[0]?.resolvedTrustState?.trustedDevice?.trustState).toBe(AuthenticatedTrustStates.trusted);
    expect(auditPort.events[0]?.resolvedTrustState?.peerCertificate?.certificatePresented).toBeTrue();
  });

  it("fails closed when override policy enables insecure fallback", async () => {
    const useCase = new EvaluateTransportConnectionPolicyUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
    });

    const insecureOverride = {
      ...resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.serviceToService),
      policyId: "policy:override:insecure",
      allowInsecureFallback: true,
      allowedChannelTypes: [TransportChannelTypes.http],
    };

    const outcome = await useCase.execute({
      policyOverride: insecureOverride,
      context: {
        connectionId: "conn:service:insecure",
        scenario: TransportSecurityScenarios.serviceToService,
        channelType: TransportChannelTypes.http,
        actorType: TransportConnectionActorTypes.serviceIdentity,
        localPeerType: TransportPeerTypes.internalService,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: false,
        mutualTlsEstablished: false,
        lanTrustAssumed: false,
        peerCertificateTrust: {
          certificatePresented: false,
          trustState: AuthenticatedTrustStates.unknown,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.trustValidation.accepted).toBeFalse();
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.invalidPolicy,
    );
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.insecureFallbackNotAllowed,
    );
  });
});


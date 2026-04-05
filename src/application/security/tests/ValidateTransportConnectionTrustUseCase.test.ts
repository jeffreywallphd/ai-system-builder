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
} from "../../../domain/security/TransportSecurityDomain";
import type {
  EvaluateTransportConnectionPolicyRequest,
  ResolveTransportSecurityPolicyRequest,
  ITransportConnectionPolicyEvaluatorPort,
  ITransportSecurityPolicyResolverPort,
} from "../ports/TransportSecurityPorts";
import type {
  ITransportNodeStateResolverPort,
  ITransportPeerCertificateStateResolverPort,
  ITransportTrustedDeviceStateResolverPort,
  ResolveTransportNodeStateInput,
  ResolveTransportPeerCertificateStateInput,
  ResolveTransportTrustedDeviceStateInput,
} from "../ports/TransportTrustValidationPorts";
import { ValidateTransportConnectionTrustUseCase } from "../use-cases/ValidateTransportConnectionTrustUseCase";

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

class InMemoryTrustedDeviceStateResolver implements ITransportTrustedDeviceStateResolverPort {
  public constructor(private readonly trustState: typeof AuthenticatedTrustStates[keyof typeof AuthenticatedTrustStates]) {}

  async resolveTrustedDeviceState(input: ResolveTransportTrustedDeviceStateInput) {
    return Object.freeze({
      trustedDeviceId: input.trustedDeviceId,
      trustState: this.trustState,
      resolution: "resolved" as const,
      checkedAt: input.asOf ?? "2026-04-05T12:00:00.000Z",
    });
  }
}

class InMemoryNodeStateResolver implements ITransportNodeStateResolverPort {
  public constructor(private readonly trustState: typeof AuthenticatedTrustStates[keyof typeof AuthenticatedTrustStates]) {}

  async resolveNodeState(input: ResolveTransportNodeStateInput) {
    return Object.freeze({
      nodeId: input.nodeId,
      trustState: this.trustState,
      resolution: "resolved" as const,
      checkedAt: input.asOf ?? "2026-04-05T12:00:00.000Z",
    });
  }
}

class InMemoryPeerCertificateStateResolver implements ITransportPeerCertificateStateResolverPort {
  public constructor(private readonly trustState: typeof AuthenticatedTrustStates[keyof typeof AuthenticatedTrustStates]) {}

  async resolvePeerCertificateState(input: ResolveTransportPeerCertificateStateInput) {
    return Object.freeze({
      certificatePresented: input.certificatePresented,
      serialNumber: input.serialNumber,
      trustState: this.trustState,
      resolution: "resolved" as const,
      checkedAt: input.asOf ?? "2026-04-05T12:00:00.000Z",
    });
  }
}

describe("ValidateTransportConnectionTrustUseCase", () => {
  it("accepts desktop client control-plane connection with trusted device and certificate trust", async () => {
    const useCase = new ValidateTransportConnectionTrustUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
      trustedDeviceStateResolverPort: new InMemoryTrustedDeviceStateResolver(AuthenticatedTrustStates.trusted),
      peerCertificateStateResolverPort: new InMemoryPeerCertificateStateResolver(AuthenticatedTrustStates.trusted),
    });

    const outcome = await useCase.execute({
      connectionId: "conn:desktop:trusted",
      direction: "outbound",
      scenario: TransportSecurityScenarios.desktopClientToControlPlane,
      channelType: TransportChannelTypes.https,
      actorType: TransportConnectionActorTypes.userSession,
      localPeerType: TransportPeerTypes.desktopClient,
      remotePeerType: TransportPeerTypes.authoritativeServer,
      encryptedTransportEstablished: true,
      mutualTlsEstablished: false,
      lanTrustAssumed: false,
      userSessionEvidence: {
        userIdentityId: "user:desktop",
        loginAuthenticated: true,
        trustedDeviceId: "device:trusted",
      },
      peerCertificateEvidence: {
        certificatePresented: true,
        serialNumber: "AABBCCDD",
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.trustValidation.accepted).toBeTrue();
    expect(outcome.value.failureReasons).toHaveLength(0);
  });

  it("rejects desktop connection when trusted device state is not trusted", async () => {
    const useCase = new ValidateTransportConnectionTrustUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
      trustedDeviceStateResolverPort: new InMemoryTrustedDeviceStateResolver(AuthenticatedTrustStates.revoked),
      peerCertificateStateResolverPort: new InMemoryPeerCertificateStateResolver(AuthenticatedTrustStates.trusted),
    });

    const outcome = await useCase.execute({
      connectionId: "conn:desktop:revoked-device",
      direction: "inbound",
      scenario: TransportSecurityScenarios.desktopClientToControlPlane,
      channelType: TransportChannelTypes.wss,
      actorType: TransportConnectionActorTypes.userSession,
      localPeerType: TransportPeerTypes.authoritativeServer,
      remotePeerType: TransportPeerTypes.desktopClient,
      encryptedTransportEstablished: true,
      mutualTlsEstablished: false,
      lanTrustAssumed: false,
      userSessionEvidence: {
        userIdentityId: "user:desktop",
        loginAuthenticated: true,
        trustedDeviceId: "device:revoked",
      },
      peerCertificateEvidence: {
        certificatePresented: true,
        serialNumber: "AABBCCDD",
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.trustValidation.accepted).toBeFalse();
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.trustedDeviceRequired,
    );
    expect(outcome.value.failureReasons.some((item) => (
      item.code === TransportConnectionRejectionReasons.trustedDeviceRequired
    ))).toBeTrue();
  });

  it("rejects node connection when node and certificate trust are not approved", async () => {
    const useCase = new ValidateTransportConnectionTrustUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
      nodeStateResolverPort: new InMemoryNodeStateResolver(AuthenticatedTrustStates.revoked),
      peerCertificateStateResolverPort: new InMemoryPeerCertificateStateResolver(AuthenticatedTrustStates.revoked),
    });

    const outcome = await useCase.execute({
      connectionId: "conn:node:revoked",
      direction: "outbound",
      scenario: TransportSecurityScenarios.nodeToControlPlane,
      channelType: TransportChannelTypes.tls,
      actorType: TransportConnectionActorTypes.nodeIdentity,
      localPeerType: TransportPeerTypes.nodeRuntime,
      remotePeerType: TransportPeerTypes.authoritativeServer,
      encryptedTransportEstablished: true,
      mutualTlsEstablished: true,
      lanTrustAssumed: false,
      nodeEvidence: {
        nodeId: "node:revoked",
      },
      peerCertificateEvidence: {
        certificatePresented: true,
        serialNumber: "DEADBEEF",
      },
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.trustValidation.accepted).toBeFalse();
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.trustedNodeRequired,
    );
    expect(outcome.value.trustValidation.rejectionReasons).toContain(
      TransportConnectionRejectionReasons.peerCertificateTrustRequired,
    );
  });

  it("returns invalid request outcome when connection id is missing", async () => {
    const useCase = new ValidateTransportConnectionTrustUseCase({
      transportSecurityPolicyResolverPort: new InMemoryTransportPolicyResolver(),
      transportConnectionPolicyEvaluatorPort: new DomainBackedTransportConnectionEvaluator(),
    });

    const outcome = await useCase.execute({
      connectionId: " ",
      direction: "inbound",
      scenario: TransportSecurityScenarios.thinClientToControlPlane,
      channelType: TransportChannelTypes.https,
      actorType: TransportConnectionActorTypes.userSession,
      localPeerType: TransportPeerTypes.authoritativeServer,
      remotePeerType: TransportPeerTypes.thinClient,
      encryptedTransportEstablished: true,
      mutualTlsEstablished: false,
      lanTrustAssumed: false,
      userSessionEvidence: {
        userIdentityId: "user:thin",
        loginAuthenticated: true,
      },
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("validate-transport-connection-trust-invalid-request");
  });
});

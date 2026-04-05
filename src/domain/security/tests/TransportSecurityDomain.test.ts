import { describe, expect, it } from "bun:test";
import {
  AuthenticatedTrustStates,
  TransportChannelTypes,
  TransportConnectionActorTypes,
  TransportConnectionRejectionReasons,
  TransportPeerTypes,
  TransportSecurityScenarios,
  evaluateTransportConnectionTrust,
  listBaselineTransportSecurityPolicies,
  resolveBaselineTransportSecurityPolicy,
  validateTransportSecurityPolicy,
} from "../TransportSecurityDomain";

describe("TransportSecurityDomain", () => {
  it("defines scenario-specific fail-closed baseline policies", () => {
    const policies = listBaselineTransportSecurityPolicies();
    const desktop = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.desktopClientToControlPlane);
    const thinClient = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.thinClientToControlPlane);
    const node = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToControlPlane);

    expect(policies).toHaveLength(4);
    expect(desktop.requireAuthenticatedUserSession).toBeTrue();
    expect(desktop.requireTrustedDevice).toBeTrue();
    expect(thinClient.requireAuthenticatedUserSession).toBeTrue();
    expect(thinClient.requireTrustedDevice).toBeFalse();
    expect(node.requireTrustedNode).toBeTrue();
    expect(node.requireMutualTls).toBeTrue();
  });

  it("rejects policies that allow insecure channels or fallback", () => {
    const validation = validateTransportSecurityPolicy({
      ...resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.serviceToService),
      policyId: "policy:unsafe",
      allowedChannelTypes: [TransportChannelTypes.http],
      allowInsecureFallback: true,
    });

    expect(validation.valid).toBeFalse();
    expect(validation.violations.some((violation) => violation.includes("not secure"))).toBeTrue();
    expect(validation.violations.some((violation) => violation.includes("insecure fallback"))).toBeTrue();
  });

  it("rejects desktop control-plane connections without trusted device state", () => {
    const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.desktopClientToControlPlane);
    const result = evaluateTransportConnectionTrust({
      policy,
      context: {
        connectionId: "conn:desktop:1",
        scenario: TransportSecurityScenarios.desktopClientToControlPlane,
        channelType: TransportChannelTypes.https,
        actorType: TransportConnectionActorTypes.userSession,
        localPeerType: TransportPeerTypes.desktopClient,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        lanTrustAssumed: false,
        userSessionTrust: {
          userIdentityId: "user:1",
          loginAuthenticated: true,
        },
        deviceTrust: {
          trustedDeviceId: "device:1",
          trustState: AuthenticatedTrustStates.pending,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result.accepted).toBeFalse();
    expect(result.rejectionReasons).toContain(TransportConnectionRejectionReasons.trustedDeviceRequired);
  });

  it("rejects node control-plane connections without trusted node and mutual TLS", () => {
    const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToControlPlane);
    const result = evaluateTransportConnectionTrust({
      policy,
      context: {
        connectionId: "conn:node:1",
        scenario: TransportSecurityScenarios.nodeToControlPlane,
        channelType: TransportChannelTypes.https,
        actorType: TransportConnectionActorTypes.nodeIdentity,
        localPeerType: TransportPeerTypes.nodeRuntime,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        lanTrustAssumed: false,
        nodeTrust: {
          nodeId: "node:1",
          trustState: AuthenticatedTrustStates.pending,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result.accepted).toBeFalse();
    expect(result.rejectionReasons).toContain(TransportConnectionRejectionReasons.trustedNodeRequired);
    expect(result.rejectionReasons).toContain(TransportConnectionRejectionReasons.mutualTlsRequired);
  });

  it("accepts trusted mTLS node connection for control-plane access", () => {
    const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToControlPlane);
    const result = evaluateTransportConnectionTrust({
      policy,
      context: {
        connectionId: "conn:node:trusted",
        scenario: TransportSecurityScenarios.nodeToControlPlane,
        channelType: TransportChannelTypes.tls,
        actorType: TransportConnectionActorTypes.nodeIdentity,
        localPeerType: TransportPeerTypes.nodeRuntime,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        lanTrustAssumed: false,
        nodeTrust: {
          nodeId: "node:trusted",
          trustState: AuthenticatedTrustStates.trusted,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result.accepted).toBeTrue();
    expect(result.rejectionReasons).toHaveLength(0);
  });

  it("rejects trust-by-lan assumptions even when other trust evidence is present", () => {
    const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.thinClientToControlPlane);
    const result = evaluateTransportConnectionTrust({
      policy,
      context: {
        connectionId: "conn:thin-client:lan",
        scenario: TransportSecurityScenarios.thinClientToControlPlane,
        channelType: TransportChannelTypes.wss,
        actorType: TransportConnectionActorTypes.userSession,
        localPeerType: TransportPeerTypes.thinClient,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        lanTrustAssumed: true,
        userSessionTrust: {
          userIdentityId: "user:2",
          loginAuthenticated: true,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result.accepted).toBeFalse();
    expect(result.rejectionReasons).toContain(TransportConnectionRejectionReasons.lanNotTrustedByDefault);
  });
});

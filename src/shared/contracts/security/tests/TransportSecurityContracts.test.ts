import { describe, expect, it } from "bun:test";
import {
  AuthenticatedTrustStates,
  TransportChannelTypes,
  TransportConnectionActorTypes,
  TransportPeerTypes,
  TransportSecurityScenarios,
  evaluateTransportConnectionTrust,
  resolveBaselineTransportSecurityPolicy,
} from "../../../../domain/security/TransportSecurityDomain";
import {
  TransportSecurityContractError,
  TransportSecurityContractScopes,
  toTransportConnectionContextDto,
  toTransportConnectionTrustValidationResultDto,
  toTransportSecurityPolicyDto,
} from "../TransportSecurityContracts";

describe("TransportSecurityContracts", () => {
  it("defines host and infrastructure transport contract scopes", () => {
    expect(TransportSecurityContractScopes.hostInternal).toBe("host-internal");
    expect(TransportSecurityContractScopes.infrastructureAdapter).toBe("infrastructure-adapter");
  });

  it("projects transport policy and trust validation to stable DTOs", () => {
    const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.nodeToControlPlane);
    const validation = evaluateTransportConnectionTrust({
      policy,
      context: {
        connectionId: "conn:node:1",
        scenario: TransportSecurityScenarios.nodeToControlPlane,
        channelType: TransportChannelTypes.tls,
        actorType: TransportConnectionActorTypes.nodeIdentity,
        localPeerType: TransportPeerTypes.nodeRuntime,
        remotePeerType: TransportPeerTypes.authoritativeServer,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        lanTrustAssumed: false,
        nodeTrust: {
          nodeId: "node:1",
          trustState: AuthenticatedTrustStates.trusted,
        },
        peerCertificateTrust: {
          certificatePresented: true,
          trustState: AuthenticatedTrustStates.trusted,
        },
      },
      evaluatedAt: "2026-04-05T12:00:00.000Z",
    });

    const policyDto = toTransportSecurityPolicyDto(policy);
    const validationDto = toTransportConnectionTrustValidationResultDto(validation);

    expect(policyDto.scenario).toBe(TransportSecurityScenarios.nodeToControlPlane);
    expect(policyDto.requireTrustedNode).toBeTrue();
    expect(validationDto.accepted).toBeTrue();
    expect(validationDto.policyId).toBe(policy.policyId);
  });

  it("projects context with separated user, device, and node trust state", () => {
    const contextDto = toTransportConnectionContextDto({
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
        trustState: AuthenticatedTrustStates.trusted,
      },
      nodeTrust: {
        nodeId: "node:should-not-authorize-user",
        trustState: AuthenticatedTrustStates.pending,
      },
      peerCertificateTrust: {
        certificatePresented: true,
        trustState: AuthenticatedTrustStates.trusted,
      },
      occurredAt: "2026-04-05T12:00:00.000Z",
    });

    expect(contextDto.userSessionAuthenticated).toBeTrue();
    expect(contextDto.deviceTrustState).toBe(AuthenticatedTrustStates.trusted);
    expect(contextDto.nodeTrustState).toBe(AuthenticatedTrustStates.pending);
  });

  it("rejects context projection when connection identity is missing", () => {
    expect(() => toTransportConnectionContextDto({
      connectionId: "   ",
      scenario: TransportSecurityScenarios.thinClientToControlPlane,
      channelType: TransportChannelTypes.wss,
      actorType: TransportConnectionActorTypes.userSession,
      localPeerType: TransportPeerTypes.thinClient,
      remotePeerType: TransportPeerTypes.authoritativeServer,
      encryptedTransportEstablished: true,
      mutualTlsEstablished: false,
      lanTrustAssumed: false,
    })).toThrow(TransportSecurityContractError);
  });
});

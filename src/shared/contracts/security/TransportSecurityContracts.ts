import type {
  TransportConnectionContext,
  TransportConnectionTrustValidationResult,
  TransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";

export class TransportSecurityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportSecurityContractError";
  }
}

export const TransportSecurityContractScopes = Object.freeze({
  hostInternal: "host-internal",
  infrastructureAdapter: "infrastructure-adapter",
});

export type TransportSecurityContractScope =
  typeof TransportSecurityContractScopes[keyof typeof TransportSecurityContractScopes];

export interface TransportConnectionContextDto {
  readonly connectionId: string;
  readonly scenario: TransportConnectionContext["scenario"];
  readonly channelType: TransportConnectionContext["channelType"];
  readonly actorType: TransportConnectionContext["actorType"];
  readonly localPeerType: TransportConnectionContext["localPeerType"];
  readonly remotePeerType: TransportConnectionContext["remotePeerType"];
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly lanTrustAssumed: boolean;
  readonly userSessionAuthenticated: boolean;
  readonly deviceTrustState?: NonNullable<TransportConnectionContext["deviceTrust"]>["trustState"];
  readonly nodeTrustState?: NonNullable<TransportConnectionContext["nodeTrust"]>["trustState"];
  readonly peerCertificatePresented?: boolean;
  readonly peerCertificateTrustState?: NonNullable<TransportConnectionContext["peerCertificateTrust"]>["trustState"];
  readonly occurredAt?: string;
}

export interface TransportSecurityPolicyDto {
  readonly policyId: string;
  readonly scenario: TransportSecurityPolicy["scenario"];
  readonly allowedChannelTypes: ReadonlyArray<TransportSecurityPolicy["allowedChannelTypes"][number]>;
  readonly allowedRemotePeerTypes: ReadonlyArray<TransportSecurityPolicy["allowedRemotePeerTypes"][number]>;
  readonly requiredActorType: TransportSecurityPolicy["requiredActorType"];
  readonly requireAuthenticatedUserSession: boolean;
  readonly requireTrustedDevice: boolean;
  readonly requireTrustedNode: boolean;
  readonly requirePeerCertificateTrust: boolean;
  readonly requireMutualTls: boolean;
  readonly allowInsecureFallback: boolean;
}

export interface TransportConnectionTrustValidationResultDto {
  readonly accepted: boolean;
  readonly rejectionReasons: ReadonlyArray<string>;
  readonly evaluatedAt: string;
  readonly policyId: string;
  readonly scenario: TransportConnectionTrustValidationResult["scenario"];
}

export function toTransportConnectionContextDto(
  value: TransportConnectionContext,
): TransportConnectionContextDto {
  if (!value.connectionId.trim()) {
    throw new TransportSecurityContractError("Transport connection context requires connectionId.");
  }

  return Object.freeze({
    connectionId: value.connectionId,
    scenario: value.scenario,
    channelType: value.channelType,
    actorType: value.actorType,
    localPeerType: value.localPeerType,
    remotePeerType: value.remotePeerType,
    encryptedTransportEstablished: value.encryptedTransportEstablished,
    mutualTlsEstablished: value.mutualTlsEstablished,
    lanTrustAssumed: value.lanTrustAssumed,
    userSessionAuthenticated: Boolean(value.userSessionTrust?.loginAuthenticated),
    deviceTrustState: value.deviceTrust?.trustState,
    nodeTrustState: value.nodeTrust?.trustState,
    peerCertificatePresented: value.peerCertificateTrust?.certificatePresented,
    peerCertificateTrustState: value.peerCertificateTrust?.trustState,
    occurredAt: value.occurredAt,
  });
}

export function toTransportSecurityPolicyDto(value: TransportSecurityPolicy): TransportSecurityPolicyDto {
  return Object.freeze({
    policyId: value.policyId,
    scenario: value.scenario,
    allowedChannelTypes: value.allowedChannelTypes,
    allowedRemotePeerTypes: value.allowedRemotePeerTypes,
    requiredActorType: value.requiredActorType,
    requireAuthenticatedUserSession: value.requireAuthenticatedUserSession,
    requireTrustedDevice: value.requireTrustedDevice,
    requireTrustedNode: value.requireTrustedNode,
    requirePeerCertificateTrust: value.requirePeerCertificateTrust,
    requireMutualTls: value.requireMutualTls,
    allowInsecureFallback: value.allowInsecureFallback,
  });
}

export function toTransportConnectionTrustValidationResultDto(
  value: TransportConnectionTrustValidationResult,
): TransportConnectionTrustValidationResultDto {
  return Object.freeze({
    accepted: value.accepted,
    rejectionReasons: value.rejectionReasons,
    evaluatedAt: value.evaluatedAt,
    policyId: value.policyId,
    scenario: value.scenario,
  });
}


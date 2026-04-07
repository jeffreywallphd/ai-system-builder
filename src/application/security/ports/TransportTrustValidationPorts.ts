import type {
  AuthenticatedTrustState,
  TransportChannelType,
  TransportConnectionActorType,
  TransportConnectionTrustValidationResult,
  TransportPeerType,
  TransportSecurityPolicy,
  TransportSecurityScenario,
} from "@domain/security/TransportSecurityDomain";
import type { TransportSecurityPolicyEvaluationPorts } from "./TransportSecurityPorts";

export const TransportConnectionDirections = Object.freeze({
  inbound: "inbound",
  outbound: "outbound",
});

export type TransportConnectionDirection =
  typeof TransportConnectionDirections[keyof typeof TransportConnectionDirections];

export interface TransportUserSessionTrustEvidence {
  readonly userIdentityId: string;
  readonly loginAuthenticated: boolean;
  readonly trustedDeviceId?: string;
}

export interface TransportNodeTrustEvidence {
  readonly nodeId: string;
}

export interface TransportPeerCertificateEvidence {
  readonly certificatePresented: boolean;
  readonly serialNumber?: string;
}

export interface ResolveTransportTrustedDeviceStateInput {
  readonly trustedDeviceId: string;
  readonly userIdentityId?: string;
  readonly asOf?: string;
}

export interface ResolveTransportTrustedDeviceStateResult {
  readonly trustedDeviceId: string;
  readonly trustState: AuthenticatedTrustState;
  readonly resolution: "resolved" | "not-found" | "error";
  readonly reasonCode?: string;
  readonly checkedAt: string;
}

export interface ResolveTransportNodeStateInput {
  readonly nodeId: string;
  readonly asOf?: string;
}

export interface ResolveTransportNodeStateResult {
  readonly nodeId: string;
  readonly trustState: AuthenticatedTrustState;
  readonly certificateRef?: string;
  readonly resolution: "resolved" | "not-found" | "error";
  readonly reasonCode?: string;
  readonly checkedAt: string;
}

export interface ResolveTransportPeerCertificateStateInput {
  readonly certificatePresented: boolean;
  readonly serialNumber?: string;
  readonly asOf?: string;
}

export interface ResolveTransportPeerCertificateStateResult {
  readonly certificatePresented: boolean;
  readonly serialNumber?: string;
  readonly trustState: AuthenticatedTrustState;
  readonly resolution: "resolved" | "not-presented" | "not-found" | "error";
  readonly reasonCode?: string;
  readonly checkedAt: string;
}

export interface ITransportTrustedDeviceStateResolverPort {
  resolveTrustedDeviceState(
    input: ResolveTransportTrustedDeviceStateInput,
  ): Promise<ResolveTransportTrustedDeviceStateResult>;
}

export interface ITransportNodeStateResolverPort {
  resolveNodeState(
    input: ResolveTransportNodeStateInput,
  ): Promise<ResolveTransportNodeStateResult>;
}

export interface ITransportPeerCertificateStateResolverPort {
  resolvePeerCertificateState(
    input: ResolveTransportPeerCertificateStateInput,
  ): Promise<ResolveTransportPeerCertificateStateResult>;
}

export interface ValidateTransportConnectionTrustRequest {
  readonly connectionId: string;
  readonly direction: TransportConnectionDirection;
  readonly scenario: TransportSecurityScenario;
  readonly channelType: TransportChannelType;
  readonly actorType: TransportConnectionActorType;
  readonly localPeerType: TransportPeerType;
  readonly remotePeerType: TransportPeerType;
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly lanTrustAssumed: boolean;
  readonly userSessionEvidence?: TransportUserSessionTrustEvidence;
  readonly nodeEvidence?: TransportNodeTrustEvidence;
  readonly peerCertificateEvidence?: TransportPeerCertificateEvidence;
  readonly policyOverride?: TransportSecurityPolicy;
  readonly evaluatedAt?: string;
}

export interface TransportTrustValidationFailureReason {
  readonly code: string;
  readonly category: "request" | "policy" | "transport" | "actor" | "device" | "node" | "certificate";
  readonly message: string;
  readonly safeMessage: string;
}

export interface ValidateTransportConnectionTrustResult {
  readonly direction: TransportConnectionDirection;
  readonly policy: TransportSecurityPolicy;
  readonly source: "baseline" | "override";
  readonly trustValidation: TransportConnectionTrustValidationResult;
  readonly failureReasons: ReadonlyArray<TransportTrustValidationFailureReason>;
  readonly resolvedTrustState: {
    readonly userSessionAuthenticated: boolean;
    readonly trustedDevice?: ResolveTransportTrustedDeviceStateResult;
    readonly trustedNode?: ResolveTransportNodeStateResult;
    readonly peerCertificate?: ResolveTransportPeerCertificateStateResult;
  };
}

export interface TransportTrustValidationPorts extends TransportSecurityPolicyEvaluationPorts {
  readonly trustedDeviceStateResolverPort?: ITransportTrustedDeviceStateResolverPort;
  readonly nodeStateResolverPort?: ITransportNodeStateResolverPort;
  readonly peerCertificateStateResolverPort?: ITransportPeerCertificateStateResolverPort;
}



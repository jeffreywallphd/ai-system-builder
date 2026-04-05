export const TransportSecurityScenarios = Object.freeze({
  desktopClientToControlPlane: "desktop-client-to-control-plane",
  thinClientToControlPlane: "thin-client-to-control-plane",
  nodeToControlPlane: "node-to-control-plane",
  serviceToService: "service-to-service",
});

export type TransportSecurityScenario =
  typeof TransportSecurityScenarios[keyof typeof TransportSecurityScenarios];

export const TransportChannelTypes = Object.freeze({
  http: "http",
  https: "https",
  ws: "ws",
  wss: "wss",
  tls: "tls",
});

export type TransportChannelType =
  typeof TransportChannelTypes[keyof typeof TransportChannelTypes];

export const TransportPeerTypes = Object.freeze({
  desktopClient: "desktop-client",
  thinClient: "thin-client",
  authoritativeServer: "authoritative-server",
  nodeRuntime: "node-runtime",
  internalService: "internal-service",
});

export type TransportPeerType =
  typeof TransportPeerTypes[keyof typeof TransportPeerTypes];

export const TransportConnectionActorTypes = Object.freeze({
  userSession: "user-session",
  nodeIdentity: "node-identity",
  serviceIdentity: "service-identity",
});

export type TransportConnectionActorType =
  typeof TransportConnectionActorTypes[keyof typeof TransportConnectionActorTypes];

export const AuthenticatedTrustStates = Object.freeze({
  trusted: "trusted",
  pending: "pending",
  revoked: "revoked",
  unknown: "unknown",
});

export type AuthenticatedTrustState =
  typeof AuthenticatedTrustStates[keyof typeof AuthenticatedTrustStates];

export interface AuthenticatedUserSessionTrust {
  readonly userIdentityId: string;
  readonly loginAuthenticated: boolean;
}

export interface AuthenticatedDeviceTrust {
  readonly trustedDeviceId: string;
  readonly trustState: AuthenticatedTrustState;
}

export interface AuthenticatedNodeTrust {
  readonly nodeId: string;
  readonly trustState: AuthenticatedTrustState;
}

export interface PeerCertificateTrust {
  readonly certificatePresented: boolean;
  readonly trustState: AuthenticatedTrustState;
}

export interface TransportConnectionContext {
  readonly connectionId: string;
  readonly scenario: TransportSecurityScenario;
  readonly channelType: TransportChannelType;
  readonly actorType: TransportConnectionActorType;
  readonly localPeerType: TransportPeerType;
  readonly remotePeerType: TransportPeerType;
  readonly encryptedTransportEstablished: boolean;
  readonly mutualTlsEstablished: boolean;
  readonly lanTrustAssumed: boolean;
  readonly userSessionTrust?: AuthenticatedUserSessionTrust;
  readonly deviceTrust?: AuthenticatedDeviceTrust;
  readonly nodeTrust?: AuthenticatedNodeTrust;
  readonly peerCertificateTrust?: PeerCertificateTrust;
  readonly occurredAt?: string;
}

export interface TransportSecurityPolicy {
  readonly policyId: string;
  readonly scenario: TransportSecurityScenario;
  readonly allowedChannelTypes: ReadonlyArray<TransportChannelType>;
  readonly allowedRemotePeerTypes: ReadonlyArray<TransportPeerType>;
  readonly requiredActorType: TransportConnectionActorType;
  readonly requireAuthenticatedUserSession: boolean;
  readonly requireTrustedDevice: boolean;
  readonly requireTrustedNode: boolean;
  readonly requirePeerCertificateTrust: boolean;
  readonly requireMutualTls: boolean;
  readonly allowInsecureFallback: boolean;
}

export const TransportConnectionRejectionReasons = Object.freeze({
  invalidPolicy: "invalid-policy",
  scenarioMismatch: "scenario-mismatch",
  actorTypeMismatch: "actor-type-mismatch",
  remotePeerTypeNotAllowed: "remote-peer-type-not-allowed",
  insecureFallbackNotAllowed: "insecure-fallback-not-allowed",
  insecureChannelType: "insecure-channel-type",
  transportNotEncrypted: "transport-not-encrypted",
  lanNotTrustedByDefault: "lan-not-trusted-by-default",
  missingAuthenticatedUserSession: "missing-authenticated-user-session",
  trustedDeviceRequired: "trusted-device-required",
  trustedNodeRequired: "trusted-node-required",
  peerCertificateTrustRequired: "peer-certificate-trust-required",
  mutualTlsRequired: "mutual-tls-required",
});

export type TransportConnectionRejectionReason =
  typeof TransportConnectionRejectionReasons[keyof typeof TransportConnectionRejectionReasons];

export interface TransportPolicyValidationResult {
  readonly valid: boolean;
  readonly violations: ReadonlyArray<string>;
}

export interface TransportConnectionTrustValidationResult {
  readonly accepted: boolean;
  readonly rejectionReasons: ReadonlyArray<TransportConnectionRejectionReason>;
  readonly evaluatedAt: string;
  readonly policyId: string;
  readonly scenario: TransportSecurityScenario;
}

const SecureTransportChannelTypeSet = new Set<TransportChannelType>([
  TransportChannelTypes.https,
  TransportChannelTypes.wss,
  TransportChannelTypes.tls,
]);

const TransportSecurityBaselinePolicies: Readonly<Record<TransportSecurityScenario, TransportSecurityPolicy>> = Object.freeze({
  [TransportSecurityScenarios.desktopClientToControlPlane]: Object.freeze({
    policyId: "transport-policy:desktop-control-plane:v1",
    scenario: TransportSecurityScenarios.desktopClientToControlPlane,
    allowedChannelTypes: Object.freeze([
      TransportChannelTypes.https,
      TransportChannelTypes.wss,
    ]),
    allowedRemotePeerTypes: Object.freeze([
      TransportPeerTypes.authoritativeServer,
    ]),
    requiredActorType: TransportConnectionActorTypes.userSession,
    requireAuthenticatedUserSession: true,
    requireTrustedDevice: true,
    requireTrustedNode: false,
    requirePeerCertificateTrust: true,
    requireMutualTls: false,
    allowInsecureFallback: false,
  }),
  [TransportSecurityScenarios.thinClientToControlPlane]: Object.freeze({
    policyId: "transport-policy:thin-client-control-plane:v1",
    scenario: TransportSecurityScenarios.thinClientToControlPlane,
    allowedChannelTypes: Object.freeze([
      TransportChannelTypes.https,
      TransportChannelTypes.wss,
    ]),
    allowedRemotePeerTypes: Object.freeze([
      TransportPeerTypes.authoritativeServer,
    ]),
    requiredActorType: TransportConnectionActorTypes.userSession,
    requireAuthenticatedUserSession: true,
    requireTrustedDevice: false,
    requireTrustedNode: false,
    requirePeerCertificateTrust: true,
    requireMutualTls: false,
    allowInsecureFallback: false,
  }),
  [TransportSecurityScenarios.nodeToControlPlane]: Object.freeze({
    policyId: "transport-policy:node-control-plane:v1",
    scenario: TransportSecurityScenarios.nodeToControlPlane,
    allowedChannelTypes: Object.freeze([
      TransportChannelTypes.https,
      TransportChannelTypes.wss,
      TransportChannelTypes.tls,
    ]),
    allowedRemotePeerTypes: Object.freeze([
      TransportPeerTypes.authoritativeServer,
    ]),
    requiredActorType: TransportConnectionActorTypes.nodeIdentity,
    requireAuthenticatedUserSession: false,
    requireTrustedDevice: false,
    requireTrustedNode: true,
    requirePeerCertificateTrust: true,
    requireMutualTls: true,
    allowInsecureFallback: false,
  }),
  [TransportSecurityScenarios.serviceToService]: Object.freeze({
    policyId: "transport-policy:service-to-service:v1",
    scenario: TransportSecurityScenarios.serviceToService,
    allowedChannelTypes: Object.freeze([
      TransportChannelTypes.https,
      TransportChannelTypes.wss,
      TransportChannelTypes.tls,
    ]),
    allowedRemotePeerTypes: Object.freeze([
      TransportPeerTypes.authoritativeServer,
      TransportPeerTypes.internalService,
    ]),
    requiredActorType: TransportConnectionActorTypes.serviceIdentity,
    requireAuthenticatedUserSession: false,
    requireTrustedDevice: false,
    requireTrustedNode: false,
    requirePeerCertificateTrust: true,
    requireMutualTls: true,
    allowInsecureFallback: false,
  }),
});

export function isSecureTransportChannelType(channelType: TransportChannelType): boolean {
  return SecureTransportChannelTypeSet.has(channelType);
}

export function resolveBaselineTransportSecurityPolicy(
  scenario: TransportSecurityScenario,
): TransportSecurityPolicy {
  return TransportSecurityBaselinePolicies[scenario];
}

export function listBaselineTransportSecurityPolicies(): ReadonlyArray<TransportSecurityPolicy> {
  return Object.freeze(Object.values(TransportSecurityBaselinePolicies));
}

export function validateTransportSecurityPolicy(policy: TransportSecurityPolicy): TransportPolicyValidationResult {
  const violations: string[] = [];

  if (!policy.policyId.trim()) {
    violations.push("Transport policyId is required.");
  }

  if (policy.allowedChannelTypes.length === 0) {
    violations.push("Transport policy must allow at least one channel type.");
  }

  for (const channelType of policy.allowedChannelTypes) {
    if (!isSecureTransportChannelType(channelType)) {
      violations.push(`Transport policy channel '${channelType}' is not secure.`);
    }
  }

  if (policy.allowInsecureFallback) {
    violations.push("Transport policy may not enable insecure fallback.");
  }

  if (policy.allowedRemotePeerTypes.length === 0) {
    violations.push("Transport policy must allow at least one remote peer type.");
  }

  if (policy.requireTrustedNode && policy.requiredActorType !== TransportConnectionActorTypes.nodeIdentity) {
    violations.push("Transport policy requiring trusted node must require node-identity actor type.");
  }

  if (policy.requireAuthenticatedUserSession && policy.requiredActorType !== TransportConnectionActorTypes.userSession) {
    violations.push("Transport policy requiring authenticated user session must require user-session actor type.");
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

export function evaluateTransportConnectionTrust(input: {
  readonly policy: TransportSecurityPolicy;
  readonly context: TransportConnectionContext;
  readonly evaluatedAt?: string;
}): TransportConnectionTrustValidationResult {
  const rejectionReasons: TransportConnectionRejectionReason[] = [];
  const policyValidation = validateTransportSecurityPolicy(input.policy);

  if (!policyValidation.valid) {
    rejectionReasons.push(TransportConnectionRejectionReasons.invalidPolicy);
  }

  if (input.context.scenario !== input.policy.scenario) {
    rejectionReasons.push(TransportConnectionRejectionReasons.scenarioMismatch);
  }

  if (input.context.actorType !== input.policy.requiredActorType) {
    rejectionReasons.push(TransportConnectionRejectionReasons.actorTypeMismatch);
  }

  if (!input.policy.allowedRemotePeerTypes.includes(input.context.remotePeerType)) {
    rejectionReasons.push(TransportConnectionRejectionReasons.remotePeerTypeNotAllowed);
  }

  if (input.context.lanTrustAssumed) {
    rejectionReasons.push(TransportConnectionRejectionReasons.lanNotTrustedByDefault);
  }

  if (input.policy.allowInsecureFallback) {
    rejectionReasons.push(TransportConnectionRejectionReasons.insecureFallbackNotAllowed);
  }

  if (!isSecureTransportChannelType(input.context.channelType)) {
    rejectionReasons.push(TransportConnectionRejectionReasons.insecureChannelType);
  }

  if (!input.policy.allowedChannelTypes.includes(input.context.channelType)) {
    rejectionReasons.push(TransportConnectionRejectionReasons.insecureChannelType);
  }

  if (!input.context.encryptedTransportEstablished) {
    rejectionReasons.push(TransportConnectionRejectionReasons.transportNotEncrypted);
  }

  if (input.policy.requireMutualTls && !input.context.mutualTlsEstablished) {
    rejectionReasons.push(TransportConnectionRejectionReasons.mutualTlsRequired);
  }

  if (
    input.policy.requireAuthenticatedUserSession
    && !input.context.userSessionTrust?.loginAuthenticated
  ) {
    rejectionReasons.push(TransportConnectionRejectionReasons.missingAuthenticatedUserSession);
  }

  if (
    input.policy.requireTrustedDevice
    && input.context.deviceTrust?.trustState !== AuthenticatedTrustStates.trusted
  ) {
    rejectionReasons.push(TransportConnectionRejectionReasons.trustedDeviceRequired);
  }

  if (
    input.policy.requireTrustedNode
    && input.context.nodeTrust?.trustState !== AuthenticatedTrustStates.trusted
  ) {
    rejectionReasons.push(TransportConnectionRejectionReasons.trustedNodeRequired);
  }

  if (
    input.policy.requirePeerCertificateTrust
    && (
      !input.context.peerCertificateTrust?.certificatePresented
      || input.context.peerCertificateTrust.trustState !== AuthenticatedTrustStates.trusted
    )
  ) {
    rejectionReasons.push(TransportConnectionRejectionReasons.peerCertificateTrustRequired);
  }

  return Object.freeze({
    accepted: rejectionReasons.length === 0,
    rejectionReasons: Object.freeze([...new Set(rejectionReasons)]),
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    policyId: input.policy.policyId,
    scenario: input.policy.scenario,
  });
}

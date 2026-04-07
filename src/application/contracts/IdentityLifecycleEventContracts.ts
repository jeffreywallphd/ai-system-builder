import type { SessionRevocationReason } from "../../domain/identity/IdentityDomain";

export const IdentityLifecycleEventTypes = Object.freeze({
  localAccountRegistered: "identity.local-account.registered",
  localAccountLoginSucceeded: "identity.local-account.login-succeeded",
  localAccountLoginFailed: "identity.local-account.login-failed",
  localCredentialChanged: "identity.local-account.credential-changed",
  localAccountDisabled: "identity.local-account.disabled",
  sessionCreated: "identity.session.created",
  sessionLoggedOut: "identity.session.logged-out",
  sessionTrustInvalidated: "identity.session.trust-invalidated",
  trustedDevicePairingInitiated: "identity.trusted-device.pairing-initiated",
  trustedDevicePairingCompleted: "identity.trusted-device.pairing-completed",
  trustedDevicePairingFailed: "identity.trusted-device.pairing-failed",
  trustedDeviceRevoked: "identity.trusted-device.revoked",
  trustedDeviceTrustStatusChanged: "identity.trusted-device.trust-status-changed",
});

export type IdentityLifecycleEventType =
  typeof IdentityLifecycleEventTypes[keyof typeof IdentityLifecycleEventTypes];

export const IdentityLifecycleEventContractVersions = Object.freeze({
  v1: "1.0",
});

export type IdentityLifecycleEventContractVersion =
  typeof IdentityLifecycleEventContractVersions[keyof typeof IdentityLifecycleEventContractVersions];

interface IdentityLifecycleEventEnvelope<
  TType extends IdentityLifecycleEventType,
  TPayload,
> {
  readonly eventType: TType;
  readonly contractVersion: IdentityLifecycleEventContractVersion;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export type LocalAccountRegisteredIdentityLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.localAccountRegistered,
    {
      readonly userIdentityId: string;
      readonly providerId: string;
      readonly providerSubject: string;
      readonly credentialPolicyId: string;
      readonly credentialMaterialId: string;
      readonly registeredAt: string;
    }
  >;

export type LocalAccountLoginSucceededIdentityLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.localAccountLoginSucceeded,
    {
      readonly userIdentityId: string;
      readonly providerId: string;
      readonly providerSubject: string;
      readonly credentialMaterialId: string;
      readonly authenticatedAt: string;
      readonly authPath: string;
    }
  >;

export type LocalAccountLoginFailedIdentityLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.localAccountLoginFailed,
    {
      readonly providerId: string;
      readonly providerSubject: string;
      readonly errorCode: string;
      readonly attemptedAt: string;
    }
  >;

export type LocalCredentialChangedIdentityLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.localCredentialChanged,
    {
      readonly userIdentityId: string;
      readonly providerId: string;
      readonly providerSubject: string;
      readonly credentialPolicyId: string;
      readonly supersededCredentialMaterialId: string;
      readonly credentialMaterialId: string;
      readonly changedAt: string;
      readonly verificationMode: string;
    }
  >;

export type LocalAccountDisabledIdentityLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.localAccountDisabled,
    {
      readonly userIdentityId: string;
      readonly actorUserIdentityId: string;
      readonly providerId: string;
      readonly status: string;
      readonly affectedSessionIds: ReadonlyArray<string>;
      readonly disabledAt: string;
    }
  >;

export type IdentitySessionCreatedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.sessionCreated,
    {
      readonly sessionId: string;
      readonly userIdentityId: string;
      readonly providerId: string;
      readonly providerSubject: string;
      readonly accessChannel?: string;
      readonly issuedAt: string;
      readonly expiresAt: string;
    }
  >;

export type IdentitySessionLoggedOutLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.sessionLoggedOut,
    {
      readonly sessionId: string;
      readonly userIdentityId: string;
      readonly revocationReason: SessionRevocationReason;
      readonly revokedAt: string;
    }
  >;

export type IdentitySessionTrustInvalidatedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.sessionTrustInvalidated,
    {
      readonly sessionId: string;
      readonly userIdentityId: string;
      readonly trustedDeviceId?: string;
      readonly revocationReason: SessionRevocationReason;
      readonly invalidationReasons?: ReadonlyArray<
        "trusted-device-revoked"
        | "trusted-device-trust-lost"
        | "trusted-device-expired"
        | "trusted-device-mismatch"
      >;
      readonly invalidatedAt: string;
      readonly reason?: string;
    }
  >;

export type TrustedDevicePairingInitiatedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.trustedDevicePairingInitiated,
    {
      readonly pairingSessionId: string;
      readonly pairingTokenId: string;
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
      readonly actorScope: "same-user" | "workspace-admin" | "bootstrap-admin" | "session-bound";
      readonly artifactType: "one-time-code" | "qr-payload";
      readonly issuedAt: string;
      readonly expiresAt: string;
      readonly issuedByUserIdentityId?: string;
    }
  >;

export type TrustedDevicePairingCompletedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.trustedDevicePairingCompleted,
    {
      readonly pairingSessionId: string;
      readonly pairingTokenId: string;
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
      readonly completedAt: string;
      readonly completedByUserIdentityId?: string;
      readonly trustMaterialKind?: "session-signing-key" | "attestation-key" | "opaque-marker";
    }
  >;

export type TrustedDevicePairingFailedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.trustedDevicePairingFailed,
    {
      readonly pairingSessionId: string;
      readonly pairingTokenId: string;
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
      readonly failureReason: "expired" | "invalid-token";
      readonly occurredAt: string;
      readonly actorUserIdentityId?: string;
    }
  >;

export type TrustedDeviceRevokedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.trustedDeviceRevoked,
    {
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
      readonly revokedByUserIdentityId?: string;
      readonly revocationReason: "user-request" | "admin-action" | "lost-device" | "suspected-compromise" | "workspace-access-removed" | "policy-violation";
      readonly revokedAt: string;
    }
  >;

export type TrustedDeviceTrustStatusChangedLifecycleEvent =
  IdentityLifecycleEventEnvelope<
    typeof IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged,
    {
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
      readonly previousStatus: "pending-pairing" | "trusted" | "revoked" | "expired";
      readonly nextStatus: "pending-pairing" | "trusted" | "revoked" | "expired";
      readonly changedAt: string;
      readonly changedByUserIdentityId?: string;
      readonly reason?: "pairing-completed" | "device-revoked";
    }
  >;

export type IdentityLifecycleEvent =
  | LocalAccountRegisteredIdentityLifecycleEvent
  | LocalAccountLoginSucceededIdentityLifecycleEvent
  | LocalAccountLoginFailedIdentityLifecycleEvent
  | LocalCredentialChangedIdentityLifecycleEvent
  | LocalAccountDisabledIdentityLifecycleEvent
  | IdentitySessionCreatedLifecycleEvent
  | IdentitySessionLoggedOutLifecycleEvent
  | IdentitySessionTrustInvalidatedLifecycleEvent
  | TrustedDevicePairingInitiatedLifecycleEvent
  | TrustedDevicePairingCompletedLifecycleEvent
  | TrustedDevicePairingFailedLifecycleEvent
  | TrustedDeviceRevokedLifecycleEvent
  | TrustedDeviceTrustStatusChangedLifecycleEvent;

export function createIdentityLifecycleEvent<TEvent extends IdentityLifecycleEvent>(event: TEvent): TEvent {
  return Object.freeze({
    ...event,
    payload: Object.freeze({ ...event.payload }),
  });
}

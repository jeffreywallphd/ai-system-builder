import type { SessionRevocationReason } from "../../src/domain/identity/IdentityDomain";

export const IdentityLifecycleEventTypes = Object.freeze({
  localAccountRegistered: "identity.local-account.registered",
  localAccountLoginSucceeded: "identity.local-account.login-succeeded",
  localAccountLoginFailed: "identity.local-account.login-failed",
  localCredentialChanged: "identity.local-account.credential-changed",
  localAccountDisabled: "identity.local-account.disabled",
  sessionCreated: "identity.session.created",
  sessionLoggedOut: "identity.session.logged-out",
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

export type IdentityLifecycleEvent =
  | LocalAccountRegisteredIdentityLifecycleEvent
  | LocalAccountLoginSucceededIdentityLifecycleEvent
  | LocalAccountLoginFailedIdentityLifecycleEvent
  | LocalCredentialChangedIdentityLifecycleEvent
  | LocalAccountDisabledIdentityLifecycleEvent
  | IdentitySessionCreatedLifecycleEvent
  | IdentitySessionLoggedOutLifecycleEvent;

export function createIdentityLifecycleEvent<TEvent extends IdentityLifecycleEvent>(event: TEvent): TEvent {
  return Object.freeze({
    ...event,
    payload: Object.freeze({ ...event.payload }),
  });
}

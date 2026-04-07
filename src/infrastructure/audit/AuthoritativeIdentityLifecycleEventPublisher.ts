import {
  IdentityLifecycleEventTypes,
  type IdentityLifecycleEvent,
} from "@application/contracts/IdentityLifecycleEventContracts";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type { IIdentityLifecycleEventPublisher } from "@application/identity/ports/IIdentityLifecycleEventPublisher";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

type IdentityLifecyclePayload = Record<string, unknown>;

const IdentityLifecycleActionByType = Object.freeze({
  [IdentityLifecycleEventTypes.localAccountRegistered]: "identity.local-account.registered",
  [IdentityLifecycleEventTypes.localAccountLoginSucceeded]: "auth.local-account.login.succeeded",
  [IdentityLifecycleEventTypes.localAccountLoginFailed]: "auth.local-account.login.failed",
  [IdentityLifecycleEventTypes.localCredentialChanged]: "identity.local-account.credential.changed",
  [IdentityLifecycleEventTypes.localAccountDisabled]: "identity.local-account.disabled",
  [IdentityLifecycleEventTypes.sessionCreated]: "auth.session.created",
  [IdentityLifecycleEventTypes.sessionLoggedOut]: "auth.session.logged-out",
  [IdentityLifecycleEventTypes.sessionTrustInvalidated]: "security.session.trust-invalidated",
  [IdentityLifecycleEventTypes.trustedDevicePairingInitiated]: "security.trusted-device.pairing.initiated",
  [IdentityLifecycleEventTypes.trustedDevicePairingCompleted]: "security.trusted-device.pairing.completed",
  [IdentityLifecycleEventTypes.trustedDevicePairingFailed]: "security.trusted-device.pairing.failed",
  [IdentityLifecycleEventTypes.trustedDeviceRevoked]: "security.trusted-device.revoked",
  [IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged]: "security.trusted-device.trust-status.changed",
} as const satisfies Record<IdentityLifecycleEvent["eventType"], string>);

export class AuthoritativeIdentityLifecycleEventPublisher implements IIdentityLifecycleEventPublisher {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async publish(event: IdentityLifecycleEvent): Promise<void> {
    const payload = event.payload as IdentityLifecyclePayload;
    const actorUserIdentityId = firstDefinedString(
      payload.actorUserIdentityId,
      payload.issuedByUserIdentityId,
      payload.completedByUserIdentityId,
      payload.revokedByUserIdentityId,
      payload.changedByUserIdentityId,
      payload.userIdentityId,
    );
    const actor = actorUserIdentityId
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
        actorSessionId: toOptionalString(payload.sessionId),
      })
      : Object.freeze({
        actorId: "service:identity-lifecycle",
        actorKind: AuditActorKinds.service,
        actorServiceId: "service:identity-lifecycle",
        actorSessionId: toOptionalString(payload.sessionId),
      });
    const workspaceId = toOptionalString(payload.workspaceId);
    const trustedDeviceId = toOptionalString(payload.trustedDeviceId);
    const sessionId = toOptionalString(payload.sessionId);
    const userIdentityId = toOptionalString(payload.userIdentityId);
    const operationDiscriminator = firstDefinedString(
      sessionId,
      trustedDeviceId,
      userIdentityId,
      toOptionalString(payload.providerId),
      event.eventType,
    );

    await this.recorder.recordIdentityEvent({
      operationKey: `identity:lifecycle:${event.eventType}:${operationDiscriminator ?? "event"}`,
      eventType: event.eventType,
      action: IdentityLifecycleActionByType[event.eventType],
      outcome: resolveIdentityOutcome(event),
      occurredAt: event.occurredAt,
      actor,
      scope: workspaceId
        ? Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId,
        })
        : Object.freeze({
          kind: AuditScopeKinds.global,
        }),
      protectedResource: resolveIdentityProtectedResource(event.eventType, payload, workspaceId),
      actionContext: {
        sessionId,
        deviceId: trustedDeviceId,
      },
      payload: mapIdentityPayload(event.eventType, payload),
    });
  }
}

function resolveIdentityOutcome(event: IdentityLifecycleEvent): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  switch (event.eventType) {
    case IdentityLifecycleEventTypes.localAccountLoginFailed:
      return AuditEventOutcomes.denied;
    case IdentityLifecycleEventTypes.trustedDevicePairingFailed:
      return AuditEventOutcomes.failed;
    case IdentityLifecycleEventTypes.sessionTrustInvalidated:
      return AuditEventOutcomes.rejected;
    default:
      return AuditEventOutcomes.succeeded;
  }
}

function resolveIdentityProtectedResource(
  eventType: IdentityLifecycleEvent["eventType"],
  payload: IdentityLifecyclePayload,
  workspaceId: string | undefined,
): {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly sensitivityClass: "standard" | "sensitive" | "protected";
  readonly workspaceId?: string;
} | undefined {
  const trustedDeviceId = toOptionalString(payload.trustedDeviceId);
  if (trustedDeviceId) {
    const canonicalId = stripTypedPrefix(trustedDeviceId, "trusted-device");
    return Object.freeze({
      resourceType: "trusted-device",
      resourceId: canonicalId,
      resourceRef: `trusted-device:${canonicalId}`,
      sensitivityClass: "sensitive",
      workspaceId,
    });
  }

  const sessionId = toOptionalString(payload.sessionId);
  if (sessionId) {
    const canonicalId = stripTypedPrefix(sessionId, "session");
    return Object.freeze({
      resourceType: "identity-session",
      resourceId: canonicalId,
      resourceRef: `identity-session:${canonicalId}`,
      sensitivityClass: "sensitive",
      workspaceId,
    });
  }

  if (
    eventType === IdentityLifecycleEventTypes.localAccountRegistered
    || eventType === IdentityLifecycleEventTypes.localAccountDisabled
    || eventType === IdentityLifecycleEventTypes.localCredentialChanged
  ) {
    const userIdentityId = toOptionalString(payload.userIdentityId);
    if (userIdentityId) {
      const canonicalId = stripTypedPrefix(userIdentityId, "user");
      return Object.freeze({
        resourceType: "identity-account",
        resourceId: canonicalId,
        resourceRef: `identity-account:${canonicalId}`,
        sensitivityClass: "sensitive",
        workspaceId,
      });
    }
  }

  return undefined;
}

function mapIdentityPayload(
  eventType: IdentityLifecycleEvent["eventType"],
  payload: IdentityLifecyclePayload,
): {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
} {
  if (eventType === IdentityLifecycleEventTypes.localAccountLoginSucceeded) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        providerId: payload.providerId,
        authenticatedAt: payload.authenticatedAt,
        authPath: payload.authPath,
      }),
      adminOnlyDetails: Object.freeze({
        providerSubject: payload.providerSubject,
        credentialMaterialId: payload.credentialMaterialId,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.localAccountLoginFailed) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        providerId: payload.providerId,
        errorCode: payload.errorCode,
        attemptedAt: payload.attemptedAt,
      }),
      adminOnlyDetails: Object.freeze({
        providerSubject: payload.providerSubject,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.sessionCreated) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        accessChannel: payload.accessChannel,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      }),
      adminOnlyDetails: Object.freeze({
        sessionId: payload.sessionId,
        providerId: payload.providerId,
        providerSubject: payload.providerSubject,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.sessionLoggedOut) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        revocationReason: payload.revocationReason,
        revokedAt: payload.revokedAt,
      }),
      adminOnlyDetails: Object.freeze({
        sessionId: payload.sessionId,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.sessionTrustInvalidated) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        revocationReason: payload.revocationReason,
        invalidationReasons: payload.invalidationReasons,
        invalidatedAt: payload.invalidatedAt,
        reason: payload.reason,
      }),
      adminOnlyDetails: Object.freeze({
        sessionId: payload.sessionId,
        trustedDeviceId: payload.trustedDeviceId,
      }),
    });
  }

  if (
    eventType === IdentityLifecycleEventTypes.trustedDevicePairingInitiated
    || eventType === IdentityLifecycleEventTypes.trustedDevicePairingCompleted
    || eventType === IdentityLifecycleEventTypes.trustedDevicePairingFailed
    || eventType === IdentityLifecycleEventTypes.trustedDeviceRevoked
    || eventType === IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged
  ) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        trustedDeviceId: payload.trustedDeviceId,
        userIdentityId: payload.userIdentityId,
        workspaceId: payload.workspaceId,
        actorScope: payload.actorScope,
        revocationReason: payload.revocationReason,
        previousStatus: payload.previousStatus,
        nextStatus: payload.nextStatus,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        completedAt: payload.completedAt,
        changedAt: payload.changedAt,
        occurredAt: payload.occurredAt,
      }),
      adminOnlyDetails: Object.freeze({
        pairingSessionId: payload.pairingSessionId,
        pairingTokenId: payload.pairingTokenId,
        failureReason: payload.failureReason,
        trustMaterialKind: payload.trustMaterialKind,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.localAccountRegistered) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        providerId: payload.providerId,
        registeredAt: payload.registeredAt,
      }),
      adminOnlyDetails: Object.freeze({
        providerSubject: payload.providerSubject,
        credentialPolicyId: payload.credentialPolicyId,
        credentialMaterialId: payload.credentialMaterialId,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.localCredentialChanged) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        providerId: payload.providerId,
        changedAt: payload.changedAt,
        verificationMode: payload.verificationMode,
      }),
      adminOnlyDetails: Object.freeze({
        providerSubject: payload.providerSubject,
        credentialPolicyId: payload.credentialPolicyId,
        supersededCredentialMaterialId: payload.supersededCredentialMaterialId,
        credentialMaterialId: payload.credentialMaterialId,
      }),
    });
  }

  if (eventType === IdentityLifecycleEventTypes.localAccountDisabled) {
    return Object.freeze({
      userSafeDetails: Object.freeze({
        userIdentityId: payload.userIdentityId,
        actorUserIdentityId: payload.actorUserIdentityId,
        providerId: payload.providerId,
        status: payload.status,
        disabledAt: payload.disabledAt,
      }),
      adminOnlyDetails: Object.freeze({
        affectedSessionIds: payload.affectedSessionIds,
      }),
    });
  }

  return Object.freeze({
    adminOnlyDetails: Object.freeze({ ...payload }),
  });
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function firstDefinedString(...values: ReadonlyArray<unknown>): string | undefined {
  for (const value of values) {
    const normalized = toOptionalString(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function stripTypedPrefix(value: string, prefix: string): string {
  return value.startsWith(`${prefix}:`)
    ? value.slice(prefix.length + 1)
    : value;
}

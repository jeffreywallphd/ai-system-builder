import type {
  CompleteTrustedDevicePairingApiResponse,
  ChangeLocalPasswordCredentialApiResponse,
  GetIdentityAdminAccountStatusApiResponse,
  InitiateTrustedDevicePairingApiResponse,
  ListIdentityAdminAccountsApiResponse,
  ListTrustedDevicesApiResponse,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  RevokeIdentitySessionApiResponse,
  SetIdentityAdminAccountStatusApiResponse,
  TrustedDevicePairingSessionApiResponse,
  TrustedDevicePairingTokenApiResponse,
  TrustedDeviceSummaryApiResponse,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiResponse,
} from "./sdk/PublicIdentityAuthApiContract";
import type { ChangeLocalPasswordCredentialResult } from "../../../src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import type { LocalIdentityAccountSummary } from "../../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import type { SetLocalIdentityAccountStatusResult } from "../../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import type { IssueAuthenticatedSessionResult } from "../../../application/identity/services/IdentityAuthenticatedSessionService";
import type { LoginLocalAccountResult } from "../../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import type { SessionDeviceTrustContext } from "../../../src/domain/identity/IdentityDomain";
import type {
  TrustedDevicePairingCompletionResponse,
  TrustedDevicePairingInitiationResponse,
  TrustedDevicePairingValidationResponse,
  TrustedDeviceRecord,
} from "../../../application/contracts/IdentityApplicationContracts";

export function serializeRegisterLocalIdentityResponse(value: RegisterLocalIdentityApiResponse): RegisterLocalIdentityApiResponse {
  return Object.freeze({
    userIdentityId: value.userIdentityId,
    providerId: value.providerId,
    providerSubject: value.providerSubject,
    registeredAt: value.registeredAt,
  });
}

export function serializeLoginLocalIdentityResponse(
  principal: LoginLocalAccountResult,
  session: IssueAuthenticatedSessionResult,
): LoginLocalIdentityApiResponse {
  return Object.freeze({
    userIdentityId: principal.userIdentityId,
    username: principal.username,
    email: principal.email,
    displayName: principal.displayName,
    providerId: principal.providerId,
    providerSubject: principal.providerSubject,
    authPath: principal.authPath,
    authenticatedAt: principal.authenticatedAt,
    sessionId: session.session.id,
    sessionToken: session.token,
    sessionTokenType: session.tokenType,
    sessionIssuedAt: session.session.issuedAt,
    sessionExpiresAt: session.session.expiresAt,
    sessionAccessChannel: session.session.client?.accessChannel,
    sessionDeviceId: session.session.client?.deviceId,
    sessionDeviceTrustContext: serializeSessionDeviceTrustContext(
      mapDomainSessionDeviceTrustContext(session.session.client?.deviceTrust),
    ),
    sessionTrustedDeviceBindingId: session.session.client?.trustedDeviceBindingId,
    sessionTrustMarker: session.session.client?.trustMarker,
  });
}

export function serializeResolveAuthenticatedSessionResponse(
  value: ResolveAuthenticatedSessionApiResponse,
): ResolveAuthenticatedSessionApiResponse {
  return Object.freeze({
    principal: Object.freeze({
      userIdentityId: value.principal.userIdentityId,
      username: value.principal.username,
      email: value.principal.email,
      displayName: value.principal.displayName,
    }),
    session: Object.freeze({
      sessionId: value.session.sessionId,
      providerId: value.session.providerId,
      providerSubject: value.session.providerSubject,
      accessChannel: value.session.accessChannel,
      deviceId: value.session.deviceId,
      deviceTrustContext: serializeSessionDeviceTrustContext(value.session.deviceTrustContext),
      trustedDeviceBindingId: value.session.trustedDeviceBindingId,
      trustMarker: value.session.trustMarker,
      issuedAt: value.session.issuedAt,
      expiresAt: value.session.expiresAt,
    }),
  });
}

export function serializeLogoutAuthenticatedSessionResponse(
  value: LogoutAuthenticatedSessionApiResponse,
): LogoutAuthenticatedSessionApiResponse {
  return Object.freeze({
    sessionId: value.sessionId,
    userIdentityId: value.userIdentityId,
    revokedAt: value.revokedAt,
    revocationReason: value.revocationReason,
  });
}

export function serializeRevokeIdentitySessionResponse(
  value: RevokeIdentitySessionApiResponse,
): RevokeIdentitySessionApiResponse {
  return Object.freeze({
    sessionId: value.sessionId,
    userIdentityId: value.userIdentityId,
    revokedAt: value.revokedAt,
    revocationReason: value.revocationReason,
  });
}

export function serializeChangeLocalPasswordCredentialResponse(
  value: ChangeLocalPasswordCredentialResult,
): ChangeLocalPasswordCredentialApiResponse {
  return Object.freeze({
    userIdentityId: value.userIdentityId,
    providerId: value.providerId,
    providerSubject: value.providerSubject,
    credentialPolicyId: value.credentialPolicyId,
    supersededCredentialMaterialId: value.supersededCredentialMaterialId,
    credentialMaterialId: value.credentialMaterialId,
    changedAt: value.changedAt,
    verificationMode: value.verificationMode,
  });
}

export function serializeListIdentityAdminAccountsResponse(
  value: ListIdentityAdminAccountsApiResponse,
): ListIdentityAdminAccountsApiResponse {
  return Object.freeze({
    accounts: Object.freeze(value.accounts.map((account) => serializeLocalIdentityAccountSummary(account))),
  });
}

export function serializeGetIdentityAdminAccountStatusResponse(
  value: GetIdentityAdminAccountStatusApiResponse,
): GetIdentityAdminAccountStatusApiResponse {
  return Object.freeze({
    account: serializeLocalIdentityAccountSummary(value.account),
  });
}

export function serializeSetIdentityAdminAccountStatusResponse(
  value: SetLocalIdentityAccountStatusResult,
): SetIdentityAdminAccountStatusApiResponse {
  return Object.freeze({
    userIdentityId: value.userIdentityId,
    status: value.status,
    changed: value.changed,
    affectedSessionIds: Object.freeze([...value.affectedSessionIds]),
    updatedAt: value.updatedAt,
  });
}

export function serializeListTrustedDevicesResponse(
  value: ReadonlyArray<TrustedDeviceRecord>,
): ListTrustedDevicesApiResponse {
  return Object.freeze({
    devices: Object.freeze(value.map((device) => serializeTrustedDeviceSummary(device))),
  });
}

export function serializeTrustedDeviceResponse(
  value: TrustedDeviceRecord,
): TrustedDeviceSummaryApiResponse {
  return serializeTrustedDeviceSummary(value);
}

export function serializeUpdateTrustedDeviceDisplayNameResponse(
  value: TrustedDeviceRecord,
): UpdateTrustedDeviceDisplayNameApiResponse {
  return Object.freeze({
    trustedDevice: serializeTrustedDeviceSummary(value),
  });
}

export function serializeInitiateTrustedDevicePairingResponse(
  value: TrustedDevicePairingInitiationResponse,
): InitiateTrustedDevicePairingApiResponse {
  return Object.freeze({
    pairingSession: serializeTrustedDevicePairingSession(value.pairingSession),
    pairingToken: serializeTrustedDevicePairingToken(value.pairingToken),
    artifact: Object.freeze({
      type: value.artifact.type,
      value: value.artifact.value,
      redactedHint: value.artifact.redactedHint,
    }),
  });
}

export function serializeValidateTrustedDevicePairingResponse(
  value: TrustedDevicePairingValidationResponse,
): ValidateTrustedDevicePairingApiResponse {
  return Object.freeze({
    outcome: value.outcome,
    attemptsRemaining: value.attemptsRemaining,
    pairingSession: serializeTrustedDevicePairingSession(value.pairingSession),
    pairingToken: serializeTrustedDevicePairingToken(value.pairingToken),
  });
}

export function serializeCompleteTrustedDevicePairingResponse(
  value: TrustedDevicePairingCompletionResponse,
): CompleteTrustedDevicePairingApiResponse {
  return Object.freeze({
    pairingSession: serializeTrustedDevicePairingSession(value.pairingSession),
    pairingToken: serializeTrustedDevicePairingToken(value.pairingToken),
    trustedDevice: serializeTrustedDeviceSummary(value.trustedDevice),
  });
}

function serializeLocalIdentityAccountSummary(account: LocalIdentityAccountSummary): LocalIdentityAccountSummary {
  return Object.freeze({
    userIdentityId: account.userIdentityId,
    username: account.username,
    email: account.email,
    displayName: account.displayName,
    accountStatus: account.accountStatus,
    providerId: account.providerId,
    providerSubject: account.providerSubject,
    credentialStatus: account.credentialStatus,
    credentialDisabledAt: account.credentialDisabledAt,
    linkedAt: account.linkedAt,
    lastAuthenticatedAt: account.lastAuthenticatedAt,
    activeSessionCount: account.activeSessionCount,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
}

function serializeTrustedDeviceSummary(device: TrustedDeviceRecord): TrustedDeviceSummaryApiResponse {
  return Object.freeze({
    trustedDeviceId: device.id,
    userIdentityId: device.userIdentityId,
    workspaceId: device.workspaceId,
    displayName: device.displayName.value,
    pairingMethod: device.pairingMethod,
    trustStatus: device.trustStatus,
    registeredAt: device.registeredAt,
    pairedAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt,
    metadata: Object.freeze({
      platform: device.metadata.platform,
      osVersion: device.metadata.osVersion,
      appVersion: device.metadata.appVersion,
      deviceModel: device.metadata.deviceModel,
      locale: device.metadata.locale,
    }),
    revocation: device.revocation
      ? Object.freeze({
          reason: device.revocation.reason,
          revokedAt: device.revocation.revokedAt,
          revokedByUserIdentityId: device.revocation.revokedByUserIdentityId,
          note: device.revocation.note,
        })
      : undefined,
    updatedAt: device.updatedAt,
  });
}

function serializeTrustedDevicePairingSession(
  value: TrustedDevicePairingCompletionResponse["pairingSession"]
    | TrustedDevicePairingInitiationResponse["pairingSession"]
    | TrustedDevicePairingValidationResponse["pairingSession"],
): TrustedDevicePairingSessionApiResponse {
  return Object.freeze({
    pairingSessionId: value.id,
    trustedDeviceId: value.trustedDeviceId,
    status: value.status,
    initiatedAt: value.initiatedAt,
    validatedAt: value.validatedAt,
    completedAt: value.completedAt,
    completedByUserIdentityId: value.completedByUserIdentityId,
    rejectedAt: value.rejectedAt,
    rejectionReason: value.rejectionReason,
    rejectionNote: value.rejectionNote,
    invalidatedAt: value.invalidatedAt,
    expiredAt: value.expiredAt,
    updatedAt: value.updatedAt,
  });
}

function serializeTrustedDevicePairingToken(
  value: TrustedDevicePairingCompletionResponse["pairingToken"]
    | TrustedDevicePairingInitiationResponse["pairingToken"]
    | TrustedDevicePairingValidationResponse["pairingToken"],
): TrustedDevicePairingTokenApiResponse {
  return Object.freeze({
    pairingTokenId: value.id,
    pairingSessionId: value.pairingSessionId,
    trustedDeviceId: value.trustedDeviceId,
    status: value.status,
    artifactType: value.artifactType,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    failedValidationAttempts: value.failedValidationAttempts,
    maxValidationAttempts: value.maxValidationAttempts,
    lastValidationAttemptAt: value.lastValidationAttemptAt,
    consumedAt: value.consumedAt,
    consumedByUserIdentityId: value.consumedByUserIdentityId,
    invalidationReason: value.invalidationReason,
    invalidatedAt: value.invalidatedAt,
    invalidatedByUserIdentityId: value.invalidatedByUserIdentityId,
    invalidationNote: value.invalidationNote,
    updatedAt: value.updatedAt,
  });
}

function serializeSessionDeviceTrustContext(
  value: ResolveAuthenticatedSessionApiResponse["session"]["deviceTrustContext"]
    | LoginLocalIdentityApiResponse["sessionDeviceTrustContext"],
) {
  if (!value) {
    return undefined;
  }

  return Object.freeze({
    trustedDeviceId: value.trustedDeviceId,
    issuedOnTrustedDevice: value.issuedOnTrustedDevice,
    sessionAssuranceLevel: value.sessionAssuranceLevel,
    trustStateSnapshot: value.trustStateSnapshot
      ? Object.freeze({
          state: value.trustStateSnapshot.state,
          evaluatedAt: value.trustStateSnapshot.evaluatedAt,
        })
      : undefined,
    invalidationReasons: value.invalidationReasons ? Object.freeze([...value.invalidationReasons]) : undefined,
    trustedDeviceBindingId: value.trustedDeviceBindingId,
    trustMarker: value.trustMarker,
  });
}

function mapDomainSessionDeviceTrustContext(
  value?: SessionDeviceTrustContext,
): ResolveAuthenticatedSessionApiResponse["session"]["deviceTrustContext"] | undefined {
  if (!value) {
    return undefined;
  }

  return Object.freeze({
    trustedDeviceId: value.trustedDeviceId,
    issuedOnTrustedDevice: value.issuedOnTrustedDevice,
    sessionAssuranceLevel: value.sessionAssuranceLevel,
    trustStateSnapshot: value.snapshot
      ? Object.freeze({
          state: value.snapshot.state,
          evaluatedAt: value.snapshot.evaluatedAt,
        })
      : undefined,
    invalidationReasons: value.invalidationReasons ? Object.freeze([...value.invalidationReasons]) : undefined,
    trustedDeviceBindingId: value.trustedDeviceBindingId,
    trustMarker: value.trustMarker,
  });
}

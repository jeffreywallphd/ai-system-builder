import type {
  ChangeLocalPasswordCredentialApiResponse,
  GetIdentityAdminAccountStatusApiResponse,
  ListIdentityAdminAccountsApiResponse,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  RevokeIdentitySessionApiResponse,
  SetIdentityAdminAccountStatusApiResponse,
} from "./sdk/PublicIdentityAuthApiContract";
import type { ChangeLocalPasswordCredentialResult } from "../../../src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import type { LocalIdentityAccountSummary } from "../../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import type { SetLocalIdentityAccountStatusResult } from "../../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import type { IssueAuthenticatedSessionResult } from "../../../application/identity/services/IdentityAuthenticatedSessionService";
import type { LoginLocalAccountResult } from "../../../src/application/identity/use-cases/LoginLocalAccountUseCase";

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

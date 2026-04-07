import type {
  ChangeLocalPasswordCredentialApiRequest,
  ChangeLocalPasswordCredentialApiResponse,
  CompleteTrustedDevicePairingApiRequest,
  CompleteTrustedDevicePairingApiResponse,
  GetIdentityAdminAccountStatusApiRequest,
  GetIdentityAdminAccountStatusApiResponse,
  GetTrustedDeviceApiRequest,
  GetTrustedDeviceApiResponse,
  IdentityAuthApiResponse,
  InitiateTrustedDevicePairingApiRequest,
  InitiateTrustedDevicePairingApiResponse,
  ListIdentityAdminAccountsApiRequest,
  ListIdentityAdminAccountsApiResponse,
  ListIdentityAdminTrustedDevicesApiRequest,
  ListIdentityAdminTrustedDevicesApiResponse,
  ListIdentityAdminSessionsApiRequest,
  ListIdentityAdminSessionsApiResponse,
  ListIdentitySessionsApiRequest,
  ListIdentitySessionsApiResponse,
  ListTrustedDevicesApiRequest,
  ListTrustedDevicesApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
  RevokeIdentityAdminSessionApiRequest,
  RevokeIdentityAdminSessionApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
  UpdateTrustedDeviceDisplayNameApiRequest,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiRequest,
  ValidateTrustedDevicePairingApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
export type * from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
export {
  ChangeLocalPasswordCredentialVerificationModes,
  IdentityAuthApiErrorCodes,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import type {
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceStatus,
} from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";

export const IdentityTransportRoutes = Object.freeze({
  register: "/api/v1/identity/register",
  login: "/api/v1/identity/login",
  resolveSession: "/api/v1/identity/session",
  listSessions: "/api/v1/identity/sessions",
  resolveSessionActorContext: "/api/v1/identity/session/context",
  logout: "/api/v1/identity/logout",
  revokeSession: "/api/v1/identity/session/revoke",
  listAdminAccounts: "/api/v1/identity/admin/accounts",
  getAdminAccountStatus: "/api/v1/identity/admin/accounts/:userIdentityId",
  setAdminAccountStatus: "/api/v1/identity/admin/accounts/:userIdentityId/status",
  listAdminSessions: "/api/v1/identity/admin/sessions",
  revokeAdminSession: "/api/v1/identity/admin/sessions/:sessionId/revoke",
  listAdminTrustedDevices: "/api/v1/identity/admin/trusted-devices",
  revokeAdminTrustedDevice: "/api/v1/identity/admin/trusted-devices/:trustedDeviceId/revoke",
  changeCredential: "/api/v1/identity/credential/change",
  listTrustedDevices: "/api/v1/identity/trusted-devices",
  getTrustedDevice: "/api/v1/identity/trusted-devices/:trustedDeviceId",
  revokeTrustedDevice: "/api/v1/identity/trusted-devices/:trustedDeviceId/revoke",
  updateTrustedDeviceDisplayName: "/api/v1/identity/trusted-devices/:trustedDeviceId/display-name",
  initiateTrustedDevicePairing: "/api/v1/identity/trusted-devices/pairing/initiate",
  validateTrustedDevicePairing: "/api/v1/identity/trusted-devices/pairing/validate",
  completeTrustedDevicePairing: "/api/v1/identity/trusted-devices/pairing/complete",
} as const);

export interface IdentitySessionTransportContract {
  readonly registerLocalAccount: {
    readonly request: RegisterLocalIdentityApiRequest;
    readonly response: IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>;
  };
  readonly loginLocalAccount: {
    readonly request: LoginLocalIdentityApiRequest;
    readonly response: IdentityAuthApiResponse<LoginLocalIdentityApiResponse>;
  };
  readonly resolveAuthenticatedSession: {
    readonly response: IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>;
  };
  readonly listIdentitySessions: {
    readonly request: ListIdentitySessionsApiRequest;
    readonly response: IdentityAuthApiResponse<ListIdentitySessionsApiResponse>;
  };
  readonly resolveSessionActorContext: {
    readonly response: IdentityAuthApiResponse<ResolveSessionActorContextApiResponse>;
  };
  readonly logoutAuthenticatedSession: {
    readonly response: IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>;
  };
  readonly revokeIdentitySession: {
    readonly request: RevokeIdentitySessionApiRequest;
    readonly response: IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>;
  };
}

export interface ResolveSessionActorContextApiRequest {
  readonly sessionToken: string;
  readonly workspaceId?: string;
}

export interface ResolveSessionActorWorkspaceContextApiRecord {
  readonly workspaceId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly status: WorkspaceStatus;
  readonly visibility: WorkspaceVisibility;
  readonly membershipStatus?: WorkspaceMembershipStatus;
  readonly effectiveRoles: ReadonlyArray<WorkspaceRole>;
  readonly canAdministrate: boolean;
  readonly isWorkspaceOwner: boolean;
}

export interface ResolveSessionActorContextApiResponse {
  readonly actor: AuthenticatedIdentityPrincipalApiResponse;
  readonly session: {
    readonly sessionId: string;
    readonly providerId: string;
    readonly accessChannel?: "desktop" | "thin-client";
    readonly deviceId?: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
    readonly assuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
    readonly trustedDeviceId?: string;
    readonly issuedOnTrustedDevice?: boolean;
    readonly trustState?: "unknown" | "untrusted" | "trusted" | "pending-pairing" | "revoked" | "expired";
    readonly trustEvaluatedAt?: string;
    readonly trustInvalidationReasons?: ReadonlyArray<
      "trusted-device-revoked"
      | "trusted-device-trust-lost"
      | "trusted-device-expired"
      | "trusted-device-mismatch"
    >;
  };
  readonly trustedDevice?: GetTrustedDeviceApiResponse["trustedDevice"];
  readonly workspaceContext: {
    readonly requestedWorkspaceId?: string;
    readonly resolvedWorkspaceId?: string;
    readonly workspaces: ReadonlyArray<ResolveSessionActorWorkspaceContextApiRecord>;
  };
}

export interface IdentityAdminLiteTransportContract {
  readonly listIdentityAdminAccounts: {
    readonly request: ListIdentityAdminAccountsApiRequest;
    readonly response: IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>;
  };
  readonly getIdentityAdminAccountStatus: {
    readonly request: GetIdentityAdminAccountStatusApiRequest;
    readonly response: IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>;
  };
  readonly setIdentityAdminAccountStatus: {
    readonly request: SetIdentityAdminAccountStatusApiRequest;
    readonly response: IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>;
  };
  readonly listIdentityAdminSessions: {
    readonly request: ListIdentityAdminSessionsApiRequest;
    readonly response: IdentityAuthApiResponse<ListIdentityAdminSessionsApiResponse>;
  };
  readonly revokeIdentityAdminSession: {
    readonly request: RevokeIdentityAdminSessionApiRequest;
    readonly response: IdentityAuthApiResponse<RevokeIdentityAdminSessionApiResponse>;
  };
  readonly listIdentityAdminTrustedDevices: {
    readonly request: ListIdentityAdminTrustedDevicesApiRequest;
    readonly response: IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>;
  };
  readonly revokeIdentityAdminTrustedDevice: {
    readonly request: RevokeIdentityAdminTrustedDeviceApiRequest;
    readonly response: IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>;
  };
}

export interface TrustedDeviceTransportContract {
  readonly listTrustedDevices: {
    readonly request: ListTrustedDevicesApiRequest;
    readonly response: IdentityAuthApiResponse<ListTrustedDevicesApiResponse>;
  };
  readonly getTrustedDevice: {
    readonly request: GetTrustedDeviceApiRequest;
    readonly response: IdentityAuthApiResponse<GetTrustedDeviceApiResponse>;
  };
  readonly revokeTrustedDevice: {
    readonly request: RevokeTrustedDeviceApiRequest;
    readonly response: IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>;
  };
  readonly updateTrustedDeviceDisplayName: {
    readonly request: UpdateTrustedDeviceDisplayNameApiRequest;
    readonly response: IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>;
  };
  readonly initiateTrustedDevicePairing: {
    readonly request: InitiateTrustedDevicePairingApiRequest;
    readonly response: IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>;
  };
  readonly validateTrustedDevicePairing: {
    readonly request: ValidateTrustedDevicePairingApiRequest;
    readonly response: IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>;
  };
  readonly completeTrustedDevicePairing: {
    readonly request: CompleteTrustedDevicePairingApiRequest;
    readonly response: IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>;
  };
  readonly changeLocalPasswordCredential: {
    readonly request: ChangeLocalPasswordCredentialApiRequest;
    readonly response: IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>;
  };
}

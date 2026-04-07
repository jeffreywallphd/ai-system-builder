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

export const IdentityTransportRoutes = Object.freeze({
  register: "/api/v1/identity/register",
  login: "/api/v1/identity/login",
  resolveSession: "/api/v1/identity/session",
  logout: "/api/v1/identity/logout",
  revokeSession: "/api/v1/identity/session/revoke",
  listAdminAccounts: "/api/v1/identity/admin/accounts",
  getAdminAccountStatus: "/api/v1/identity/admin/accounts/:userIdentityId",
  setAdminAccountStatus: "/api/v1/identity/admin/accounts/:userIdentityId/status",
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
  readonly logoutAuthenticatedSession: {
    readonly response: IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>;
  };
  readonly revokeIdentitySession: {
    readonly request: RevokeIdentitySessionApiRequest;
    readonly response: IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>;
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

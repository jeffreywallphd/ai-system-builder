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
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
  UpdateTrustedDeviceDisplayNameApiRequest,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiRequest,
  ValidateTrustedDevicePairingApiResponse,
} from "@shared/contracts/identity/IdentityTransportContracts";
import { SharedApiClient } from "../api/SharedApiClient";

export interface IdentityAuthClient {
  registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>>;
  loginDevelopmentAccount(): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>>;
  loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>>;
  resolveAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>>;
  logoutAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>>;
  revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>>;
  listIdentityAdminAccounts(
    request: ListIdentityAdminAccountsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>>;
  getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>>;
  setIdentityAdminAccountStatus(
    request: SetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>>;
  listIdentityAdminTrustedDevices(
    request: ListIdentityAdminTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>>;
  revokeIdentityAdminTrustedDevice(
    request: RevokeIdentityAdminTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>>;
  changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>>;
  listTrustedDevices(
    request: ListTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>>;
  getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>>;
  revokeTrustedDevice(
    request: RevokeTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>>;
  updateTrustedDeviceDisplayName(
    request: UpdateTrustedDeviceDisplayNameApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>>;
  initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>>;
  validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>>;
  completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>>;
}

export class HttpIdentityAuthClient implements IdentityAuthClient {
  private readonly apiClient: SharedApiClient;

  public constructor(
    baseUrl: string,
    options: Omit<ConstructorParameters<typeof SharedApiClient>[0], "baseUrl"> = {},
  ) {
    this.apiClient = new SharedApiClient({
      baseUrl,
      ...options,
    });
  }

  public async registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
    return this.post("/api/v1/identity/register", request);
  }

  public async loginDevelopmentAccount(): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.post("/api/v1/identity/dev-login", {});
  }

  public async loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.post("/api/v1/identity/login", request);
  }

  public async resolveAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.get("/api/v1/identity/session", sessionToken);
  }

  public async logoutAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> {
    return this.post("/api/v1/identity/logout", {}, sessionToken);
  }

  public async revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> {
    return this.post("/api/v1/identity/session/revoke", request, sessionToken);
  }

  public async listIdentityAdminAccounts(
    request: ListIdentityAdminAccountsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>> {
    const query = new URLSearchParams();
    if (request.providerId) {
      query.set("providerId", request.providerId);
    }
    if (request.includeStatuses) {
      for (const status of request.includeStatuses) {
        query.append("status", status);
      }
    }
    if (typeof request.limit === "number") {
      query.set("limit", String(request.limit));
    }
    if (typeof request.offset === "number") {
      query.set("offset", String(request.offset));
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return this.get(`/api/v1/identity/admin/accounts${suffix}`, sessionToken);
  }

  public async getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> {
    const query = new URLSearchParams();
    if (request.providerId) {
      query.set("providerId", request.providerId);
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return this.get(`/api/v1/identity/admin/accounts/${encodeURIComponent(request.userIdentityId)}${suffix}`, sessionToken);
  }

  public async setIdentityAdminAccountStatus(
    request: SetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>> {
    return this.post(
      `/api/v1/identity/admin/accounts/${encodeURIComponent(request.userIdentityId)}/status`,
      {
        action: request.action,
        providerId: request.providerId,
      },
      sessionToken,
    );
  }

  public async listIdentityAdminTrustedDevices(
    request: ListIdentityAdminTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>> {
    const query = new URLSearchParams();
    query.set("userIdentityId", request.userIdentityId);
    if (request.workspaceId) {
      query.set("workspaceId", request.workspaceId);
    }
    if (request.includeStatuses) {
      for (const status of request.includeStatuses) {
        query.append("status", status);
      }
    }
    if (typeof request.limit === "number") {
      query.set("limit", String(request.limit));
    }
    if (typeof request.offset === "number") {
      query.set("offset", String(request.offset));
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return this.get(`/api/v1/identity/admin/trusted-devices${suffix}`, sessionToken);
  }

  public async revokeIdentityAdminTrustedDevice(
    request: RevokeIdentityAdminTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>> {
    return this.post(
      `/api/v1/identity/admin/trusted-devices/${encodeURIComponent(request.trustedDeviceId)}/revoke`,
      {
        reason: request.reason,
        note: request.note,
        revokedAt: request.revokedAt,
      },
      sessionToken,
    );
  }

  public async changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> {
    return this.post(
      "/api/v1/identity/credential/change",
      request,
      sessionToken,
    );
  }

  public async listTrustedDevices(
    request: ListTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>> {
    const query = new URLSearchParams();
    if (request.workspaceId) {
      query.set("workspaceId", request.workspaceId);
    }
    if (request.includeStatuses) {
      for (const status of request.includeStatuses) {
        query.append("status", status);
      }
    }
    if (typeof request.limit === "number") {
      query.set("limit", String(request.limit));
    }
    if (typeof request.offset === "number") {
      query.set("offset", String(request.offset));
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return this.get(`/api/v1/identity/trusted-devices${suffix}`, sessionToken);
  }

  public async getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> {
    return this.get(`/api/v1/identity/trusted-devices/${encodeURIComponent(request.trustedDeviceId)}`, sessionToken);
  }

  public async revokeTrustedDevice(
    request: RevokeTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>> {
    return this.post(
      `/api/v1/identity/trusted-devices/${encodeURIComponent(request.trustedDeviceId)}/revoke`,
      {
        reason: request.reason,
        note: request.note,
        revokedAt: request.revokedAt,
      },
      sessionToken,
    );
  }

  public async updateTrustedDeviceDisplayName(
    request: UpdateTrustedDeviceDisplayNameApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>> {
    return this.post(
      `/api/v1/identity/trusted-devices/${encodeURIComponent(request.trustedDeviceId)}/display-name`,
      {
        displayName: request.displayName,
        updatedAt: request.updatedAt,
      },
      sessionToken,
    );
  }

  public async initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/initiate",
      request,
      sessionToken,
    );
  }

  public async validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/validate",
      request,
      sessionToken,
    );
  }

  public async completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/complete",
      request,
      sessionToken,
    );
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken?: string,
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    return await this.apiClient.requestJson<IdentityAuthApiResponse<TResponse>>({
      method: "POST",
      path,
      body,
      sessionToken,
    });
  }

  private async get<TResponse>(
    path: string,
    sessionToken?: string,
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    return await this.apiClient.requestJson<IdentityAuthApiResponse<TResponse>>({
      method: "GET",
      path,
      sessionToken,
    });
  }
}



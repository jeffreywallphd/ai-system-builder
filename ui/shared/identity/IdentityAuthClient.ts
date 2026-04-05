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
  ListTrustedDevicesApiRequest,
  ListTrustedDevicesApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
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
} from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

export interface IdentityAuthClient {
  registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>>;
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
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
    return this.post("/api/v1/identity/register", request);
  }

  public async loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.post("/api/v1/identity/login", request);
  }

  public async resolveAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.get("/api/v1/identity/session", {
      authorization: `Bearer ${sessionToken}`,
    });
  }

  public async logoutAuthenticatedSession(
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> {
    return this.post("/api/v1/identity/logout", {}, {
      authorization: `Bearer ${sessionToken}`,
    });
  }

  public async revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> {
    return this.post("/api/v1/identity/session/revoke", request, {
      authorization: `Bearer ${sessionToken}`,
    });
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
    return this.get(`/api/v1/identity/admin/accounts${suffix}`, {
      authorization: `Bearer ${sessionToken}`,
    });
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
    return this.get(`/api/v1/identity/admin/accounts/${encodeURIComponent(request.userIdentityId)}${suffix}`, {
      authorization: `Bearer ${sessionToken}`,
    });
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
      {
        authorization: `Bearer ${sessionToken}`,
      },
    );
  }

  public async changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> {
    return this.post(
      "/api/v1/identity/credential/change",
      request,
      {
        authorization: `Bearer ${sessionToken}`,
      },
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
    return this.get(`/api/v1/identity/trusted-devices${suffix}`, {
      authorization: `Bearer ${sessionToken}`,
    });
  }

  public async getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> {
    return this.get(`/api/v1/identity/trusted-devices/${encodeURIComponent(request.trustedDeviceId)}`, {
      authorization: `Bearer ${sessionToken}`,
    });
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
      {
        authorization: `Bearer ${sessionToken}`,
      },
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
      {
        authorization: `Bearer ${sessionToken}`,
      },
    );
  }

  public async initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/initiate",
      request,
      {
        authorization: `Bearer ${sessionToken}`,
      },
    );
  }

  public async validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/validate",
      request,
      {
        authorization: `Bearer ${sessionToken}`,
      },
    );
  }

  public async completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> {
    return this.post(
      "/api/v1/identity/trusted-devices/pairing/complete",
      request,
      {
        authorization: `Bearer ${sessionToken}`,
      },
    );
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json() as IdentityAuthApiResponse<TResponse>;
    return payload;
  }

  private async get<TResponse>(
    path: string,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers,
    });

    const payload = await response.json() as IdentityAuthApiResponse<TResponse>;
    return payload;
  }
}

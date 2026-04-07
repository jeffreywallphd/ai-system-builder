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
  ListIdentityAdminSessionsApiRequest,
  ListIdentityAdminSessionsApiResponse,
  ListIdentityAdminTrustedDevicesApiRequest,
  ListIdentityAdminTrustedDevicesApiResponse,
  ListIdentitySessionsApiRequest,
  ListIdentitySessionsApiResponse,
  ListTrustedDevicesApiRequest,
  ListTrustedDevicesApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
  RevokeIdentityAdminSessionApiRequest,
  RevokeIdentityAdminSessionApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  ResolveAuthenticatedSessionApiResponse,
  ResolveSessionActorContextApiRequest,
  ResolveSessionActorContextApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
  UpdateTrustedDeviceDisplayNameApiRequest,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiRequest,
  ValidateTrustedDevicePairingApiResponse,
} from "@shared/contracts/identity/IdentityTransportContracts";
import {
  appendSharedApiListQueryConventions,
  appendSharedApiQueryList,
  appendSharedApiQueryValue,
  toSharedApiQuerySuffix,
} from "@shared/contracts/api/SharedApiQueryConventions";
import { SharedApiClient, type SharedApiRetryPolicy } from "../api/SharedApiClient";

export interface IdentityAuthRequestOptions {
  readonly timeoutMs?: number;
  readonly retryPolicy?: SharedApiRetryPolicy;
}

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
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>>;
  listIdentitySessions(
    request: ListIdentitySessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentitySessionsApiResponse>>;
  resolveSessionActorContext(
    request: ResolveSessionActorContextApiRequest,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveSessionActorContextApiResponse>>;
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
  listIdentityAdminSessions(
    request: ListIdentityAdminSessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminSessionsApiResponse>>;
  revokeIdentityAdminSession(
    request: RevokeIdentityAdminSessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminSessionApiResponse>>;
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
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.get("/api/v1/identity/session", sessionToken, options);
  }

  public async listIdentitySessions(
    request: ListIdentitySessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentitySessionsApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryList(query, "status", request.includeStatuses);
    appendSharedApiQueryList(query, "accessChannel", request.includeAccessChannels);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    const suffix = toSharedApiQuerySuffix(query);
    return this.get(`/api/v1/identity/sessions${suffix}`, sessionToken);
  }

  public async resolveSessionActorContext(
    request: ResolveSessionActorContextApiRequest,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveSessionActorContextApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "workspaceId", request.workspaceId);
    const suffix = toSharedApiQuerySuffix(query);
    return this.get(`/api/v1/identity/session/context${suffix}`, request.sessionToken, options);
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
    appendSharedApiQueryValue(query, "providerId", request.providerId);
    appendSharedApiQueryList(query, "status", request.includeStatuses);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    const suffix = toSharedApiQuerySuffix(query);
    return this.get(`/api/v1/identity/admin/accounts${suffix}`, sessionToken);
  }

  public async getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "providerId", request.providerId);
    const suffix = toSharedApiQuerySuffix(query);
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

  public async listIdentityAdminSessions(
    request: ListIdentityAdminSessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminSessionsApiResponse>> {
    const query = new URLSearchParams();
    query.set("userIdentityId", request.userIdentityId);
    appendSharedApiQueryList(query, "status", request.includeStatuses);
    appendSharedApiQueryList(query, "accessChannel", request.includeAccessChannels);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    const suffix = toSharedApiQuerySuffix(query);
    return this.get(`/api/v1/identity/admin/sessions${suffix}`, sessionToken);
  }

  public async revokeIdentityAdminSession(
    request: RevokeIdentityAdminSessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminSessionApiResponse>> {
    return this.post(
      `/api/v1/identity/admin/sessions/${encodeURIComponent(request.sessionId)}/revoke`,
      {
        reason: request.reason,
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
    appendSharedApiListQueryConventions(query, {
      workspaceId: request.workspaceId,
    });
    appendSharedApiQueryList(query, "status", request.includeStatuses);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    const suffix = toSharedApiQuerySuffix(query);
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
    appendSharedApiListQueryConventions(query, {
      workspaceId: request.workspaceId,
    });
    appendSharedApiQueryList(query, "status", request.includeStatuses);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    const suffix = toSharedApiQuerySuffix(query);
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
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    return await this.apiClient.requestJson<IdentityAuthApiResponse<TResponse>>({
      method: "POST",
      path,
      body,
      sessionToken,
      timeoutMs: options?.timeoutMs,
      retryPolicy: options?.retryPolicy,
    });
  }

  private async get<TResponse>(
    path: string,
    sessionToken?: string,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    return await this.apiClient.requestJson<IdentityAuthApiResponse<TResponse>>({
      method: "GET",
      path,
      sessionToken,
      timeoutMs: options?.timeoutMs,
      retryPolicy: options?.retryPolicy,
    });
  }
}



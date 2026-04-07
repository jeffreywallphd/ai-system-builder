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
  LogoutAuthenticatedSessionApiRequest,
  LogoutAuthenticatedSessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
  RevokeIdentityAdminSessionApiRequest,
  RevokeIdentityAdminSessionApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  ResolveAuthenticatedSessionApiRequest,
  ResolveAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
  UpdateTrustedDeviceDisplayNameApiRequest,
  UpdateTrustedDeviceDisplayNameApiResponse,
  ValidateTrustedDevicePairingApiRequest,
  ValidateTrustedDevicePairingApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { DesktopTrustedDeviceIdentityAuthClient } from "@infrastructure/transport/http-client/DesktopTrustedDeviceIdentityAuthClient";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import type {
  ResolveSessionActorContextApiRequest,
  ResolveSessionActorContextApiResponse,
} from "@shared/contracts/identity/IdentityTransportContracts";
import { HttpIdentityAuthClient, type IdentityAuthClient, type IdentityAuthRequestOptions } from "@shared/identity/IdentityAuthClient";
import type { SharedApiClientDiagnosticEvent } from "@shared/api/SharedApiClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

const DefaultIdentityApiTimeoutMs = 10_000;

export class IdentityAuthService {
  private readonly client: IdentityAuthClient;

  public constructor(client: IdentityAuthClient = createDefaultIdentityAuthClient()) {
    this.client = client;
  }

  public registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>> {
    return this.client.registerLocalAccount(request);
  }

  public loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.client.loginLocalAccount(request);
  }

  public loginDevelopmentAccount(): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>> {
    return this.client.loginDevelopmentAccount();
  }

  public resolveAuthenticatedSession(
    request: ResolveAuthenticatedSessionApiRequest,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.client.resolveAuthenticatedSession(request.sessionToken, options);
  }

  public listIdentitySessions(
    request: ListIdentitySessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentitySessionsApiResponse>> {
    return this.client.listIdentitySessions(request, sessionToken);
  }

  public resolveSessionActorContext(
    request: ResolveSessionActorContextApiRequest,
    options?: IdentityAuthRequestOptions,
  ): Promise<IdentityAuthApiResponse<ResolveSessionActorContextApiResponse>> {
    return this.client.resolveSessionActorContext(request, options);
  }

  public logoutAuthenticatedSession(
    request: LogoutAuthenticatedSessionApiRequest,
  ): Promise<IdentityAuthApiResponse<LogoutAuthenticatedSessionApiResponse>> {
    return this.client.logoutAuthenticatedSession(request.sessionToken);
  }

  public revokeIdentitySession(
    request: RevokeIdentitySessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentitySessionApiResponse>> {
    return this.client.revokeIdentitySession(request, sessionToken);
  }

  public listIdentityAdminAccounts(
    request: ListIdentityAdminAccountsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminAccountsApiResponse>> {
    return this.client.listIdentityAdminAccounts(request, sessionToken);
  }

  public getIdentityAdminAccountStatus(
    request: GetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetIdentityAdminAccountStatusApiResponse>> {
    return this.client.getIdentityAdminAccountStatus(request, sessionToken);
  }

  public setIdentityAdminAccountStatus(
    request: SetIdentityAdminAccountStatusApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<SetIdentityAdminAccountStatusApiResponse>> {
    return this.client.setIdentityAdminAccountStatus(request, sessionToken);
  }

  public listIdentityAdminSessions(
    request: ListIdentityAdminSessionsApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminSessionsApiResponse>> {
    return this.client.listIdentityAdminSessions(request, sessionToken);
  }

  public revokeIdentityAdminSession(
    request: RevokeIdentityAdminSessionApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminSessionApiResponse>> {
    return this.client.revokeIdentityAdminSession(request, sessionToken);
  }

  public listIdentityAdminTrustedDevices(
    request: ListIdentityAdminTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListIdentityAdminTrustedDevicesApiResponse>> {
    return this.client.listIdentityAdminTrustedDevices(request, sessionToken);
  }

  public revokeIdentityAdminTrustedDevice(
    request: RevokeIdentityAdminTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeIdentityAdminTrustedDeviceApiResponse>> {
    return this.client.revokeIdentityAdminTrustedDevice(request, sessionToken);
  }

  public changeLocalPasswordCredential(
    request: ChangeLocalPasswordCredentialApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ChangeLocalPasswordCredentialApiResponse>> {
    return this.client.changeLocalPasswordCredential(request, sessionToken);
  }

  public listTrustedDevices(
    request: ListTrustedDevicesApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ListTrustedDevicesApiResponse>> {
    return this.client.listTrustedDevices(request, sessionToken);
  }

  public getTrustedDevice(
    request: GetTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<GetTrustedDeviceApiResponse>> {
    return this.client.getTrustedDevice(request, sessionToken);
  }

  public revokeTrustedDevice(
    request: RevokeTrustedDeviceApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<RevokeTrustedDeviceApiResponse>> {
    return this.client.revokeTrustedDevice(request, sessionToken);
  }

  public updateTrustedDeviceDisplayName(
    request: UpdateTrustedDeviceDisplayNameApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<UpdateTrustedDeviceDisplayNameApiResponse>> {
    return this.client.updateTrustedDeviceDisplayName(request, sessionToken);
  }

  public initiateTrustedDevicePairing(
    request: InitiateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<InitiateTrustedDevicePairingApiResponse>> {
    return this.client.initiateTrustedDevicePairing(request, sessionToken);
  }

  public validateTrustedDevicePairing(
    request: ValidateTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<ValidateTrustedDevicePairingApiResponse>> {
    return this.client.validateTrustedDevicePairing(request, sessionToken);
  }

  public completeTrustedDevicePairing(
    request: CompleteTrustedDevicePairingApiRequest,
    sessionToken: string,
  ): Promise<IdentityAuthApiResponse<CompleteTrustedDevicePairingApiResponse>> {
    return this.client.completeTrustedDevicePairing(request, sessionToken);
  }
}

function createDefaultIdentityAuthClient(): IdentityAuthClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new DesktopTrustedDeviceIdentityAuthClient(
    new HttpIdentityAuthClient(baseUrl, {
      defaultTimeoutMs: DefaultIdentityApiTimeoutMs,
      onDiagnosticEvent: (event) => logIdentityApiDiagnostic(event),
    }),
  );
}

function logIdentityApiDiagnostic(event: SharedApiClientDiagnosticEvent): void {
  if (!event.stage.startsWith("request-transport") && !event.stage.startsWith("request-timeout")) {
    return;
  }
  const message = [
    "[ai-loom][identity-api]",
    event.stage,
    `method=${event.method}`,
    `url=${event.url}`,
    `attempt=${event.attempt}/${event.maxAttempts}`,
    event.status !== undefined ? `status=${event.status}` : undefined,
    event.errorName ? `error=${event.errorName}` : undefined,
    event.errorMessage ? `message=${event.errorMessage}` : undefined,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");

  if (event.severity === "error" || event.severity === "warn") {
    console.warn(message);
    return;
  }
  console.info(message);
}


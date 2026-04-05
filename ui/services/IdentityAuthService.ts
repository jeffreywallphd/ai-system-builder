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
  LogoutAuthenticatedSessionApiRequest,
  LogoutAuthenticatedSessionApiResponse,
  RevokeTrustedDeviceApiRequest,
  RevokeTrustedDeviceApiResponse,
  RevokeIdentityAdminTrustedDeviceApiRequest,
  RevokeIdentityAdminTrustedDeviceApiResponse,
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
} from "../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { HttpIdentityAuthClient, type IdentityAuthClient } from "../shared/identity/IdentityAuthClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

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

  public resolveAuthenticatedSession(
    request: ResolveAuthenticatedSessionApiRequest,
  ): Promise<IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse>> {
    return this.client.resolveAuthenticatedSession(request.sessionToken);
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
  return new HttpIdentityAuthClient(baseUrl);
}

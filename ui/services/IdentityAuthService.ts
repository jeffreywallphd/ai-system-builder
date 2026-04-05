import type {
  GetIdentityAdminAccountStatusApiRequest,
  GetIdentityAdminAccountStatusApiResponse,
  IdentityAuthApiResponse,
  ListIdentityAdminAccountsApiRequest,
  ListIdentityAdminAccountsApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  LogoutAuthenticatedSessionApiRequest,
  LogoutAuthenticatedSessionApiResponse,
  RevokeIdentitySessionApiRequest,
  RevokeIdentitySessionApiResponse,
  ResolveAuthenticatedSessionApiRequest,
  ResolveAuthenticatedSessionApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
  SetIdentityAdminAccountStatusApiRequest,
  SetIdentityAdminAccountStatusApiResponse,
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
}

function createDefaultIdentityAuthClient(): IdentityAuthClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpIdentityAuthClient(baseUrl);
}

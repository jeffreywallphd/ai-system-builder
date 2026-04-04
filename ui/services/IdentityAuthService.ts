import type {
  IdentityAuthApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
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
}

function createDefaultIdentityAuthClient(): IdentityAuthClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpIdentityAuthClient(baseUrl);
}

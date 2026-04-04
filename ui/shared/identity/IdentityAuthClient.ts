import type {
  IdentityAuthApiResponse,
  LoginLocalIdentityApiRequest,
  LoginLocalIdentityApiResponse,
  RegisterLocalIdentityApiRequest,
  RegisterLocalIdentityApiResponse,
} from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

export interface IdentityAuthClient {
  registerLocalAccount(
    request: RegisterLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<RegisterLocalIdentityApiResponse>>;
  loginLocalAccount(
    request: LoginLocalIdentityApiRequest,
  ): Promise<IdentityAuthApiResponse<LoginLocalIdentityApiResponse>>;
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

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<IdentityAuthApiResponse<TResponse>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json() as IdentityAuthApiResponse<TResponse>;
    return payload;
  }
}

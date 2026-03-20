import type {
  IManagedServiceSupervisorClient,
  ManagedSupervisorHealthResponse,
  ManagedSupervisorServiceListResponse,
  ManagedSupervisorServiceResponse,
} from "../../application/services/interfaces/IManagedServiceSupervisorClient";

export interface HttpManagedServiceSupervisorClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly authToken?: string;
}

export class HttpManagedServiceSupervisorClient implements IManagedServiceSupervisorClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    options: HttpManagedServiceSupervisorClientOptions,
    fetchImpl: typeof fetch = fetch,
  ) {
    const normalizedBaseUrl = options.baseUrl?.trim();
    if (!normalizedBaseUrl) {
      throw new Error("Managed service supervisor baseUrl is required.");
    }

    this.baseUrl = normalizedBaseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 15_000;
    this.authToken = options.authToken?.trim() || undefined;
    this.fetchImpl = fetchImpl;
  }

  public health(): Promise<ManagedSupervisorHealthResponse> {
    return this.request<ManagedSupervisorHealthResponse>("GET", "/health");
  }

  public listServices(): Promise<ManagedSupervisorServiceListResponse> {
    return this.request<ManagedSupervisorServiceListResponse>("GET", "/services");
  }

  public getService(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.request<ManagedSupervisorServiceResponse>("GET", `/services/${encodeURIComponent(serviceId)}`);
  }

  public start(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "start");
  }

  public stop(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "stop");
  }

  public restart(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "restart");
  }

  public ensureRunning(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "ensure-running");
  }

  private command(
    serviceId: string,
    action: "start" | "stop" | "restart" | "ensure-running",
  ): Promise<ManagedSupervisorServiceResponse> {
    return this.request<ManagedSupervisorServiceResponse>(
      "POST",
      `/services/${encodeURIComponent(serviceId)}/${action}`,
      {},
    );
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Readonly<Record<string, unknown>>;
      if (!response.ok) {
        throw new Error(
          typeof payload.message === "string"
            ? payload.message
            : `Managed service supervisor request failed (${response.status}).`,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Managed service supervisor request timed out after ${this.timeoutMs}ms.`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Managed service supervisor request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

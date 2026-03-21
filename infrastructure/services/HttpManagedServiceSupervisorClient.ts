import type {
  IManagedServiceSupervisorClient,
  ManagedSupervisorServiceDefinitionListResponse,
  ManagedSupervisorServiceDefinitionResponse,
  ManagedSupervisorHealthResponse,
  ManagedSupervisorServiceListResponse,
  ManagedSupervisorServiceResponse,
} from "../../application/services/interfaces/IManagedServiceSupervisorClient";
import type { ManagedServiceDefinition } from "../../application/services/ManagedServiceDefinition";
import { bindSafeFetch } from "../../application/runtime/RuntimeDiagnostics";
import { RuntimeDiagnosticsError } from "../../application/runtime/RuntimeDiagnosticsError";

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
      throw new RuntimeDiagnosticsError("Managed service supervisor baseUrl is required.", {
        name: "ManagedServiceSupervisorError",
        subsystem: "managed-service-supervisor",
        className: "HttpManagedServiceSupervisorClient",
        methodName: "constructor",
        operation: "configure-managed-service-supervisor-client",
      });
    }

    this.baseUrl = normalizedBaseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 15_000;
    this.authToken = options.authToken?.trim() || undefined;
    this.fetchImpl = bindSafeFetch(fetchImpl);
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

  public listDefinitions(): Promise<ManagedSupervisorServiceDefinitionListResponse> {
    return this.request<ManagedSupervisorServiceDefinitionListResponse>("GET", "/service-definitions");
  }

  public getDefinition(serviceId: string): Promise<ManagedSupervisorServiceDefinitionResponse> {
    return this.request<ManagedSupervisorServiceDefinitionResponse>(
      "GET",
      `/service-definitions/${encodeURIComponent(serviceId)}`,
    );
  }

  public saveDefinition(definition: ManagedServiceDefinition): Promise<ManagedSupervisorServiceDefinitionResponse> {
    return this.request<ManagedSupervisorServiceDefinitionResponse>(
      "PUT",
      `/service-definitions/${encodeURIComponent(definition.serviceId)}`,
      definition,
    );
  }

  public deleteDefinition(serviceId: string): Promise<void> {
    return this.request<void>("DELETE", `/service-definitions/${encodeURIComponent(serviceId)}`);
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

  public provision(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "provision");
  }

  public repair(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "repair");
  }

  public recreateEnvironment(serviceId: string): Promise<ManagedSupervisorServiceResponse> {
    return this.command(serviceId, "recreate-environment");
  }

  private command(
    serviceId: string,
    action: "start" | "stop" | "restart" | "ensure-running" | "provision" | "repair" | "recreate-environment",
  ): Promise<ManagedSupervisorServiceResponse> {
    return this.request<ManagedSupervisorServiceResponse>(
      "POST",
      `/services/${encodeURIComponent(serviceId)}/${action}`,
      {},
    );
  }

  private async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const target = `${this.baseUrl}${path}`;

    try {
      const response = await this.fetchImpl(target, {
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
        throw new RuntimeDiagnosticsError(
          typeof payload.message === "string"
            ? payload.message
            : `Managed service supervisor request failed (${response.status}).`,
          {
            name: "ManagedServiceSupervisorError",
            cause: payload,
            statusCode: response.status,
            details: payload,
            subsystem: "managed-service-supervisor",
            className: "HttpManagedServiceSupervisorClient",
            methodName: "request",
            operation: "managed-service-supervisor-http-request",
            target,
            requestMethod: method,
            failedBeforeResponse: false,
          },
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof RuntimeDiagnosticsError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new RuntimeDiagnosticsError(`Managed service supervisor request timed out after ${this.timeoutMs}ms.`, {
          name: "ManagedServiceSupervisorError",
          cause: error,
          details: body,
          subsystem: "managed-service-supervisor",
          className: "HttpManagedServiceSupervisorClient",
          methodName: "request",
          operation: "managed-service-supervisor-http-request",
          target,
          requestMethod: method,
          failedBeforeResponse: true,
        });
      }

      throw new RuntimeDiagnosticsError("Managed service supervisor request failed.", {
        name: "ManagedServiceSupervisorError",
        cause: error,
        details: body,
        subsystem: "managed-service-supervisor",
        className: "HttpManagedServiceSupervisorClient",
        methodName: "request",
        operation: "managed-service-supervisor-http-request",
        target,
        requestMethod: method,
        failedBeforeResponse: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

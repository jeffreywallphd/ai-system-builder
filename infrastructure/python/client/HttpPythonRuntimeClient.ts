import type {
  IPythonRuntimeClient,
  IPythonRuntimeExecuteNodeRequest,
  IPythonRuntimeExecuteNodeResponse,
  IPythonRuntimeExecuteWorkflowRequest,
  IPythonRuntimeExecuteWorkflowResponse,
  IPythonRuntimeHealthResponse,
} from "../../../application/ports/interfaces/IPythonRuntimeClient";
import { bindSafeFetch } from "../../../application/runtime/RuntimeDiagnostics";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { PythonRuntimeError } from "./PythonRuntimeError";

export class HttpPythonRuntimeClient implements IPythonRuntimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PythonRuntimeConfig, fetchImpl: typeof fetch = fetch) {
    if (!config.baseUrl) {
      throw new PythonRuntimeError("Python runtime baseUrl is required.", {
        subsystem: "python-runtime",
        className: "HttpPythonRuntimeClient",
        methodName: "constructor",
        operation: "configure-python-runtime-client",
      });
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
    this.authToken = config.authToken;
    this.fetchImpl = bindSafeFetch(fetchImpl);
  }

  public async health(): Promise<IPythonRuntimeHealthResponse> {
    return this.request<IPythonRuntimeHealthResponse>("GET", "/health");
  }

  public async executeNode(
    request: IPythonRuntimeExecuteNodeRequest
  ): Promise<IPythonRuntimeExecuteNodeResponse> {
    return this.request<IPythonRuntimeExecuteNodeResponse>("POST", "/execute/node", request);
  }

  public async executeWorkflow(
    request: IPythonRuntimeExecuteWorkflowRequest
  ): Promise<IPythonRuntimeExecuteWorkflowResponse> {
    return this.request<IPythonRuntimeExecuteWorkflowResponse>("POST", "/execute/workflow", request);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
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
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as Readonly<Record<string, unknown>>;

      if (!response.ok) {
        throw new PythonRuntimeError(`Python runtime request failed (${response.status}).`, {
          cause: payload,
          statusCode: response.status,
          details: payload,
          subsystem: "python-runtime",
          className: "HttpPythonRuntimeClient",
          methodName: "request",
          operation: "python-runtime-http-request",
          target,
          requestMethod: method,
          failedBeforeResponse: false,
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof PythonRuntimeError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new PythonRuntimeError(`Python runtime request timed out after ${this.timeoutMs}ms.`, {
          cause: error,
          subsystem: "python-runtime",
          className: "HttpPythonRuntimeClient",
          methodName: "request",
          operation: "python-runtime-http-request",
          target,
          requestMethod: method,
          failedBeforeResponse: true,
          details: body,
        });
      }

      throw new PythonRuntimeError("Python runtime request failed.", {
        cause: error,
        details: body,
        subsystem: "python-runtime",
        className: "HttpPythonRuntimeClient",
        methodName: "request",
        operation: "python-runtime-http-request",
        target,
        requestMethod: method,
        failedBeforeResponse: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

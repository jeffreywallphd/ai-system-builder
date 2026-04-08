import type {
  ComfyHistoryPromptEntryDto,
  ComfyHistoryResponseDto,
  ComfyQueuePromptResponseDto,
  ComfyQueueStateDto,
  ComfyWorkflowDto,
} from "@infrastructure/comfyui/dto/ComfyWorkflowDto";

export const ComfyUiTransportPromptStates = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type ComfyUiTransportPromptState =
  typeof ComfyUiTransportPromptStates[keyof typeof ComfyUiTransportPromptStates];

export const ComfyUiTransportCancellationStatuses = Object.freeze({
  accepted: "accepted",
  alreadyTerminal: "already-terminal",
});

export type ComfyUiTransportCancellationStatus =
  typeof ComfyUiTransportCancellationStatuses[keyof typeof ComfyUiTransportCancellationStatuses];

export type ComfyUiTransportOperation =
  | "submit-prompt"
  | "query-prompt-state"
  | "request-cancellation";

export type ComfyUiTransportErrorCode =
  | "invalid-configuration"
  | "invalid-request"
  | "invalid-response"
  | "request-timeout"
  | "transport-unavailable"
  | "http-error"
  | "prompt-rejected";

export interface ComfyUiTransportClientErrorDiagnostics {
  readonly operation: ComfyUiTransportOperation;
  readonly path?: string;
  readonly statusCode?: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ComfyUiTransportClientError extends Error {
  public readonly code: ComfyUiTransportErrorCode;
  public readonly retryable: boolean;
  public readonly diagnostics: ComfyUiTransportClientErrorDiagnostics;

  public constructor(input: {
    readonly code: ComfyUiTransportErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly diagnostics: ComfyUiTransportClientErrorDiagnostics;
  }) {
    super(input.message);
    this.name = "ComfyUiTransportClientError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.diagnostics = Object.freeze({ ...input.diagnostics });
  }
}

export interface ComfyUiTransportLogEvent {
  readonly scope: "comfyui-transport";
  readonly event: "request-succeeded" | "request-failed";
  readonly operation: ComfyUiTransportOperation;
  readonly at: string;
  readonly promptId?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly errorCode?: ComfyUiTransportErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ComfyUiTransportLogger {
  log(event: ComfyUiTransportLogEvent): void;
}

export interface ComfyUiTransportClientOptions {
  readonly baseUrl: string;
  readonly requestTimeoutMs?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly logger?: ComfyUiTransportLogger;
}

export interface ComfyUiPromptSubmissionResult {
  readonly promptId: string;
  readonly acceptedAt: string;
  readonly queueNumber?: number;
}

export interface ComfyUiPromptStateSnapshot {
  readonly promptId: string;
  readonly state: ComfyUiTransportPromptState;
  readonly checkedAt: string;
  readonly queuePosition?: number;
  readonly statusMessage?: string;
  readonly completed: boolean;
}

export interface ComfyUiPromptCancellationResult {
  readonly promptId: string;
  readonly status: ComfyUiTransportCancellationStatus;
  readonly acknowledgedAt: string;
  readonly state?: ComfyUiTransportPromptState;
}

export class ComfyUiTransportClient {
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;
  private readonly logger?: ComfyUiTransportLogger;

  public constructor(options: ComfyUiTransportClientOptions) {
    const normalizedBaseUrl = options.baseUrl?.trim().replace(/\/+$/, "");
    if (!normalizedBaseUrl) {
      throw new ComfyUiTransportClientError({
        code: "invalid-configuration",
        message: "ComfyUI transport client requires a non-empty baseUrl.",
        retryable: false,
        diagnostics: {
          operation: "submit-prompt",
        },
      });
    }

    this.baseUrl = normalizedBaseUrl;
    this.requestTimeoutMs = normalizePositiveInteger(options.requestTimeoutMs, 30_000);
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
  }

  public async submitPrompt(input: {
    readonly request: ComfyWorkflowDto;
  }): Promise<ComfyUiPromptSubmissionResult> {
    const startedAt = Date.now();
    try {
      const request = normalizePromptRequest(input.request);
      const response = await this.requestJson<ComfyQueuePromptResponseDto>({
        operation: "submit-prompt",
        path: "/prompt",
        init: Object.freeze({
          method: "POST",
          headers: Object.freeze({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(request),
        }),
      });

      if (response.node_errors && Object.keys(response.node_errors).length > 0) {
        throw new ComfyUiTransportClientError({
          code: "prompt-rejected",
          message: "ComfyUI rejected the prompt request due to node validation errors.",
          retryable: false,
          diagnostics: {
            operation: "submit-prompt",
            path: "/prompt",
            details: Object.freeze({
              nodeErrorKeys: Object.freeze(Object.keys(response.node_errors)),
            }),
          },
        });
      }

      const promptId = response.prompt_id?.trim();
      if (!promptId) {
        throw new ComfyUiTransportClientError({
          code: "invalid-response",
          message: "ComfyUI prompt submission response did not include prompt_id.",
          retryable: false,
          diagnostics: {
            operation: "submit-prompt",
            path: "/prompt",
          },
        });
      }

      this.logSuccess("submit-prompt", startedAt, promptId, undefined, {
        hasQueueNumber: typeof response.number === "number",
      });
      return Object.freeze({
        promptId,
        acceptedAt: this.now().toISOString(),
        queueNumber: typeof response.number === "number" ? response.number : undefined,
      });
    } catch (error) {
      if (error instanceof ComfyUiTransportClientError) {
        this.logFailure("submit-prompt", startedAt, error);
      }
      throw error;
    }
  }

  public async queryPromptState(input: {
    readonly promptId: string;
  }): Promise<ComfyUiPromptStateSnapshot> {
    const promptId = normalizePromptId(input.promptId);
    const startedAt = Date.now();
    try {
      const history = await this.requestJson<ComfyHistoryResponseDto>({
        operation: "query-prompt-state",
        path: `/history/${encodeURIComponent(promptId)}`,
        init: Object.freeze({
          method: "GET",
        }),
      });

      const historyEntry = history[promptId];
      if (historyEntry) {
        const resolved = resolveStateFromHistory(historyEntry);
        this.logSuccess("query-prompt-state", startedAt, promptId, undefined, {
          source: "history",
          state: resolved.state,
        });
        return Object.freeze({
          promptId,
          state: resolved.state,
          checkedAt: this.now().toISOString(),
          statusMessage: resolved.statusMessage,
          completed: resolved.state === "completed",
        });
      }

      const queue = await this.requestJson<ComfyQueueStateDto>({
        operation: "query-prompt-state",
        path: "/queue",
        init: Object.freeze({
          method: "GET",
        }),
      });
      const queueState = findQueuePosition(queue, promptId);
      const state = queueState?.running
        ? ComfyUiTransportPromptStates.running
        : ComfyUiTransportPromptStates.queued;
      this.logSuccess("query-prompt-state", startedAt, promptId, undefined, {
        source: "queue",
        state,
        queuePosition: queueState?.position,
      });
      return Object.freeze({
        promptId,
        state,
        checkedAt: this.now().toISOString(),
        queuePosition: queueState?.position,
        completed: false,
      });
    } catch (error) {
      if (error instanceof ComfyUiTransportClientError) {
        this.logFailure("query-prompt-state", startedAt, error);
      }
      throw error;
    }
  }

  public async requestPromptCancellation(input: {
    readonly promptId: string;
  }): Promise<ComfyUiPromptCancellationResult> {
    const promptId = normalizePromptId(input.promptId);
    const startedAt = Date.now();
    try {
      const state = await this.queryPromptState({
        promptId,
      });
      if (state.state === "completed" || state.state === "failed" || state.state === "cancelled") {
        const acknowledgedAt = this.now().toISOString();
        this.logSuccess("request-cancellation", startedAt, promptId, undefined, {
          status: ComfyUiTransportCancellationStatuses.alreadyTerminal,
          state: state.state,
        });
        return Object.freeze({
          promptId,
          status: ComfyUiTransportCancellationStatuses.alreadyTerminal,
          acknowledgedAt,
          state: state.state,
        });
      }

      await this.requestVoid({
        operation: "request-cancellation",
        path: "/interrupt",
        init: Object.freeze({
          method: "POST",
          headers: Object.freeze({
            "Content-Type": "application/json",
          }),
          body: "{}",
        }),
      });
      const acknowledgedAt = this.now().toISOString();
      this.logSuccess("request-cancellation", startedAt, promptId, undefined, {
        status: ComfyUiTransportCancellationStatuses.accepted,
      });
      return Object.freeze({
        promptId,
        status: ComfyUiTransportCancellationStatuses.accepted,
        acknowledgedAt,
      });
    } catch (error) {
      if (error instanceof ComfyUiTransportClientError) {
        this.logFailure("request-cancellation", startedAt, error);
      }
      throw error;
    }
  }

  private async requestJson<TResponse>(input: {
    readonly operation: ComfyUiTransportOperation;
    readonly path: string;
    readonly init: RequestInit;
  }): Promise<TResponse> {
    const response = await this.request(input);
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new ComfyUiTransportClientError({
        code: "invalid-response",
        message: `ComfyUI returned a non-JSON response for ${input.operation}.`,
        retryable: false,
        diagnostics: {
          operation: input.operation,
          path: input.path,
          statusCode: response.status,
        },
      });
    }
    return parsed as TResponse;
  }

  private async requestVoid(input: {
    readonly operation: ComfyUiTransportOperation;
    readonly path: string;
    readonly init: RequestInit;
  }): Promise<void> {
    await this.request(input);
  }

  private async request(input: {
    readonly operation: ComfyUiTransportOperation;
    readonly path: string;
    readonly init: RequestInit;
  }): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const url = `${this.baseUrl}${input.path}`;
    try {
      const response = await this.fetchFn(url, {
        ...input.init,
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await safeReadText(response);
        throw new ComfyUiTransportClientError({
          code: "http-error",
          message: `ComfyUI transport request failed for ${input.operation} with status ${response.status}.`,
          retryable: response.status >= 500 || response.status === 429,
          diagnostics: {
            operation: input.operation,
            path: input.path,
            statusCode: response.status,
            details: body
              ? Object.freeze({
                bodyPreview: body.slice(0, 300),
              })
              : undefined,
          },
        });
      }
      return response;
    } catch (error) {
      if (error instanceof ComfyUiTransportClientError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new ComfyUiTransportClientError({
          code: "request-timeout",
          message: `ComfyUI transport request timed out for ${input.operation}.`,
          retryable: true,
          diagnostics: {
            operation: input.operation,
            path: input.path,
          },
        });
      }
      throw new ComfyUiTransportClientError({
        code: "transport-unavailable",
        message: `ComfyUI transport request failed for ${input.operation}.`,
        retryable: true,
        diagnostics: {
          operation: input.operation,
          path: input.path,
          details: error instanceof Error
            ? Object.freeze({
              name: error.name,
              message: error.message,
            })
            : undefined,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private logSuccess(
    operation: ComfyUiTransportOperation,
    startedAt: number,
    promptId?: string,
    statusCode?: number,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.logger?.log(Object.freeze({
      scope: "comfyui-transport",
      event: "request-succeeded",
      operation,
      at: this.now().toISOString(),
      promptId,
      statusCode,
      durationMs: Date.now() - startedAt,
      details,
    }));
  }

  private logFailure(
    operation: ComfyUiTransportOperation,
    startedAt: number,
    error: ComfyUiTransportClientError,
  ): void {
    this.logger?.log(Object.freeze({
      scope: "comfyui-transport",
      event: "request-failed",
      operation,
      at: this.now().toISOString(),
      durationMs: Date.now() - startedAt,
      statusCode: error.diagnostics.statusCode,
      errorCode: error.code,
      details: error.diagnostics.details,
    }));
  }
}

function normalizePromptRequest(input: ComfyWorkflowDto): ComfyWorkflowDto {
  if (!input || typeof input !== "object") {
    throw new ComfyUiTransportClientError({
      code: "invalid-request",
      message: "ComfyUI prompt submission requires a request payload.",
      retryable: false,
      diagnostics: {
        operation: "submit-prompt",
      },
    });
  }
  const prompt = (input as { prompt?: unknown }).prompt;
  if (!prompt || typeof prompt !== "object") {
    throw new ComfyUiTransportClientError({
      code: "invalid-request",
      message: "ComfyUI prompt submission request must include prompt graph content.",
      retryable: false,
      diagnostics: {
        operation: "submit-prompt",
        details: Object.freeze({
          missingField: "prompt",
        }),
      },
    });
  }
  const clientId = (input as { client_id?: unknown }).client_id;
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new ComfyUiTransportClientError({
      code: "invalid-request",
      message: "ComfyUI prompt submission request must include client_id.",
      retryable: false,
      diagnostics: {
        operation: "submit-prompt",
        details: Object.freeze({
          missingField: "client_id",
        }),
      },
    });
  }
  return Object.freeze({
    prompt: prompt as ComfyWorkflowDto["prompt"],
    client_id: clientId.trim(),
  });
}

function normalizePromptId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ComfyUiTransportClientError({
      code: "invalid-request",
      message: "ComfyUI prompt operations require a non-empty promptId.",
      retryable: false,
      diagnostics: {
        operation: "query-prompt-state",
      },
    });
  }
  return normalized;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function resolveStateFromHistory(historyEntry: ComfyHistoryPromptEntryDto): {
  readonly state: ComfyUiTransportPromptState;
  readonly statusMessage?: string;
} {
  const statusStr = historyEntry.status?.status_str?.trim() || undefined;
  const lowered = statusStr?.toLowerCase();
  if (historyEntry.status?.completed) {
    return Object.freeze({
      state: ComfyUiTransportPromptStates.completed,
      statusMessage: statusStr,
    });
  }
  if (lowered?.includes("cancel")) {
    return Object.freeze({
      state: ComfyUiTransportPromptStates.cancelled,
      statusMessage: statusStr,
    });
  }
  if (lowered?.includes("error") || lowered?.includes("fail")) {
    return Object.freeze({
      state: ComfyUiTransportPromptStates.failed,
      statusMessage: statusStr,
    });
  }
  return Object.freeze({
    state: ComfyUiTransportPromptStates.running,
    statusMessage: statusStr,
  });
}

function findQueuePosition(queue: ComfyQueueStateDto, promptId: string): {
  readonly position: number;
  readonly running: boolean;
} | undefined {
  const running = queue.queue_running ?? [];
  const pending = queue.queue_pending ?? [];

  for (let index = 0; index < running.length; index += 1) {
    const item = running[index];
    if (containsPromptId(item, promptId)) {
      return Object.freeze({
        position: index,
        running: true,
      });
    }
  }

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    if (containsPromptId(item, promptId)) {
      return Object.freeze({
        position: index,
        running: false,
      });
    }
  }
  return undefined;
}

function containsPromptId(value: unknown, promptId: string): boolean {
  if (typeof value === "string") {
    return value === promptId;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsPromptId(item, promptId));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsPromptId(item, promptId));
  }
  return false;
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

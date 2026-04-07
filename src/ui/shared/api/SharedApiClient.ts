import { z } from "zod";
import {
  SharedApiErrorCodes,
  type SharedApiErrorCode,
  type SharedApiErrorShape,
} from "@shared/contracts/api/SharedApiContractPrimitives";

export interface SharedApiEnvelope<TData = unknown> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: SharedApiErrorShape & Readonly<Record<string, unknown>>;
}

export interface SharedApiClientValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class SharedApiClientValidationError extends Error {
  public readonly issues: ReadonlyArray<SharedApiClientValidationIssue>;

  public constructor(message: string, issues: ReadonlyArray<SharedApiClientValidationIssue>) {
    super(message);
    this.name = "SharedApiClientValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export interface SharedApiRetryPolicy {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly retryOnStatuses?: ReadonlyArray<number>;
  readonly retryOnSharedCodes?: ReadonlyArray<SharedApiErrorCode>;
}

export interface SharedApiClientOptions {
  readonly baseUrl: string;
  readonly fetchImplementation?: typeof fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Readonly<Record<string, string>>;
  readonly defaultTimeoutMs?: number;
  readonly retryPolicy?: SharedApiRetryPolicy;
}

export interface SharedApiRequestOptions<TResponse extends SharedApiEnvelope<unknown>> {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  readonly sessionToken?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly retryPolicy?: SharedApiRetryPolicy;
  readonly parseResponse?: (payload: unknown) => TResponse;
}

const EnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    userMessage: z.string().trim().min(1).optional(),
    retryable: z.boolean().optional(),
    sharedCode: z.string().trim().min(1).optional(),
    domainCode: z.string().trim().min(1).optional(),
    validationErrors: z.array(
      z.object({
        path: z.string().trim().min(1),
        code: z.string().trim().min(1),
        message: z.string().trim().min(1),
      }).strict(),
    ).optional(),
  }).passthrough().optional(),
}).passthrough();

const DefaultRetryPolicy: Required<SharedApiRetryPolicy> = Object.freeze({
  maxAttempts: 2,
  baseDelayMs: 150,
  maxDelayMs: 1_500,
  retryOnStatuses: Object.freeze([429, 502, 503, 504]),
  retryOnSharedCodes: Object.freeze([
    SharedApiErrorCodes.rateLimited,
    SharedApiErrorCodes.temporarilyUnavailable,
  ]),
});

export function parseSharedApiEnvelope(payload: unknown): SharedApiEnvelope<unknown> {
  const parsed = EnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SharedApiClientValidationError(
      "Shared API envelope is invalid.",
      parsed.error.issues.map((issue) => ({
        path: formatValidationPath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export class SharedApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly credentials: RequestCredentials | undefined;
  private readonly defaultHeaders: Readonly<Record<string, string>>;
  private readonly defaultTimeoutMs: number | undefined;
  private readonly defaultRetryPolicy: SharedApiRetryPolicy | undefined;

  public constructor(options: SharedApiClientOptions) {
    const normalizedBaseUrl = options.baseUrl.trim().replace(/\/$/, "");
    if (!normalizedBaseUrl) {
      throw new Error("SharedApiClient baseUrl is required.");
    }

    this.baseUrl = normalizedBaseUrl;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.credentials = options.credentials;
    this.defaultHeaders = Object.freeze({
      ...(options.defaultHeaders ?? {}),
    });
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.defaultRetryPolicy = options.retryPolicy;
  }

  public async requestJson<TResponse extends SharedApiEnvelope<unknown>>(
    options: SharedApiRequestOptions<TResponse>,
  ): Promise<TResponse> {
    const retryPolicy = this.resolveRetryPolicy(options.method, options.retryPolicy);
    const maxAttempts = retryPolicy.maxAttempts ?? 1;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      const requestSignal = createRequestSignal(
        options.signal,
        options.timeoutMs ?? this.defaultTimeoutMs,
      );

      try {
        const response = await this.fetchImplementation(`${this.baseUrl}${options.path}`, {
          method: options.method,
          headers: this.buildHeaders(options.sessionToken, options.headers, options.body),
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: requestSignal.signal,
          credentials: this.credentials,
        });

        const parsedResponse = await this.parseResponse(response, options.parseResponse);
        if (!this.shouldRetryResponse(response, parsedResponse, retryPolicy, options.method, attempt, maxAttempts)) {
          return parsedResponse;
        }
      } catch (error) {
        if (isAbortError(error)) {
          if (requestSignal.didTimeout()) {
            return this.normalizeErrorResponse(
              SharedApiErrorCodes.temporarilyUnavailable,
              "Request timed out.",
              Object.freeze({
                retryable: true,
                domainCode: "request-timeout",
              }),
            ) as TResponse;
          }
          return this.normalizeErrorResponse(
            SharedApiErrorCodes.temporarilyUnavailable,
            "Request was cancelled.",
            Object.freeze({
              retryable: false,
              domainCode: "request-cancelled",
            }),
          ) as TResponse;
        }

        if (!this.shouldRetryException(options.method, attempt, maxAttempts)) {
          return this.normalizeErrorResponse(
            SharedApiErrorCodes.temporarilyUnavailable,
            "Unable to reach the API service.",
            Object.freeze({
              retryable: true,
              domainCode: "transport-unavailable",
            }),
          ) as TResponse;
        }
      } finally {
        requestSignal.dispose();
      }

      const delayMs = resolveRetryDelayMs(retryPolicy, attempt);
      await waitFor(delayMs, options.signal);
    }

    return this.normalizeErrorResponse(
      SharedApiErrorCodes.temporarilyUnavailable,
      "The API request failed after retry attempts.",
      Object.freeze({
        retryable: true,
        domainCode: "retry-attempts-exhausted",
      }),
    ) as TResponse;
  }

  private buildHeaders(
    sessionToken: string | undefined,
    requestHeaders: Readonly<Record<string, string>> | undefined,
    body: unknown,
  ): Readonly<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(requestHeaders ?? {}),
    };

    if (body !== undefined && !hasHeader(headers, "content-type")) {
      headers["content-type"] = "application/json";
    }

    if (sessionToken) {
      headers.authorization = `Bearer ${sessionToken}`;
    }

    return Object.freeze(headers);
  }

  private async parseResponse<TResponse extends SharedApiEnvelope<unknown>>(
    response: Response,
    parser: SharedApiRequestOptions<TResponse>["parseResponse"],
  ): Promise<TResponse> {
    const payload = await parseJson(response);

    if (parser) {
      try {
        return parser(payload);
      } catch (error) {
        const validationIssues = error instanceof SharedApiClientValidationError
          ? error.issues
          : [];
        return this.normalizeErrorResponse(
          SharedApiErrorCodes.internal,
          "Response payload failed schema validation.",
          Object.freeze({
            domainCode: "response-schema-invalid",
            retryable: false,
            validationErrors: validationIssues,
          }),
        ) as TResponse;
      }
    }

    const envelope = coerceEnvelope(payload, response.status);
    if (envelope) {
      return envelope as TResponse;
    }

    if (response.ok) {
      return Object.freeze({
        ok: true,
        data: payload,
      }) as TResponse;
    }

    const statusError = normalizeStatusError(response.status);
    return this.normalizeErrorResponse(
      statusError.code,
      statusError.message,
      Object.freeze({
        retryable: statusError.retryable,
        domainCode: statusError.code,
        sharedCode: statusError.code,
      }),
    ) as TResponse;
  }

  private resolveRetryPolicy(
    method: SharedApiRequestOptions<SharedApiEnvelope<unknown>>["method"],
    overridePolicy?: SharedApiRetryPolicy,
  ): Required<SharedApiRetryPolicy> {
    const policy = method === "GET"
      ? {
        ...DefaultRetryPolicy,
        ...(this.defaultRetryPolicy ?? {}),
        ...(overridePolicy ?? {}),
      }
      : {
        ...DefaultRetryPolicy,
        ...((overridePolicy ?? this.defaultRetryPolicy) ?? {}),
      };

    return Object.freeze({
      maxAttempts: Math.max(1, policy.maxAttempts ?? 1),
      baseDelayMs: Math.max(0, policy.baseDelayMs ?? DefaultRetryPolicy.baseDelayMs),
      maxDelayMs: Math.max(0, policy.maxDelayMs ?? DefaultRetryPolicy.maxDelayMs),
      retryOnStatuses: Object.freeze([...(policy.retryOnStatuses ?? DefaultRetryPolicy.retryOnStatuses)]),
      retryOnSharedCodes: Object.freeze([...(policy.retryOnSharedCodes ?? DefaultRetryPolicy.retryOnSharedCodes)]),
    });
  }

  private shouldRetryException(
    method: SharedApiRequestOptions<SharedApiEnvelope<unknown>>["method"],
    attempt: number,
    maxAttempts: number,
  ): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    return method === "GET";
  }

  private shouldRetryResponse(
    response: Response,
    payload: SharedApiEnvelope<unknown>,
    retryPolicy: Required<SharedApiRetryPolicy>,
    method: SharedApiRequestOptions<SharedApiEnvelope<unknown>>["method"],
    attempt: number,
    maxAttempts: number,
  ): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }
    if (method !== "GET") {
      return false;
    }

    if (retryPolicy.retryOnStatuses.includes(response.status)) {
      return true;
    }

    const sharedCode = resolveSharedCode(payload.error?.sharedCode ?? payload.error?.code, response.status);
    return retryPolicy.retryOnSharedCodes.includes(sharedCode);
  }

  private normalizeErrorResponse(
    sharedCode: SharedApiErrorCode,
    message: string,
    additionalErrorFields: Readonly<Record<string, unknown>>,
  ): SharedApiEnvelope<unknown> {
    const domainCode = typeof additionalErrorFields.domainCode === "string"
      ? additionalErrorFields.domainCode
      : sharedCode;
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: domainCode,
        message,
        userMessage: message,
        sharedCode,
        domainCode,
        ...additionalErrorFields,
      }),
    });
  }
}

function formatValidationPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function hasHeader(headers: Readonly<Record<string, string>>, targetName: string): boolean {
  const normalizedTarget = targetName.toLowerCase();
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === normalizedTarget);
}

function createRequestSignal(signal: AbortSignal | undefined, timeoutMs: number | undefined): {
  readonly signal: AbortSignal | undefined;
  readonly dispose: () => void;
  readonly didTimeout: () => boolean;
} {
  if (!signal && typeof timeoutMs !== "number") {
    return {
      signal: undefined,
      dispose: () => {
        // no-op
      },
      didTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort);
    }
  }

  if (typeof timeoutMs === "number" && timeoutMs >= 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
}

function resolveRetryDelayMs(retryPolicy: Required<SharedApiRetryPolicy>, attempt: number): number {
  const factor = Math.max(0, attempt - 1);
  const exponentialDelay = retryPolicy.baseDelayMs * (2 ** factor);
  return Math.min(retryPolicy.maxDelayMs, exponentialDelay);
}

async function waitFor(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    signal?.addEventListener("abort", onAbort);
  });
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function coerceEnvelope(payload: unknown, status: number): SharedApiEnvelope<unknown> | undefined {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    return undefined;
  }

  try {
    const parsed = parseSharedApiEnvelope(payload);
    if (!parsed.ok && parsed.error) {
      const sharedCode = resolveSharedCode(parsed.error.sharedCode ?? parsed.error.code, status);
      const domainCode = parsed.error.domainCode ?? parsed.error.code ?? sharedCode;
      return Object.freeze({
        ...parsed,
        error: Object.freeze({
          ...parsed.error,
          code: domainCode,
          domainCode,
          sharedCode,
          retryable: parsed.error.retryable ?? isRetryableSharedCode(sharedCode),
        }),
      });
    }
    return parsed;
  } catch (error) {
    const validationIssues = error instanceof SharedApiClientValidationError
      ? error.issues
      : [];
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: "response-schema-invalid",
        domainCode: "response-schema-invalid",
        sharedCode: SharedApiErrorCodes.internal,
        message: "Response payload failed schema validation.",
        userMessage: "Response payload failed schema validation.",
        retryable: false,
        validationErrors: validationIssues,
      }),
    });
  }
}

function normalizeStatusError(status: number): {
  readonly code: SharedApiErrorCode;
  readonly message: string;
  readonly retryable: boolean;
} {
  const code = resolveSharedCode(undefined, status);
  return Object.freeze({
    code,
    message: `Request failed with HTTP status ${status}.`,
    retryable: isRetryableSharedCode(code),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function resolveSharedCode(candidateCode: unknown, status: number): SharedApiErrorCode {
  if (typeof candidateCode === "string") {
    const normalizedCandidate = candidateCode.trim();
    switch (normalizedCandidate) {
      case SharedApiErrorCodes.invalidRequest:
      case SharedApiErrorCodes.authenticationFailed:
      case SharedApiErrorCodes.forbidden:
      case SharedApiErrorCodes.notFound:
      case SharedApiErrorCodes.conflict:
      case SharedApiErrorCodes.rateLimited:
      case SharedApiErrorCodes.temporarilyUnavailable:
      case SharedApiErrorCodes.internal:
        return normalizedCandidate;
      case "account-inactive":
        return SharedApiErrorCodes.forbidden;
      case "invalid-transition":
        return SharedApiErrorCodes.conflict;
      case "unsupported-provider":
        return SharedApiErrorCodes.invalidRequest;
      default:
        break;
    }
  }

  if (status === 400) {
    return SharedApiErrorCodes.invalidRequest;
  }
  if (status === 401) {
    return SharedApiErrorCodes.authenticationFailed;
  }
  if (status === 403) {
    return SharedApiErrorCodes.forbidden;
  }
  if (status === 404) {
    return SharedApiErrorCodes.notFound;
  }
  if (status === 409) {
    return SharedApiErrorCodes.conflict;
  }
  if (status === 429) {
    return SharedApiErrorCodes.rateLimited;
  }
  if (status >= 500) {
    return SharedApiErrorCodes.temporarilyUnavailable;
  }

  return SharedApiErrorCodes.internal;
}

function isRetryableSharedCode(code: SharedApiErrorCode): boolean {
  return code === SharedApiErrorCodes.rateLimited || code === SharedApiErrorCodes.temporarilyUnavailable;
}

function isAbortError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.name === "AbortError";
}

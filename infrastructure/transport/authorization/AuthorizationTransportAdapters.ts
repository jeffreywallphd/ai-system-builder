import {
  AuthorizationTransportFailureCodes,
  type AuthorizationTransportFailure,
  type AuthorizationTransportGuardAllowed,
  type AuthorizationTransportGuardDenied,
  type AuthorizationTransportPolicyGuard,
  type AuthorizationTransportRequirement,
} from "./AuthorizationTransportPolicyGuard";

export interface AuthorizationTransportErrorBody {
  readonly ok: false;
  readonly error: {
    readonly code: AuthorizationTransportFailure["code"];
    readonly message: string;
    readonly reasonCode?: string;
    readonly denialReason?: AuthorizationTransportFailure["denialReason"];
  };
}

export interface HttpAuthorizationDenied {
  readonly ok: false;
  readonly statusCode: number;
  readonly body: AuthorizationTransportErrorBody;
}

export type HttpAuthorizationResult = AuthorizationTransportGuardAllowed | HttpAuthorizationDenied;

export interface WebSocketAuthorizationDenied {
  readonly ok: false;
  readonly closeCode: number;
  readonly reason: string;
  readonly error: AuthorizationTransportErrorBody["error"];
}

export type WebSocketAuthorizationResult = AuthorizationTransportGuardAllowed | WebSocketAuthorizationDenied;

export class HttpAuthorizationGuardAdapter<TContext> {
  public constructor(private readonly guard: AuthorizationTransportPolicyGuard<TContext>) {}

  public async authorize(context: TContext, requirement: AuthorizationTransportRequirement<TContext>): Promise<HttpAuthorizationResult> {
    const result = await this.guard.authorize(context, requirement);
    if (result.ok) {
      return result;
    }

    const mapped = mapAuthorizationFailureToHttpResponse(result);
    return Object.freeze({
      ok: false,
      statusCode: mapped.statusCode,
      body: mapped.body,
    });
  }
}

export class WebSocketAuthorizationGuardAdapter<TContext> {
  public constructor(private readonly guard: AuthorizationTransportPolicyGuard<TContext>) {}

  public async authorize(
    context: TContext,
    requirement: AuthorizationTransportRequirement<TContext>,
  ): Promise<WebSocketAuthorizationResult> {
    const result = await this.guard.authorize(context, requirement);
    if (result.ok) {
      return result;
    }

    const mapped = mapAuthorizationFailureToWebSocketClose(result);
    return Object.freeze({
      ok: false,
      closeCode: mapped.closeCode,
      reason: mapped.reason,
      error: mapped.error,
    });
  }
}

export class IpcAuthorizationGuardAdapter<TContext> {
  public constructor(private readonly guard: AuthorizationTransportPolicyGuard<TContext>) {}

  public async authorizeOrThrow(
    context: TContext,
    requirement: AuthorizationTransportRequirement<TContext>,
  ): Promise<AuthorizationTransportGuardAllowed> {
    const result = await this.guard.authorize(context, requirement);
    if (result.ok) {
      return result;
    }

    const error = new Error(toIpcErrorMessage(result.failure));
    Object.assign(error, {
      code: result.failure.code,
      reasonCode: result.failure.reasonCode,
      denialReason: result.failure.denialReason,
    });
    throw error;
  }
}

export function mapAuthorizationFailureToHttpResponse(result: AuthorizationTransportGuardDenied): {
  readonly statusCode: number;
  readonly body: AuthorizationTransportErrorBody;
} {
  return Object.freeze({
    statusCode: toHttpStatusCode(result.failure.code),
    body: toErrorBody(result.failure),
  });
}

export function mapAuthorizationFailureToWebSocketClose(result: AuthorizationTransportGuardDenied): {
  readonly closeCode: number;
  readonly reason: string;
  readonly error: AuthorizationTransportErrorBody["error"];
} {
  return Object.freeze({
    closeCode: toWebSocketCloseCode(result.failure.code),
    reason: result.failure.message,
    error: toErrorBody(result.failure).error,
  });
}

function toHttpStatusCode(code: AuthorizationTransportFailure["code"]): number {
  if (code === AuthorizationTransportFailureCodes.unauthorized) {
    return 401;
  }
  if (code === AuthorizationTransportFailureCodes.forbidden) {
    return 403;
  }
  if (code === AuthorizationTransportFailureCodes.invalidRequest) {
    return 400;
  }
  return 500;
}

function toWebSocketCloseCode(code: AuthorizationTransportFailure["code"]): number {
  if (code === AuthorizationTransportFailureCodes.unauthorized) {
    return 4401;
  }
  if (code === AuthorizationTransportFailureCodes.forbidden) {
    return 4403;
  }
  if (code === AuthorizationTransportFailureCodes.invalidRequest) {
    return 4400;
  }
  return 1011;
}

function toIpcErrorMessage(failure: AuthorizationTransportFailure): string {
  return `${failure.code}:${failure.message}`;
}

function toErrorBody(failure: AuthorizationTransportFailure): AuthorizationTransportErrorBody {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: failure.code,
      message: failure.message,
      reasonCode: failure.reasonCode,
      denialReason: failure.denialReason,
    }),
  });
}

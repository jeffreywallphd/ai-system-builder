import {
  ValidateTransportConnectionTrustErrorCodes,
  type ValidateTransportConnectionTrustOutcome,
  type ValidateTransportConnectionTrustUseCase,
} from "../../application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import type { ValidateTransportConnectionTrustRequest } from "../../application/security/ports/TransportTrustValidationPorts";
import {
  TransportConnectionRejectionReasons,
} from "../../domain/security/TransportSecurityDomain";

export const TransportTrustValidationTransportErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  unauthorized: "authentication-failed",
  forbidden: "forbidden",
  internal: "internal",
});

export type TransportTrustValidationTransportErrorCode =
  typeof TransportTrustValidationTransportErrorCodes[keyof typeof TransportTrustValidationTransportErrorCodes];

export interface TransportTrustValidationTransportError {
  readonly code: TransportTrustValidationTransportErrorCode;
  readonly message: string;
  readonly reasons?: ReadonlyArray<{
    readonly code: string;
    readonly category: string;
    readonly message: string;
  }>;
}

export interface HttpTransportTrustValidationDenied {
  readonly ok: false;
  readonly statusCode: number;
  readonly body: {
    readonly ok: false;
    readonly error: TransportTrustValidationTransportError;
  };
}

export type HttpTransportTrustValidationResult =
  | {
    readonly ok: true;
    readonly decision: Extract<ValidateTransportConnectionTrustOutcome, { readonly ok: true }>["value"];
  }
  | HttpTransportTrustValidationDenied;

export interface WebSocketTransportTrustValidationDenied {
  readonly ok: false;
  readonly closeCode: number;
  readonly reason: string;
  readonly error: TransportTrustValidationTransportError;
}

export type WebSocketTransportTrustValidationResult =
  | {
    readonly ok: true;
    readonly decision: Extract<ValidateTransportConnectionTrustOutcome, { readonly ok: true }>["value"];
  }
  | WebSocketTransportTrustValidationDenied;

type TransportTrustValidator = Pick<ValidateTransportConnectionTrustUseCase, "execute">;

export class HttpTransportTrustValidationAdapter {
  public constructor(private readonly validator: TransportTrustValidator) {}

  public async validate(
    request: ValidateTransportConnectionTrustRequest,
  ): Promise<HttpTransportTrustValidationResult> {
    const outcome = await this.validator.execute(request);
    if (outcome.ok && outcome.value.trustValidation.accepted) {
      return Object.freeze({
        ok: true,
        decision: outcome.value,
      });
    }

    const denied = mapTrustValidationOutcomeToTransportError(outcome);
    return Object.freeze({
      ok: false,
      statusCode: denied.statusCode,
      body: Object.freeze({
        ok: false,
        error: denied.error,
      }),
    });
  }
}

export class WebSocketTransportTrustValidationAdapter {
  public constructor(private readonly validator: TransportTrustValidator) {}

  public async validate(
    request: ValidateTransportConnectionTrustRequest,
  ): Promise<WebSocketTransportTrustValidationResult> {
    const outcome = await this.validator.execute(request);
    if (outcome.ok && outcome.value.trustValidation.accepted) {
      return Object.freeze({
        ok: true,
        decision: outcome.value,
      });
    }

    const denied = mapTrustValidationOutcomeToTransportError(outcome);
    return Object.freeze({
      ok: false,
      closeCode: mapStatusCodeToWebSocketCloseCode(denied.statusCode),
      reason: denied.error.message,
      error: denied.error,
    });
  }
}

function mapTrustValidationOutcomeToTransportError(outcome: ValidateTransportConnectionTrustOutcome): {
  readonly statusCode: number;
  readonly error: TransportTrustValidationTransportError;
} {
  if (!outcome.ok) {
    if (outcome.error.code === ValidateTransportConnectionTrustErrorCodes.invalidRequest) {
      return Object.freeze({
        statusCode: 400,
        error: Object.freeze({
          code: TransportTrustValidationTransportErrorCodes.invalidRequest,
          message: outcome.error.message,
        }),
      });
    }

    return Object.freeze({
      statusCode: 500,
      error: Object.freeze({
        code: TransportTrustValidationTransportErrorCodes.internal,
        message: "Transport trust validation failed unexpectedly.",
      }),
    });
  }

  const rejectionReasons = outcome.value.trustValidation.rejectionReasons;
  const failureReasons = outcome.value.failureReasons;
  const authenticationFailure = rejectionReasons.includes(
    TransportConnectionRejectionReasons.missingAuthenticatedUserSession,
  );
  if (authenticationFailure) {
    return Object.freeze({
      statusCode: 401,
      error: Object.freeze({
        code: TransportTrustValidationTransportErrorCodes.unauthorized,
        message: "Authenticated transport session is required.",
        reasons: Object.freeze(failureReasons.map((reason) => Object.freeze({
          code: reason.code,
          category: reason.category,
          message: reason.safeMessage,
        }))),
      }),
    });
  }

  const malformedConnection = rejectionReasons.includes(TransportConnectionRejectionReasons.invalidPolicy)
    || rejectionReasons.includes(TransportConnectionRejectionReasons.scenarioMismatch)
    || rejectionReasons.includes(TransportConnectionRejectionReasons.actorTypeMismatch);
  if (malformedConnection) {
    return Object.freeze({
      statusCode: 400,
      error: Object.freeze({
        code: TransportTrustValidationTransportErrorCodes.invalidRequest,
        message: "Transport trust request is invalid for the selected policy.",
        reasons: Object.freeze(failureReasons.map((reason) => Object.freeze({
          code: reason.code,
          category: reason.category,
          message: reason.safeMessage,
        }))),
      }),
    });
  }

  return Object.freeze({
    statusCode: 403,
    error: Object.freeze({
      code: TransportTrustValidationTransportErrorCodes.forbidden,
      message: "Transport trust validation rejected this connection.",
      reasons: Object.freeze(failureReasons.map((reason) => Object.freeze({
        code: reason.code,
        category: reason.category,
        message: reason.safeMessage,
      }))),
    }),
  });
}

function mapStatusCodeToWebSocketCloseCode(statusCode: number): number {
  if (statusCode === 400) {
    return 4400;
  }
  if (statusCode === 401) {
    return 4401;
  }
  if (statusCode === 403) {
    return 4403;
  }
  return 1011;
}


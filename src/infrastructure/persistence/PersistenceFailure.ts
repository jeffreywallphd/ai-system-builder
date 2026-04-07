export const PersistenceFailureCodes = Object.freeze({
  conflict: "persistence-conflict",
  concurrencyConflict: "persistence-concurrency-conflict",
  unavailable: "persistence-unavailable",
  notFound: "persistence-not-found",
  permissionDenied: "persistence-permission-denied",
  invalidRequest: "persistence-invalid-request",
  internal: "persistence-internal",
});

export type PersistenceFailureCode =
  typeof PersistenceFailureCodes[keyof typeof PersistenceFailureCodes];

export interface PersistenceFailureOptions {
  readonly retryable?: boolean;
  readonly repository?: string;
  readonly operation?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class PersistenceFailure extends Error {
  public readonly code: PersistenceFailureCode;

  public readonly retryable: boolean;

  public readonly repository?: string;

  public readonly operation?: string;

  public readonly diagnostics?: Readonly<Record<string, unknown>>;

  public constructor(
    code: PersistenceFailureCode,
    message: string,
    options: PersistenceFailureOptions = {},
  ) {
    super(message);
    this.name = "PersistenceFailure";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.repository = options.repository;
    this.operation = options.operation;
    this.diagnostics = options.diagnostics;
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

export function isPersistenceFailure(error: unknown): error is PersistenceFailure {
  return error instanceof PersistenceFailure;
}

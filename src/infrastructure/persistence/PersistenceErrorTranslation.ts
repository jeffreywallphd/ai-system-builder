import {
  PersistenceFailure,
  PersistenceFailureCodes,
  type PersistenceFailureCode,
} from "./PersistenceFailure";
import { sanitizePersistenceDiagnostics } from "../logging/PersistenceRedaction";

export interface TranslatePersistenceErrorInput {
  readonly repository: string;
  readonly operation: string;
  readonly error: unknown;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

interface PersistenceErrorClassification {
  readonly code: PersistenceFailureCode;
  readonly retryable: boolean;
  readonly reason: string;
}

const SqliteConstraintErrorCodes = new Set([
  "SQLITE_CONSTRAINT",
  "SQLITE_CONSTRAINT_UNIQUE",
  "SQLITE_CONSTRAINT_PRIMARYKEY",
  "SQLITE_CONSTRAINT_FOREIGNKEY",
]);

const RetryablePersistenceErrorCodes = new Set([
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "SQLITE_CANTOPEN",
  "SQLITE_IOERR",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EAGAIN",
  "EBUSY",
]);

const PermissionDeniedErrorCodes = new Set([
  "EACCES",
  "EPERM",
]);

const NotFoundErrorCodes = new Set([
  "ENOENT",
]);

const ConflictErrorCodes = new Set([
  "EEXIST",
]);

export function translatePersistenceError(input: TranslatePersistenceErrorInput): PersistenceFailure {
  if (input.error instanceof PersistenceFailure) {
    return input.error;
  }

  const classification = classifyPersistenceError(input.error);
  const sanitizedDiagnostics = input.diagnostics
    ? sanitizePersistenceDiagnostics(input.diagnostics)
    : undefined;

  return new PersistenceFailure(
    classification.code,
    `${input.repository} persistence failed to ${input.operation}.`,
    {
      repository: input.repository,
      operation: input.operation,
      retryable: classification.retryable,
      diagnostics: Object.freeze({
        reason: classification.reason,
        ...sanitizedDiagnostics,
      }),
      cause: input.error,
    },
  );
}

function classifyPersistenceError(error: unknown): PersistenceErrorClassification {
  const code = resolveErrorCode(error);
  const message = resolveErrorMessage(error);

  if (
    code === "PersistenceOptimisticConcurrencyError"
    || message.toLowerCase().includes("expectedrevision")
  ) {
    return Object.freeze({
      code: PersistenceFailureCodes.concurrencyConflict,
      retryable: false,
      reason: "optimistic-concurrency-conflict",
    });
  }

  if (code && SqliteConstraintErrorCodes.has(code)) {
    return Object.freeze({
      code: PersistenceFailureCodes.conflict,
      retryable: false,
      reason: "sqlite-constraint",
    });
  }

  if (code && ConflictErrorCodes.has(code)) {
    return Object.freeze({
      code: PersistenceFailureCodes.conflict,
      retryable: false,
      reason: "already-exists",
    });
  }

  if (code && RetryablePersistenceErrorCodes.has(code)) {
    return Object.freeze({
      code: PersistenceFailureCodes.unavailable,
      retryable: true,
      reason: "persistence-backend-unavailable",
    });
  }

  if (code && NotFoundErrorCodes.has(code)) {
    return Object.freeze({
      code: PersistenceFailureCodes.notFound,
      retryable: false,
      reason: "persisted-record-not-found",
    });
  }

  if (code && PermissionDeniedErrorCodes.has(code)) {
    return Object.freeze({
      code: PersistenceFailureCodes.permissionDenied,
      retryable: false,
      reason: "persistence-permission-denied",
    });
  }

  if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("malformed")) {
    return Object.freeze({
      code: PersistenceFailureCodes.invalidRequest,
      retryable: false,
      reason: "invalid-persistence-request",
    });
  }

  return Object.freeze({
    code: PersistenceFailureCodes.internal,
    retryable: false,
    reason: "unknown-persistence-failure",
  });
}

function resolveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = (error as { code?: unknown }).code;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name.trim();
  }

  return undefined;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

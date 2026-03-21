import { normalizeRuntimeError, type RuntimeDiagnostics, type RuntimeDiagnosticsContext } from "./RuntimeDiagnostics";

export interface RuntimeDiagnosticsErrorParams extends RuntimeDiagnosticsContext {
  readonly cause?: unknown;
  readonly name?: string;
}

export class RuntimeDiagnosticsError extends Error {
  public readonly diagnostics: RuntimeDiagnostics;
  public readonly details?: unknown;
  public readonly statusCode?: number;

  constructor(message: string, params: RuntimeDiagnosticsErrorParams = {}) {
    super(message, params.cause === undefined ? undefined : { cause: params.cause });
    this.name = params.name?.trim() || "RuntimeDiagnosticsError";
    this.details = params.details;
    this.statusCode = params.statusCode;
    this.diagnostics = normalizeRuntimeError(params.cause ?? this, {
      ...params,
      message,
      details: params.details,
      statusCode: params.statusCode,
    });
  }
}

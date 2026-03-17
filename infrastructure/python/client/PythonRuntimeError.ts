export class PythonRuntimeError extends Error {
  public readonly statusCode?: number;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(message: string, params: { statusCode?: number; details?: Readonly<Record<string, unknown>> } = {}) {
    super(message);
    this.name = "PythonRuntimeError";
    this.statusCode = params.statusCode;
    this.details = params.details;
  }
}

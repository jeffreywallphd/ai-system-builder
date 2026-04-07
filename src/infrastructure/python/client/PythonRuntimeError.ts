import {
  RuntimeDiagnosticsError,
  type RuntimeDiagnosticsErrorParams,
} from "../../../application/runtime/RuntimeDiagnosticsError";

export class PythonRuntimeError extends RuntimeDiagnosticsError {
  constructor(message: string, params: RuntimeDiagnosticsErrorParams = {}) {
    super(message, {
      ...params,
      name: "PythonRuntimeError",
    });
  }
}

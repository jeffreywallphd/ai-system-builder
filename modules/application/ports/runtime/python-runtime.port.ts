import {
  PythonRuntimeTaskRequest,
  PythonRuntimeTaskResult
} from "../../../contracts/runtime";

export interface PythonRuntimePort {
  executeTask(
    request: PythonRuntimeTaskRequest
  ): Promise<PythonRuntimeTaskResult>;
}

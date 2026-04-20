import type {
  PythonRuntimeCapabilitiesResult,
  PythonRuntimeHealthCheckResult,
  PythonRuntimeTaskRequest,
  PythonRuntimeTaskResult,
} from "../../../../contracts/runtime";

export function mapTaskRequestToHttpPayload(
  request: PythonRuntimeTaskRequest,
): PythonRuntimeTaskRequest {
  return request;
}

export function mapHealthResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeHealthCheckResult {
  return payload as PythonRuntimeHealthCheckResult;
}

export function mapCapabilitiesResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeCapabilitiesResult {
  return payload as PythonRuntimeCapabilitiesResult;
}

export function mapTaskResponseFromHttpPayload(
  payload: unknown,
): PythonRuntimeTaskResult {
  return payload as PythonRuntimeTaskResult;
}

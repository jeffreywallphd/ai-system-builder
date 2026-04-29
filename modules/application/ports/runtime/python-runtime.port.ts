import {
  CancelRuntimeTaskResult,
  PythonRuntimeCapabilitiesResult,
  PythonRuntimeHealthCheckResult,
  PythonRuntimeModelStatusResult,
  RuntimeTaskRecord,
  StartRuntimeTaskRequest,
  StartRuntimeTaskResult,
  PythonRuntimeUnloadModelsResult
} from "../../../contracts/runtime";

export interface PythonRuntimePort {
  startTask(request: StartRuntimeTaskRequest): Promise<StartRuntimeTaskResult>;
  readTaskStatus(requestId: string): Promise<RuntimeTaskRecord>;
  cancelTask(requestId: string): Promise<CancelRuntimeTaskResult>;
  getHealthStatus(): Promise<PythonRuntimeHealthCheckResult>;
  getCapabilities(): Promise<PythonRuntimeCapabilitiesResult>;
  ensureModelDownloaded(request: { provider: "transformers"; modelId: string }): Promise<{
    provider: "transformers";
    modelId: string;
    downloaded: boolean;
    fromCache: boolean;
    localPath?: string;
  }>;
  getModelStatus(): Promise<PythonRuntimeModelStatusResult>;
  unloadModels(): Promise<PythonRuntimeUnloadModelsResult>;
}

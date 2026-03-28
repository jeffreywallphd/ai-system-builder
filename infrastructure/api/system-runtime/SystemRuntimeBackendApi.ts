import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import {
  SystemRuntimeApplicationService,
  type RuntimeExecutionResultReadModel,
  type RuntimeExecutionStatusReadModel,
  type RuntimeExecutionTraceReadModel,
  type StartSystemRuntimeExecutionRequest,
} from "../../../application/system-runtime/SystemRuntimeApplicationService";

export type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
};

export interface SystemRuntimeApiError {
  readonly code: "not-found" | "invalid-request" | "internal";
  readonly message: string;
}

export interface SystemRuntimeApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: SystemRuntimeApiError;
}

export interface StartSystemRuntimeExecutionResponse {
  readonly executionId: string;
  readonly status: RuntimeExecutionStatusReadModel["status"];
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly runtimeBehavior: {
    readonly behaviorKind: string;
    readonly executionPattern: string;
  };
}

export interface GetSystemRuntimeExecutionTraceRequest {
  readonly executionId: string;
  readonly eventLimit?: number;
  readonly logLimit?: number;
}

export class SystemRuntimeBackendApi {
  private readonly service: SystemRuntimeApplicationService;

  public constructor(repository: IStudioShellRepository) {
    this.service = new SystemRuntimeApplicationService(repository);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    return this.wrap(async () => {
      const started = await this.service.startExecution(request);
      return Object.freeze({
        executionId: started.execution.executionId,
        status: started.execution.status,
        rootAssetId: started.execution.root.assetId,
        rootVersionId: started.execution.root.versionId,
        runtimeBehavior: Object.freeze({
          behaviorKind: started.runtimeBehavior.behaviorKind,
          executionPattern: started.runtimeBehavior.executionPattern,
        }),
      });
    });
  }

  public async getExecutionStatus(executionId: string): Promise<SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>> {
    return this.wrap(async () => this.service.getExecutionStatus(executionId));
  }

  public async getExecutionTrace(request: GetSystemRuntimeExecutionTraceRequest): Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>> {
    return this.wrap(async () => this.service.getExecutionTrace(request.executionId, {
      eventLimit: request.eventLimit,
      logLimit: request.logLimit,
    }));
  }

  public async getExecutionResult(executionId: string): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>> {
    return this.wrap(async () => this.service.getExecutionResult(executionId));
  }

  private async wrap<T>(action: () => Promise<T>): Promise<SystemRuntimeApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): SystemRuntimeApiError {
    const message = error instanceof Error ? error.message : "Unexpected backend runtime error.";
    if (message.startsWith("not-found:")) {
      return Object.freeze({ code: "not-found", message: message.slice("not-found:".length) });
    }
    if (message.startsWith("invalid-request:")) {
      return Object.freeze({ code: "invalid-request", message: message.slice("invalid-request:".length) });
    }

    return Object.freeze({ code: "internal", message });
  }
}

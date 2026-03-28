import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import {
  SystemRuntimeApplicationService,
  type RuntimeExecutionResultReadModel,
  type RuntimeExecutionStatusReadModel,
  type RuntimeExecutionSummaryReadModel,
  type RuntimeExecutionTraceReadModel,
  type StartSystemRuntimeExecutionRequest,
} from "../../../application/system-runtime/SystemRuntimeApplicationService";
import type { ISystemRuntimeExecutionStore } from "../../../application/system-runtime/SystemRuntimeExecutionStore";
import { RuntimeAccessControlService, type ExecutionAccessContext } from "../../../application/system-runtime/RuntimeAccessControlService";

export type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
};

export interface SystemRuntimeApiError {
  readonly code: "not-found" | "invalid-request" | "forbidden" | "internal";
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
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
}

export interface GetSystemRuntimeExecutionTraceRequest {
  readonly executionId: string;
  readonly eventLimit?: number;
  readonly logLimit?: number;
}

export interface GetSystemRuntimeExecutionResultRequest {
  readonly executionId: string;
  readonly nodeResultLimit?: number;
  readonly diagnosticsLimit?: number;
}

export class SystemRuntimeBackendApi {
  private readonly service: SystemRuntimeApplicationService;

  public constructor(
    repository: IStudioShellRepository,
    executionStore?: ISystemRuntimeExecutionStore,
    private readonly runtimeAccessControl = new RuntimeAccessControlService(),
  ) {
    this.service = new SystemRuntimeApplicationService(repository, executionStore);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest & { readonly accessContext?: ExecutionAccessContext; readonly systemId?: string; }): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    return this.wrap(async () => {
      this.assertExecutionAccess(request);
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
        executedVersionMap: Object.freeze({
          rootVersionId: started.execution.root.versionId,
          nodeVersionIds: Object.freeze(Object.fromEntries(started.execution.nodes
            .filter((node) => Boolean(node.target.versionId))
            .map((node) => [node.executionNodeId, node.target.versionId!])
            .sort(([left], [right]) => left.localeCompare(right)))),
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
    return this.getExecutionResultBounded({ executionId });
  }

  public async getExecutionResultBounded(request: GetSystemRuntimeExecutionResultRequest): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>> {
    return this.wrap(async () => {
      const base = this.service.getExecutionResult(request.executionId);
      const nodeResultLimit = this.normalizeOptionalBoundedInteger(request.nodeResultLimit, 1, 500, "nodeResultLimit");
      const diagnosticsLimit = this.normalizeOptionalBoundedInteger(request.diagnosticsLimit, 1, 500, "diagnosticsLimit");
      return Object.freeze({
        ...base,
        nodeResults: Object.freeze(nodeResultLimit ? base.nodeResults.slice(0, nodeResultLimit) : [...base.nodeResults]),
        diagnostics: Object.freeze(diagnosticsLimit ? base.diagnostics.slice(0, diagnosticsLimit) : [...base.diagnostics]),
      });
    });
  }

  public async listRecentExecutionsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): Promise<SystemRuntimeApiResponse<ReadonlyArray<RuntimeExecutionSummaryReadModel>>> {
    return this.wrap(async () => this.service.listRecentExecutionsForSystem(input));
  }


  private assertExecutionAccess(request: { readonly accessContext?: ExecutionAccessContext; readonly systemId?: string; readonly versionId?: string }): void {
    const decision = this.runtimeAccessControl.evaluate({
      context: request.accessContext,
      systemId: request.systemId,
      versionId: request.versionId,
    });

    if (!decision.allowed) {
      const reason = decision.reasonCode ? ` (${decision.reasonCode})` : "";
      throw new Error(`forbidden:${decision.message ?? `Runtime execution was denied by access policy${reason}.`}`);
    }
  }

  private normalizeOptionalBoundedInteger(value: number | undefined, min: number, max: number, label: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!Number.isFinite(value) || Math.floor(value) !== value) {
      throw new Error(`invalid-request:${label} must be an integer.`);
    }
    if (value < min || value > max) {
      throw new Error(`invalid-request:${label} must be between ${min} and ${max}.`);
    }
    return value;
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
    if (message.startsWith("forbidden:")) {
      return Object.freeze({ code: "forbidden", message: message.slice("forbidden:".length) });
    }

    return Object.freeze({ code: "internal", message });
  }
}

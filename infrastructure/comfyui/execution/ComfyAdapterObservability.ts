import type {
  IComfyAdapterError,
  IComfyAdapterExecutionContext,
  IComfyAdapterLifecycleEvent,
} from "../../../application/execution/comfyui/ComfyAdapterContract";

export interface IComfyAdapterLogEvent {
  readonly scope: "comfyui-adapter";
  readonly event:
    | "request-accepted"
    | "execution-started"
    | "execution-completed"
    | "execution-failed"
    | "execution-cancelled";
  readonly timestamp: string;
  readonly executionId?: string;
  readonly workflowId?: string;
  readonly workflowVersionId?: string;
  readonly parentExecutionId?: string;
  readonly correlationId?: string;
  readonly lineageId?: string;
  readonly status?: IComfyAdapterLifecycleEvent["status"];
  readonly durationMs?: number;
  readonly outputCount?: number;
  readonly errorCode?: IComfyAdapterError["code"];
  readonly errorCategory?: IComfyAdapterError["category"];
  readonly retriable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterLogger {
  log(event: IComfyAdapterLogEvent): void;
}

export class ComfyAdapterObservability {
  constructor(private readonly logger?: IComfyAdapterLogger) {}

  public requestAccepted(params: {
    readonly context?: IComfyAdapterExecutionContext;
    readonly runtimeOptions?: Readonly<Record<string, unknown>>;
  }): void {
    this.emit("request-accepted", params.context, undefined, {
      runtimeOptionKeys: Object.keys(params.runtimeOptions ?? {}),
    });
  }

  public executionStarted(params: {
    readonly executionId: string;
    readonly context?: IComfyAdapterExecutionContext;
  }): void {
    this.emit("execution-started", params.context, params.executionId);
  }

  public executionCompleted(params: {
    readonly executionId: string;
    readonly context?: IComfyAdapterExecutionContext;
    readonly durationMs: number;
    readonly outputCount: number;
  }): void {
    this.emit("execution-completed", params.context, params.executionId, {
      durationMs: params.durationMs,
      outputCount: params.outputCount,
      status: "completed",
    });
  }

  public executionFailed(params: {
    readonly executionId?: string;
    readonly context?: IComfyAdapterExecutionContext;
    readonly durationMs?: number;
    readonly error: IComfyAdapterError;
  }): void {
    this.emit("execution-failed", params.context, params.executionId, {
      durationMs: params.durationMs,
      status: "failed",
      errorCode: params.error.code,
      errorCategory: params.error.category,
      retriable: params.error.retriable,
    });
  }

  public executionCancelled(params: {
    readonly executionId: string;
    readonly context?: IComfyAdapterExecutionContext;
    readonly durationMs?: number;
  }): void {
    this.emit("execution-cancelled", params.context, params.executionId, {
      durationMs: params.durationMs,
      status: "cancelled",
    });
  }

  private emit(
    event: IComfyAdapterLogEvent["event"],
    context?: IComfyAdapterExecutionContext,
    executionId?: string,
    extra: Partial<IComfyAdapterLogEvent> = {},
  ): void {
    this.logger?.log(Object.freeze({
      scope: "comfyui-adapter",
      event,
      timestamp: new Date().toISOString(),
      executionId,
      workflowId: context?.identifiers.workflowId,
      workflowVersionId: context?.identifiers.workflowVersionId,
      parentExecutionId: context?.identifiers.parentExecutionId,
      correlationId: context?.observability?.correlationId,
      lineageId: context?.observability?.lineageId,
      ...extra,
    }));
  }
}

import type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
  StartSystemRuntimeExecutionResponse,
  SystemRuntimeApiResponse,
} from "../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import { RunContextKinds, RunInterfaceService, type RunLaunchRequest } from "../routes/RunInterface";

export const UxRunActionKinds = Object.freeze({
  run: "run",
  test: "test",
});

export type UxRunActionKind = typeof UxRunActionKinds[keyof typeof UxRunActionKinds];

export interface UxRunContext {
  readonly source: "build" | "explore" | "detail" | "system" | "run" | "direct";
  readonly buildFlowSessionId?: string;
  readonly buildIntent?: string;
  readonly buildIntentSelectedAt?: string;
  readonly registryContextQuery?: string;
  readonly originPath?: string;
  readonly originLabel?: string;
}

export interface UxRunRequest {
  readonly action: UxRunActionKind;
  readonly context: UxRunContext;
  readonly target: {
    readonly kind: "asset" | "workflow" | "system" | "tool" | "general";
    readonly assetId?: string;
    readonly versionId?: string;
  };
}

export interface UxRunStatus {
  readonly state: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  readonly isTerminal: boolean;
  readonly progressLabel: string;
  readonly recoveryLabel: string;
  readonly errorCount: number;
}

export interface UxRunResult {
  readonly runId: string;
  readonly statusLabel: string;
  readonly hasOutput: boolean;
  readonly outputFieldCount: number;
  readonly diagnosticsCount: number;
}

export interface UxRunMonitoringSnapshot {
  readonly status: UxRunStatus;
  readonly trace?: {
    readonly eventCount: number;
    readonly logCount: number;
    readonly recentEvents: ReadonlyArray<{ readonly id: string; readonly kind: string; readonly summary?: string; readonly nodeId?: string }>;
    readonly recentLogs: ReadonlyArray<{ readonly id: string; readonly level: string; readonly message: string }>;
  };
  readonly result?: UxRunResult;
  readonly raw: {
    readonly status: RuntimeExecutionStatusReadModel;
    readonly trace?: RuntimeExecutionTraceReadModel;
    readonly result?: RuntimeExecutionResultReadModel;
  };
}

export interface UxRuntimeResultAdapter {
  toStatus(input: RuntimeExecutionStatusReadModel): UxRunStatus;
  toResult(runId: string, input: RuntimeExecutionResultReadModel): UxRunResult;
}

export class DefaultUxRuntimeResultAdapter implements UxRuntimeResultAdapter {
  public toStatus(input: RuntimeExecutionStatusReadModel): UxRunStatus {
    const state = input.status === "running"
      ? "running"
      : input.status === "succeeded"
        ? "succeeded"
        : input.status === "failed"
          ? "failed"
          : input.status === "cancelled"
            ? "cancelled"
            : "pending";
    return Object.freeze({
      state,
      isTerminal: state === "succeeded" || state === "failed" || state === "cancelled",
      progressLabel: `${input.progress.completedNodeCount}/${input.progress.totalNodeCount} nodes`,
      recoveryLabel: `${input.recovery.decisionCount} decisions (${input.recovery.retryDecisionCount} retries)`,
      errorCount: input.errorCount,
    });
  }

  public toResult(runId: string, input: RuntimeExecutionResultReadModel): UxRunResult {
    return Object.freeze({
      runId,
      statusLabel: input.status,
      hasOutput: input.outputSummary.hasOutput,
      outputFieldCount: input.outputSummary.outputFieldCount,
      diagnosticsCount: input.diagnostics.length,
    });
  }
}

export interface UxRuntimeRequestMapper {
  toRunLaunchRequest(input: UxRunRequest): RunLaunchRequest;
  withContext(launchPath: string, context: UxRunContext): string;
}

export class DefaultUxRuntimeRequestMapper implements UxRuntimeRequestMapper {
  public toRunLaunchRequest(input: UxRunRequest): RunLaunchRequest {
    return Object.freeze({
      contextKind: input.target.kind === "system"
        ? RunContextKinds.system
        : input.target.kind === "workflow"
          ? RunContextKinds.workflow
        : input.target.kind === "tool"
          ? RunContextKinds.tool
          : input.target.kind === "asset"
            ? RunContextKinds.asset
            : RunContextKinds.general,
      workflowId: input.target.kind === "workflow" ? input.target.assetId : undefined,
      assetId: input.target.assetId,
      versionId: input.target.versionId,
      source: input.context.source === "system" ? "detail" : input.context.source,
      runIntentLabel: input.action === UxRunActionKinds.test ? "Test here" : "Run here",
      actionKind: input.action,
      originPath: input.context.originPath,
      originLabel: input.context.originLabel,
    });
  }

  public withContext(launchPath: string, context: UxRunContext): string {
    const [routePath, search] = launchPath.split("?");
    const params = new URLSearchParams(search ?? "");
    if (context.registryContextQuery) {
      params.set("registryContext", context.registryContextQuery);
    }
    if (context.buildFlowSessionId) {
      params.set("buildFlowSessionId", context.buildFlowSessionId);
    }
    if (context.buildIntent) {
      params.set("buildIntent", context.buildIntent);
    }
    if (context.buildIntentSelectedAt) {
      params.set("buildIntentSelectedAt", context.buildIntentSelectedAt);
    }
    return `${routePath}?${params.toString()}`;
  }
}

export interface UxRuntimeOperations {
  readonly startSystemExecution?: (request: StartSystemRuntimeExecutionRequest) => Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>>;
  readonly getSystemExecutionStatus?: (executionId: string) => Promise<SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>>;
  readonly getSystemExecutionTrace?: (request: { readonly executionId: string; readonly eventLimit?: number; readonly logLimit?: number }) => Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>>;
  readonly getSystemExecutionResult?: (executionId: string) => Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>>;
}

export class UxRuntimeService {
  private readonly runInterface = new RunInterfaceService();

  public constructor(
    private readonly mapper: UxRuntimeRequestMapper = new DefaultUxRuntimeRequestMapper(),
    private readonly adapter: UxRuntimeResultAdapter = new DefaultUxRuntimeResultAdapter(),
  ) {}

  public resolveRunSurfacePath(request: UxRunRequest): string {
    return this.mapper.withContext(
      this.runInterface.resolveLaunchPath(this.mapper.toRunLaunchRequest(request)),
      request.context,
    );
  }

  public async launchSystemRun(
    request: StartSystemRuntimeExecutionRequest,
    operations: UxRuntimeOperations,
  ): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    if (!operations.startSystemExecution) {
      return Object.freeze({ ok: false, error: { code: "unsupported", message: "System runtime launch is unavailable in this context." } });
    }
    return operations.startSystemExecution(request);
  }

  public async readSystemRunSnapshot(
    executionId: string,
    operations: UxRuntimeOperations,
  ): Promise<{ readonly ok: boolean; readonly data?: UxRunMonitoringSnapshot; readonly message?: string }> {
    if (!operations.getSystemExecutionStatus) {
      return Object.freeze({ ok: false, message: "System runtime status is unavailable in this context." });
    }

    const [statusResponse, traceResponse, resultResponse] = await Promise.all([
      operations.getSystemExecutionStatus(executionId),
      operations.getSystemExecutionTrace?.({ executionId, eventLimit: 20, logLimit: 20 }),
      operations.getSystemExecutionResult?.(executionId),
    ]);

    if (!statusResponse.ok || !statusResponse.data) {
      return Object.freeze({ ok: false, message: statusResponse.error?.message ?? "Unable to read run status." });
    }

    const trace = traceResponse?.ok && traceResponse.data
      ? Object.freeze({
        eventCount: traceResponse.data.trace.events.length,
        logCount: traceResponse.data.trace.logs.length,
        recentEvents: Object.freeze(traceResponse.data.trace.events.slice(-8).map((event) => Object.freeze({
          id: event.eventId,
          kind: event.kind,
          summary: event.summary,
          nodeId: event.nodeId,
        }))),
        recentLogs: Object.freeze(traceResponse.data.trace.logs.slice(-6).map((entry) => Object.freeze({
          id: entry.entryId,
          level: entry.level,
          message: entry.message,
        }))),
      })
      : undefined;

    const mappedResult = resultResponse?.ok && resultResponse.data
      ? this.adapter.toResult(executionId, resultResponse.data)
      : undefined;

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        status: this.adapter.toStatus(statusResponse.data),
        trace,
        result: mappedResult,
        raw: Object.freeze({
          status: statusResponse.data,
          trace: traceResponse?.ok ? traceResponse.data : undefined,
          result: resultResponse?.ok ? resultResponse.data : undefined,
        }),
      }),
    });
  }
}

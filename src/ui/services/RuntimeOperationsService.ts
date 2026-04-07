import type {
  RuntimeSdkExecutionContext,
  RuntimeQueueItemStatus,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusResponse,
  RuntimeSdkStartExecutionRequest,
  RuntimeSdkStartExecutionResponse,
  RuntimeSdkExecutionTraceResponse,
  RuntimeSdkResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  HttpRuntimeControlClient,
  type RuntimeControlClient,
} from "@shared/runtime/RuntimeControlClient";
import {
  IdentityAuthSessionStore,
  type IdentityAuthPersistedSession,
} from "@shared/identity/IdentityAuthSessionStore";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

interface RuntimeOperationsError {
  readonly code: RuntimeSdkResponse<unknown>["error"] extends { code: infer TCode } ? TCode : string;
  readonly message: string;
}

interface RuntimeSessionContext {
  readonly sessionToken: string;
  readonly workspaceId: string;
}

export interface RuntimeRunInspectionSummary {
  readonly executionId: string;
  readonly status: RuntimeSdkExecutionStatusResponse["status"];
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly progressLabel: string;
  readonly diagnosticsCount?: number;
  readonly traceEventCount?: number;
  readonly traceLogCount?: number;
  readonly outputFieldCount?: number;
  readonly outputContractIds?: ReadonlyArray<string>;
  readonly outputAssetIds?: ReadonlyArray<string>;
}

export class RuntimeOperationsService {
  private readonly client: RuntimeControlClient;

  public constructor(
    client: RuntimeControlClient = createDefaultRuntimeControlClient(),
    private readonly sessionStore = new IdentityAuthSessionStore(),
  ) {
    this.client = client;
  }

  public async listQueueItems(input?: {
    readonly statuses?: ReadonlyArray<RuntimeQueueItemStatus>;
    readonly limit?: number;
    readonly offset?: number;
    readonly systemId?: string;
  }): Promise<RuntimeSdkResponse<{ readonly items: ReadonlyArray<{
    readonly queueItemId: string;
    readonly executionId: string;
    readonly systemId: string;
    readonly status: RuntimeQueueItemStatus;
    readonly enqueuedAt: string;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly priority?: number;
  }>; readonly totalCount: number }>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.listQueueItems({
      workspaceId: context.value.workspaceId,
      statuses: input?.statuses,
      limit: input?.limit,
      offset: input?.offset,
      systemId: input?.systemId,
    }, context.value.sessionToken);
  }

  public async dequeueQueueItem(input: {
    readonly queueItemId: string;
    readonly reason?: string;
    readonly idempotencyKey?: string;
  }): Promise<RuntimeSdkResponse<{ readonly queueItemId: string; readonly executionId: string; readonly status: RuntimeQueueItemStatus; readonly mutation: { readonly changed: boolean; readonly mutationId?: string; readonly occurredAt?: string; } }>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.dequeueQueueItem({
      workspaceId: context.value.workspaceId,
      queueItemId: input.queueItemId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    }, context.value.sessionToken);
  }

  public async cancelRun(input: {
    readonly executionId: string;
    readonly reason?: string;
    readonly idempotencyKey?: string;
  }): Promise<RuntimeSdkResponse<{ readonly executionId: string; readonly status: RuntimeSdkExecutionStatusResponse["status"]; readonly mutation: { readonly changed: boolean; readonly mutationId?: string; readonly occurredAt?: string; } }>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.cancelRun({
      workspaceId: context.value.workspaceId,
      executionId: input.executionId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    }, context.value.sessionToken);
  }

  public async getRunStatus(executionId: string): Promise<RuntimeSdkResponse<RuntimeSdkExecutionStatusResponse>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.getRunStatus({
      workspaceId: context.value.workspaceId,
      executionId,
    }, context.value.sessionToken);
  }

  public async getRunResult(input: {
    readonly executionId: string;
    readonly nodeResultLimit?: number;
    readonly diagnosticsLimit?: number;
  }): Promise<RuntimeSdkResponse<RuntimeSdkExecutionResultResponse>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.getRunResult({
      workspaceId: context.value.workspaceId,
      executionId: input.executionId,
      nodeResultLimit: input.nodeResultLimit,
      diagnosticsLimit: input.diagnosticsLimit,
    }, context.value.sessionToken);
  }

  public async getRunTrace(input: {
    readonly executionId: string;
    readonly eventLimit?: number;
    readonly logLimit?: number;
  }): Promise<RuntimeSdkResponse<RuntimeSdkExecutionTraceResponse>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }
    return this.client.getRunTrace({
      workspaceId: context.value.workspaceId,
      executionId: input.executionId,
      eventLimit: input.eventLimit,
      logLimit: input.logLimit,
    }, context.value.sessionToken);
  }

  public async startRun(input: {
    readonly systemId: string;
    readonly versionId: string;
    readonly async?: boolean;
    readonly inputPayload?: unknown;
    readonly idempotencyKey?: string;
    readonly executionId?: string;
    readonly trigger?: RuntimeSdkExecutionContext["trigger"];
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly approvedParameters?: Readonly<Record<string, unknown>>;
  }): Promise<RuntimeSdkResponse<RuntimeSdkStartExecutionResponse>> {
    const context = this.resolveSessionContext();
    if (!context.ok) {
      return context.errorResponse;
    }

    const mergedMetadata = this.mergeExecutionMetadata(input.metadata, input.approvedParameters);
    const request: RuntimeSdkStartExecutionRequest & { readonly workspaceId: string } = Object.freeze({
      workspaceId: context.value.workspaceId,
      systemId: input.systemId,
      versionId: input.versionId,
      async: input.async,
      inputPayload: input.inputPayload,
      executionId: input.executionId,
      idempotencyKey: input.idempotencyKey,
      context: Object.freeze({
        trigger: input.trigger,
        metadata: mergedMetadata,
      }),
    });
    return this.client.startRun(request, context.value.sessionToken);
  }

  public async inspectRun(input: {
    readonly executionId: string;
    readonly diagnosticsLimit?: number;
    readonly eventLimit?: number;
    readonly logLimit?: number;
  }): Promise<RuntimeSdkResponse<RuntimeRunInspectionSummary>> {
    const normalizedExecutionId = input.executionId.trim();
    if (!normalizedExecutionId) {
      return this.createErrorResponse({
        code: "invalid-request",
        message: "Execution id is required.",
      });
    }

    const [status, result, trace] = await Promise.all([
      this.getRunStatus(normalizedExecutionId),
      this.getRunResult({
        executionId: normalizedExecutionId,
        diagnosticsLimit: input.diagnosticsLimit,
      }),
      this.getRunTrace({
        executionId: normalizedExecutionId,
        eventLimit: input.eventLimit,
        logLimit: input.logLimit,
      }),
    ]);
    if (!status.ok || !status.data) {
      return this.createErrorResponse({
        code: status.error?.code ?? "internal",
        message: status.error?.message ?? "Failed to load runtime status.",
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        executionId: status.data.executionId,
        status: status.data.status,
        rootAssetId: status.data.rootAssetId,
        rootVersionId: status.data.rootVersionId,
        progressLabel: `${status.data.progress.completedNodeCount}/${status.data.progress.totalNodeCount} nodes`,
        diagnosticsCount: result.ok ? result.data?.diagnostics.length : undefined,
        traceEventCount: trace.ok ? trace.data?.trace.events.length : undefined,
        traceLogCount: trace.ok ? trace.data?.trace.logs.length : undefined,
        outputFieldCount: result.ok ? result.data?.outputSummary.outputFieldCount : undefined,
        outputContractIds: result.ok ? result.data?.outputSummary.contractOutputIds : undefined,
        outputAssetIds: result.ok ? resolveRuntimeOutputAssetIds(result.data) : undefined,
      }),
    });
  }

  private resolveSessionContext(): {
    readonly ok: true;
    readonly value: RuntimeSessionContext;
  } | {
    readonly ok: false;
    readonly errorResponse: RuntimeSdkResponse<never>;
  } {
    const session = this.sessionStore.getSession();
    if (!session || this.sessionStore.isSessionExpired(session)) {
      return {
        ok: false,
        errorResponse: this.createErrorResponse({
          code: "unauthorized",
          message: "An active authenticated session is required for runtime operations.",
        }),
      };
    }
    const workspaceId = this.resolveWorkspaceId(session);
    if (!workspaceId) {
      return {
        ok: false,
        errorResponse: this.createErrorResponse({
          code: "invalid-request",
          message: "No active workspace is available for runtime operations.",
        }),
      };
    }
    return {
      ok: true,
      value: Object.freeze({
        sessionToken: session.sessionToken,
        workspaceId,
      }),
    };
  }

  private resolveWorkspaceId(session: IdentityAuthPersistedSession): string | undefined {
    const workspaceId = session.workspaceContext?.resolvedWorkspaceId
      ?? session.workspaceContext?.requestedWorkspaceId
      ?? session.initialCapabilityState?.workspaceId;
    const normalized = workspaceId?.trim();
    return normalized || undefined;
  }

  private createErrorResponse(error: RuntimeOperationsError): RuntimeSdkResponse<never> {
    return Object.freeze({
      ok: false,
      error,
    });
  }

  private mergeExecutionMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
    approvedParameters: Readonly<Record<string, unknown>> | undefined,
  ): RuntimeSdkExecutionContext["metadata"] | undefined {
    const next: Record<string, unknown> = {};
    if (metadata && Object.keys(metadata).length > 0) {
      Object.assign(next, metadata);
    }
    if (approvedParameters && Object.keys(approvedParameters).length > 0) {
      next.approvedParameters = approvedParameters;
    }
    return Object.keys(next).length > 0 ? Object.freeze(next) : undefined;
  }
}

function resolveRuntimeOutputAssetIds(
  result: RuntimeSdkExecutionResultResponse | undefined,
): ReadonlyArray<string> {
  if (!result) {
    return Object.freeze([]);
  }
  const referenced = new Set<string>();
  if (typeof result.rootAssetId === "string" && result.rootAssetId.trim().startsWith("asset:")) {
    referenced.add(result.rootAssetId.trim());
  }
  for (const contractId of result.outputSummary.contractOutputIds) {
    const normalized = contractId.trim();
    if (normalized.startsWith("asset:")) {
      referenced.add(normalized);
    }
  }
  collectAssetLikeIds(result.output, referenced);
  return Object.freeze([...referenced.values()]);
}

function collectAssetLikeIds(
  value: unknown,
  sink: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAssetLikeIds(entry, sink);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      const normalized = entry.trim();
      if (isAssetReferenceKey(key) && normalized.startsWith("asset:")) {
        sink.add(normalized);
      }
      continue;
    }
    collectAssetLikeIds(entry, sink);
  }
}

function isAssetReferenceKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized === "assetid"
    || normalized === "outputassetid"
    || normalized === "previewassetid"
    || normalized.endsWith("assetid");
}

function createDefaultRuntimeControlClient(): RuntimeControlClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpRuntimeControlClient(baseUrl);
}


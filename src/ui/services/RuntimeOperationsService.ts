import type {
  RuntimeQueueItemStatus,
  RuntimeSdkExecutionResultResponse,
  RuntimeSdkExecutionStatusResponse,
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
}

function createDefaultRuntimeControlClient(): RuntimeControlClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpRuntimeControlClient(baseUrl);
}


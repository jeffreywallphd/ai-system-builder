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
import { ExecutionQuotaEvaluator } from "../../../application/system-runtime/ExecutionQuotaEvaluator";
import {
  PermissiveRuntimeApiAuthenticator,
  type RuntimeApiAuthenticationRequest,
  type RuntimeApiAuthenticator,
} from "./RuntimeApiAuthentication";

export type {
  RuntimeExecutionResultReadModel,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  StartSystemRuntimeExecutionRequest,
};

export interface SystemRuntimeApiError {
  readonly code: "not-found" | "invalid-request" | "forbidden" | "unauthorized" | "quota-exceeded" | "internal";
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

export interface RuntimeApiRequestContext {
  readonly trustedInternal?: boolean;
  readonly requireAuthentication?: boolean;
  readonly authentication?: RuntimeApiAuthenticationRequest;
  readonly accessContext?: ExecutionAccessContext;
}

export class SystemRuntimeBackendApi {
  private readonly service: SystemRuntimeApplicationService;

  public constructor(
    repository: IStudioShellRepository,
    executionStore?: ISystemRuntimeExecutionStore,
    private readonly runtimeAccessControl = new RuntimeAccessControlService(),
    private readonly runtimeAuthenticator: RuntimeApiAuthenticator = new PermissiveRuntimeApiAuthenticator(),
    private readonly executionQuotaEvaluator = new ExecutionQuotaEvaluator(),
  ) {
    this.service = new SystemRuntimeApplicationService(repository, executionStore);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest & {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
    readonly systemId?: string;
  }): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    return this.wrap(async () => {
      const callerContext = this.resolveCallerContext(request);
      this.assertExecutionAccess({
        accessContext: callerContext,
        systemId: request.systemId,
        versionId: request.versionId,
      });
      const reservation = this.executionQuotaEvaluator.reserveExecution({ callerContext });
      if (!reservation.decision.allowed) {
        throw new Error(`quota-exceeded:${reservation.decision.message ?? "Runtime execution quota exceeded."}`);
      }

      let started;
      try {
        started = await this.service.startExecution(request);
      } finally {
        reservation.reservation?.release();
      }
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

  public async getExecutionStatus(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>> {
    return this.wrap(async () => this.getExecutionStatusAuthorized(executionId, requestContext));
  }

  public async getExecutionTrace(
    request: GetSystemRuntimeExecutionTraceRequest & { readonly requestContext?: RuntimeApiRequestContext },
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>> {
    return this.wrap(async () => {
      await this.getExecutionStatusAuthorized(request.executionId, request.requestContext);
      return this.service.getExecutionTrace(request.executionId, {
      eventLimit: request.eventLimit,
      logLimit: request.logLimit,
      });
    });
  }

  public async getExecutionResult(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>> {
    return this.getExecutionResultBounded({ executionId, requestContext });
  }

  public async getExecutionResultBounded(
    request: GetSystemRuntimeExecutionResultRequest & { readonly requestContext?: RuntimeApiRequestContext },
  ): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>> {
    return this.wrap(async () => {
      await this.getExecutionStatusAuthorized(request.executionId, request.requestContext);
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

  private resolveCallerContext(request: {
    readonly accessContext?: ExecutionAccessContext;
    readonly requestContext?: RuntimeApiRequestContext;
  }): ExecutionAccessContext | undefined {
    const runtimeContext = request.requestContext;
    if (runtimeContext?.trustedInternal) {
      return request.accessContext ?? runtimeContext.accessContext ?? Object.freeze({
        callerKind: "system",
        callerId: "studio-shell-internal",
        roles: Object.freeze(["trusted-internal"]),
      });
    }

    const authDecision = this.runtimeAuthenticator.authenticate(runtimeContext?.authentication);
    if (!authDecision.authenticated && runtimeContext?.requireAuthentication) {
      throw new Error(`unauthorized:${authDecision.message ?? "Runtime API request is missing or has invalid authentication."}`);
    }
    if (!authDecision.authenticated) {
      return request.accessContext ?? runtimeContext?.accessContext;
    }

    const principal = authDecision.principal!;
    return Object.freeze({
      callerKind: principal.callerKind,
      callerId: principal.callerId,
      sessionId: principal.sessionId,
      roles: principal.roles,
      metadata: principal.metadata,
    });
  }

  private async getExecutionStatusAuthorized(
    executionId: string,
    requestContext?: RuntimeApiRequestContext,
  ): Promise<RuntimeExecutionStatusReadModel> {
    const status = await this.service.getExecutionStatus(executionId);
    const callerContext = this.resolveCallerContext({ requestContext });
    this.assertExecutionAccess({
      accessContext: callerContext,
      systemId: status.rootAssetId,
      versionId: status.rootVersionId,
    });
    return status;
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
    if (message.startsWith("unauthorized:")) {
      return Object.freeze({ code: "unauthorized", message: message.slice("unauthorized:".length) });
    }
    if (message.startsWith("quota-exceeded:")) {
      return Object.freeze({ code: "quota-exceeded", message: message.slice("quota-exceeded:".length) });
    }

    return Object.freeze({ code: "internal", message });
  }
}

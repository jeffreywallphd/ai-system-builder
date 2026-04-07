import { DeploymentBuildPipeline } from "../../../application/deployment/DeploymentBuildPipeline";
import {
  DeploymentExecutionService,
  type DeploymentRecordRepository,
} from "../../../application/deployment/DeploymentExecutionService";
import { DeploymentHealthMonitor } from "../../../application/deployment/DeploymentHealthMonitor";
import { DeploymentRollbackService } from "../../../application/deployment/DeploymentRollbackService";
import { DeploymentVersionManager } from "../../../application/deployment/DeploymentVersionManager";
import {
  DeploymentAccessDeniedError,
  type DeploymentAccessContext,
} from "../../../application/deployment/DeploymentAccessControl";
import { DeploymentQuotaExceededError } from "../../../application/deployment/DeploymentQuotaEvaluator";
import { createDeploymentConfigurationContract } from "../../../domain/deployment/DeploymentConfigurationDomain";
import { createDeploymentTarget } from "../../../domain/deployment/DeploymentTargetDomain";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import type {
  DeploymentSdkAccessContext,
  DeploymentSdkDeploymentStatusRequest,
  DeploymentSdkDeploymentStatusResponse,
  DeploymentSdkDeploymentSummary,
  DeploymentSdkGetActiveDeploymentRequest,
  DeploymentSdkGetActiveDeploymentResponse,
  DeploymentSdkHealthRequest,
  DeploymentSdkHealthResponse,
  DeploymentSdkListDeploymentsRequest,
  DeploymentSdkListDeploymentsResponse,
  DeploymentSdkResponse,
  DeploymentSdkRollbackRequest,
  DeploymentSdkRollbackResponse,
  DeploymentSdkStartDeploymentRequest,
  DeploymentSdkStartDeploymentResponse,
  DeploymentSdkValidationError,
} from "./sdk/PublicDeploymentSdkContract";

export interface DeploymentApiError {
  readonly code: "unauthorized" | "forbidden" | "invalid-request" | "not-found" | "quota-exceeded" | "internal";
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<DeploymentSdkValidationError>;
}

export interface DeploymentApiResponse<T> extends DeploymentSdkResponse<T> {
  readonly error?: DeploymentApiError;
}

interface DeploymentReadPolicy {
  readonly maxListedDeployments: number;
  readonly maxStateTransitions: number;
  readonly cacheTtlMs: number;
  readonly maxCachedResponses: number;
}

const DEFAULT_READ_POLICY: DeploymentReadPolicy = Object.freeze({
  maxListedDeployments: 200,
  maxStateTransitions: 200,
  cacheTtlMs: 100,
  maxCachedResponses: 1000,
});

export class DeploymentBackendApi {
  private readonly cachedStatusResponses = new Map<string, { readonly expiresAtMs: number; readonly response: DeploymentSdkDeploymentStatusResponse }>();
  private readonly cachedListResponses = new Map<string, { readonly expiresAtMs: number; readonly response: DeploymentSdkListDeploymentsResponse }>();
  private readonly cachedActiveResponses = new Map<string, { readonly expiresAtMs: number; readonly response: DeploymentSdkGetActiveDeploymentResponse }>();
  private readonly cachedHealthResponses = new Map<string, { readonly expiresAtMs: number; readonly response: DeploymentSdkHealthResponse }>();

  public constructor(
    private readonly buildPipeline: DeploymentBuildPipeline,
    private readonly deploymentExecutionService: DeploymentExecutionService,
    private readonly deploymentVersionManager: DeploymentVersionManager,
    private readonly deploymentRollbackService: DeploymentRollbackService,
    private readonly deploymentHealthMonitor: DeploymentHealthMonitor,
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly readPolicy: DeploymentReadPolicy = DEFAULT_READ_POLICY,
  ) {}

  public startDeployment(
    request: DeploymentSdkStartDeploymentRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkStartDeploymentResponse> {
    return this.wrap(() => {
      const built = this.buildPipeline.build({
        systemPackage: createSystemPackage(normalizeSystemPackage(request.systemPackage)),
        target: createDeploymentTarget(normalizeTargetDefinition(request.target)),
        deploymentConfiguration: createDeploymentConfigurationContract(normalizeConfiguration(request.deploymentConfiguration)),
      });
      if (!built.ok || !built.bundle) {
        throw new Error(`invalid-request:${built.issues.map((entry) => `${entry.code}:${entry.message}`).join("; ") || "Deployment build failed."}`);
      }

      const executed = this.deploymentExecutionService.executeLifecycle({
        requestId: request.requestId,
        requestedAt: request.requestedAt,
        bundle: built.bundle,
        target: createDeploymentTarget(normalizeTargetDefinition(request.target)),
        deploymentConfiguration: createDeploymentConfigurationContract(normalizeConfiguration(request.deploymentConfiguration)),
      }, {
        accessContext: this.toAccessContext(context?.accessContext, request.selection?.tenantId),
        resourceTenantId: request.selection?.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });

      if (!executed.deployment) {
        throw new Error("Deployment lifecycle did not return a deployment record.");
      }

      return Object.freeze({
        deployment: toSummary(executed.deployment),
        issues: executed.issues,
      });
    });
  }

  public getDeploymentStatus(
    request: DeploymentSdkDeploymentStatusRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkDeploymentStatusResponse> {
    return this.wrap(() => {
      const cacheKey = this.makeStatusCacheKey(request, context?.accessContext);
      const cached = this.getCachedResponse(this.cachedStatusResponses, cacheKey);
      if (cached) {
        return cached;
      }

      const record = this.deploymentRepository.getById(request.deploymentId);
      if (!record) {
        throw new Error(`not-found:Deployment '${request.deploymentId}' was not found.`);
      }
      this.deploymentVersionManager.listDeploymentHistory({
        rootSystemAssetId: record.rootSystemAssetId,
        rootSystemVersionId: record.rootSystemVersionId,
        targetId: record.targetId,
        targetType: record.targetType,
        accessContext: this.toAccessContext(context?.accessContext, request.tenantId),
        resourceTenantId: request.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });

      const maxTransitions = this.normalizeLimit(request.stateTransitionLimit, this.readPolicy.maxStateTransitions);
      const stateTransitions = maxTransitions === undefined
        ? record.stateTransitions
        : Object.freeze(record.stateTransitions.slice(Math.max(0, record.stateTransitions.length - maxTransitions)));

      const response = Object.freeze({
        deployment: toSummary(record),
        stateSnapshot: Object.freeze({
          currentState: record.stateSnapshot.currentState,
          updatedAt: record.stateSnapshot.updatedAt,
          sequence: record.stateSnapshot.sequence,
        }),
        stateTransitions,
      });
      this.setCachedResponse(this.cachedStatusResponses, cacheKey, response);
      return response;
    });
  }

  public listDeployments(
    request: DeploymentSdkListDeploymentsRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkListDeploymentsResponse> {
    return this.wrap(() => {
      const cacheKey = this.makeListCacheKey(request, context?.accessContext);
      const cached = this.getCachedResponse(this.cachedListResponses, cacheKey);
      if (cached) {
        return cached;
      }

      const deployments = this.deploymentVersionManager.listDeploymentHistory({
        ...request,
        accessContext: this.toAccessContext(context?.accessContext, request.tenantId),
        resourceTenantId: request.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });
      const maxDeployments = this.normalizeLimit(request.limit, this.readPolicy.maxListedDeployments);
      const boundedDeployments = maxDeployments === undefined
        ? deployments
        : deployments.slice(0, maxDeployments);

      const response = Object.freeze({
        deployments: Object.freeze(boundedDeployments.map((entry) => {
          const record = this.deploymentRepository.getById(entry.deploymentId);
          if (!record) {
            throw new Error(`not-found:Deployment '${entry.deploymentId}' was not found.`);
          }
          return toSummary(record);
        })),
      });
      this.setCachedResponse(this.cachedListResponses, cacheKey, response);
      return response;
    });
  }

  public getActiveDeployment(
    request: DeploymentSdkGetActiveDeploymentRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkGetActiveDeploymentResponse> {
    return this.wrap(() => {
      const cacheKey = this.makeActiveCacheKey(request, context?.accessContext);
      const cached = this.getCachedResponse(this.cachedActiveResponses, cacheKey);
      if (cached) {
        return cached;
      }

      const active = this.deploymentVersionManager.getActiveDeployment({
        rootSystemAssetId: request.rootSystemAssetId,
        targetId: request.targetId,
        targetType: request.targetType,
        accessContext: this.toAccessContext(context?.accessContext, request.tenantId),
        resourceTenantId: request.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });

      const record = active ? this.deploymentRepository.getById(active.deploymentId) : undefined;
      const response = Object.freeze({
        activeDeployment: record ? toSummary(record) : undefined,
      });
      this.setCachedResponse(this.cachedActiveResponses, cacheKey, response);
      return response;
    });
  }

  public rollbackDeployment(
    request: DeploymentSdkRollbackRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkRollbackResponse> {
    return this.wrap(() => {
      const result = this.deploymentRollbackService.rollback({
        ...request,
        accessContext: this.toAccessContext(context?.accessContext, request.tenantId),
        resourceTenantId: request.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });
      return result;
    });
  }

  public getDeploymentHealth(
    request: DeploymentSdkHealthRequest,
    context?: { readonly accessContext?: DeploymentSdkAccessContext },
  ): DeploymentApiResponse<DeploymentSdkHealthResponse> {
    return this.wrap(() => {
      const cacheKey = this.makeHealthCacheKey(request, context?.accessContext);
      const cached = this.getCachedResponse(this.cachedHealthResponses, cacheKey);
      if (cached) {
        return cached;
      }

      const snapshot = this.deploymentHealthMonitor.getDeploymentHealth({
        deploymentId: request.deploymentId,
        callerContext: this.toAccessContext(context?.accessContext, request.tenantId)?.caller,
        tenantId: request.tenantId,
        requestSource: context?.accessContext?.source ?? "external-api",
      });
      this.setCachedResponse(this.cachedHealthResponses, cacheKey, snapshot);
      return snapshot;
    });
  }


  private normalizeLimit(limit: number | undefined, maxAllowed: number): number | undefined {
    if (limit === undefined) {
      return undefined;
    }
    if (!Number.isFinite(limit)) {
      throw new Error("invalid-request:Read limit must be a finite number.");
    }
    const normalized = Math.trunc(limit);
    if (normalized <= 0) {
      throw new Error("invalid-request:Read limit must be greater than zero.");
    }
    return Math.min(normalized, maxAllowed);
  }

  private makeStatusCacheKey(request: DeploymentSdkDeploymentStatusRequest, accessContext?: DeploymentSdkAccessContext): string {
    return JSON.stringify({
      deploymentId: request.deploymentId,
      tenantId: request.tenantId,
      stateTransitionLimit: request.stateTransitionLimit,
      callerId: accessContext?.callerId,
      callerKind: accessContext?.callerKind,
      source: accessContext?.source,
    });
  }

  private makeListCacheKey(request: DeploymentSdkListDeploymentsRequest, accessContext?: DeploymentSdkAccessContext): string {
    return JSON.stringify({
      rootSystemAssetId: request.rootSystemAssetId,
      rootSystemVersionId: request.rootSystemVersionId,
      targetId: request.targetId,
      targetType: request.targetType,
      tenantId: request.tenantId,
      limit: request.limit,
      callerId: accessContext?.callerId,
      callerKind: accessContext?.callerKind,
      source: accessContext?.source,
    });
  }

  private makeActiveCacheKey(request: DeploymentSdkGetActiveDeploymentRequest, accessContext?: DeploymentSdkAccessContext): string {
    return JSON.stringify({
      rootSystemAssetId: request.rootSystemAssetId,
      targetId: request.targetId,
      targetType: request.targetType,
      tenantId: request.tenantId,
      callerId: accessContext?.callerId,
      callerKind: accessContext?.callerKind,
      source: accessContext?.source,
    });
  }

  private makeHealthCacheKey(request: DeploymentSdkHealthRequest, accessContext?: DeploymentSdkAccessContext): string {
    return JSON.stringify({
      deploymentId: request.deploymentId,
      tenantId: request.tenantId,
      callerId: accessContext?.callerId,
      callerKind: accessContext?.callerKind,
      source: accessContext?.source,
    });
  }

  private getCachedResponse<T>(cache: Map<string, { readonly expiresAtMs: number; readonly response: T }>, key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAtMs <= Date.now()) {
      cache.delete(key);
      return undefined;
    }
    return entry.response;
  }

  private setCachedResponse<T>(cache: Map<string, { readonly expiresAtMs: number; readonly response: T }>, key: string, response: T): void {
    cache.set(key, Object.freeze({
      expiresAtMs: Date.now() + this.readPolicy.cacheTtlMs,
      response,
    }));
    while (cache.size > this.readPolicy.maxCachedResponses) {
      const oldest = cache.keys().next().value;
      if (!oldest) {
        break;
      }
      cache.delete(oldest);
    }
  }


  private wrap<T>(operation: () => T): DeploymentApiResponse<T> {
    try {
      return Object.freeze({ ok: true, data: operation() });
    } catch (error) {
      return Object.freeze({
        ok: false,
        error: this.toApiError(error),
      });
    }
  }

  private toApiError(error: unknown): DeploymentApiError {
    if (error instanceof DeploymentAccessDeniedError) {
      return Object.freeze({
        code: "forbidden",
        message: error.decision.message ?? "Deployment access denied.",
      });
    }
    if (error instanceof DeploymentQuotaExceededError) {
      return Object.freeze({
        code: "quota-exceeded",
        message: error.decision.message ?? "Deployment quota exceeded.",
      });
    }

    if (error instanceof Error) {
      if (error.message.startsWith("not-found:")) {
        return Object.freeze({ code: "not-found", message: error.message.slice("not-found:".length) });
      }
      if (error.message.startsWith("forbidden:")) {
        return Object.freeze({ code: "forbidden", message: error.message.slice("forbidden:".length) });
      }
      if (error.message.startsWith("unauthorized:")) {
        return Object.freeze({ code: "unauthorized", message: error.message.slice("unauthorized:".length) });
      }
      return Object.freeze({ code: "invalid-request", message: error.message });
    }

    return Object.freeze({ code: "internal", message: "Unknown deployment API error." });
  }

  private toAccessContext(context?: DeploymentSdkAccessContext, tenantId?: string): DeploymentAccessContext | undefined {
    if (!context) {
      return undefined;
    }
    return Object.freeze({
      caller: Object.freeze({
        callerKind: context.callerKind,
        callerId: context.callerId,
        sessionId: context.sessionId,
        roles: context.roles,
        metadata: {
          ...(context.metadata ?? {}),
          ...(tenantId?.trim() ? { tenantId: tenantId.trim() } : {}),
        },
      }),
      tenantId: tenantId?.trim() || context.tenantId,
      source: context.source,
    });
  }
}

function toSummary(record: ReturnType<DeploymentRecordRepository["getById"]> extends infer R ? Exclude<R, undefined> : never): DeploymentSdkDeploymentSummary {
  return Object.freeze({
    deploymentId: record.deploymentId,
    requestId: record.requestId,
    status: record.status,
    state: record.state,
    activationState: record.activationState,
    activationUpdatedAt: record.activationUpdatedAt,
    rootSystemAssetId: record.rootSystemAssetId,
    rootSystemVersionId: record.rootSystemVersionId,
    packageId: record.packageId,
    bundleId: record.bundleId,
    bundleVersionKey: record.bundleVersionKey,
    deploymentConfigurationId: record.deploymentConfigurationId,
    targetId: record.targetId,
    targetType: record.targetType,
    deploymentEnvironmentId: record.provisionedEnvironmentId,
    nestedSystemCount: record.nestedSystemCount,
    deployedAt: record.deployedAt,
    tenantId: record.isolation.boundary.tenantId,
  });
}

function normalizeTargetDefinition<T extends { readonly targetId: unknown }>(target: T): T & { readonly targetId: string } {
  return Object.freeze({
    ...target,
    targetId: normalizeString(target.targetId),
  });
}

function normalizeConfiguration<T extends { readonly targetId: unknown; readonly configurationId: unknown; readonly packageId: unknown }>(
  configuration: T,
): T & { readonly targetId: string; readonly configurationId: string; readonly packageId: string; readonly createdAt: string } {
  const withMetadata = configuration as T & { readonly metadata?: { readonly createdAt?: string }; readonly createdAt?: string };
  return Object.freeze({
    ...configuration,
    targetId: normalizeString(configuration.targetId),
    configurationId: normalizeString(configuration.configurationId),
    packageId: normalizeString(configuration.packageId),
    createdAt: withMetadata.createdAt ?? withMetadata.metadata?.createdAt,
  });
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "value" in value && typeof (value as { readonly value?: unknown }).value === "string") {
    return (value as { readonly value: string }).value;
  }
  throw new Error("invalid-request:Expected string value.");
}

function normalizeSystemPackage<T extends { readonly packageId: unknown }>(pkg: T): T & { readonly packageId: string } {
  return Object.freeze({
    ...pkg,
    packageId: normalizeString(pkg.packageId),
  });
}

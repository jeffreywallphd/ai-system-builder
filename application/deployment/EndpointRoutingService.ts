import type {
  EndpointInvocationResult,
  EndpointRouteRequest,
  EndpointRouteResolution,
  ResolvedDeployedEndpoint,
} from "../../domain/deployment/EndpointRoutingDomain";
import type { DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import type { DeploymentVersionManager } from "./DeploymentVersionManager";
import type { SystemEndpointExposureService } from "./SystemEndpointExposureService";
import type { DeploymentRecordRepository } from "./DeploymentExecutionService";

export interface EndpointRuntimeInvocationRequest {
  readonly systemId: string;
  readonly versionId: string;
  readonly executionId?: string;
  readonly async?: boolean;
  readonly idempotencyKey?: string;
  readonly inputPayload?: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly context?: EndpointRouteRequest["invocation"]["context"];
  readonly callerContext?: EndpointRouteRequest["callerContext"];
  readonly authentication?: EndpointRouteRequest["authentication"];
  readonly tenantId?: string;
  readonly requestSource?: string;
}

export interface EndpointRuntimeInvoker {
  invoke(request: EndpointRuntimeInvocationRequest): Promise<unknown>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class EndpointRoutingService {
  public constructor(
    private readonly endpointExposureService: Pick<SystemEndpointExposureService, "resolveEndpoint">,
    private readonly versionManager: Pick<DeploymentVersionManager, "getActiveDeployment">,
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly runtimeInvoker: EndpointRuntimeInvoker,
  ) {}

  public resolveRoute(request: EndpointRouteRequest): EndpointRouteResolution {
    const endpointId = normalizeRequired(request.endpointId, "Endpoint route endpointId");
    const resolved = this.endpointExposureService.resolveEndpoint({
      endpointId,
      accessContext: request.callerContext
        ? {
          caller: request.callerContext,
          tenantId: request.tenantId,
          source: request.requestSource,
        }
        : undefined,
      resourceTenantId: request.tenantId,
      requestSource: request.requestSource,
    });

    if (!resolved) {
      throw new Error(`Endpoint '${endpointId}' is not exposed or not accessible.`);
    }

    const active = this.versionManager.getActiveDeployment({
      rootSystemAssetId: resolved.rootSystemAssetId,
      targetId: resolved.targetId,
      targetType: resolved.targetType,
      accessContext: request.callerContext
        ? {
          caller: request.callerContext,
          tenantId: request.tenantId,
          source: request.requestSource,
        }
        : undefined,
      resourceTenantId: request.tenantId,
      requestSource: request.requestSource,
    });

    if (!active || active.deploymentId !== resolved.deploymentId) {
      throw new Error(`Endpoint '${endpointId}' does not map to an active deployment.`);
    }

    const deployment = this.requireDeploymentRecord(resolved.deploymentId);
    if (deployment.state !== "active" || deployment.status !== "succeeded") {
      throw new Error(`Deployment '${resolved.deploymentId}' is not currently invokable.`);
    }

    const resolvedEndpoint: ResolvedDeployedEndpoint = Object.freeze({
      endpointId: resolved.endpoint.endpointId.value,
      endpointName: resolved.endpoint.endpointName,
      callable: resolved.endpoint.callable,
      deploymentId: resolved.deploymentId,
      rootSystemAssetId: resolved.rootSystemAssetId,
      rootSystemVersionId: resolved.rootSystemVersionId,
      targetId: resolved.targetId,
      targetType: resolved.targetType,
      deploymentEnvironmentId: resolved.deploymentEnvironmentId,
      tenantId: deployment.isolation.boundary.tenantId,
      activationUpdatedAt: resolved.activationUpdatedAt,
      nestedSystemCount: deployment.nestedSystemCount,
      runtimeContextKey: deployment.isolation.runtimeBinding.runtimeContextKey,
    });

    return Object.freeze({
      request: Object.freeze({ ...request, endpointId }),
      resolvedEndpoint,
    });
  }

  public async invokeEndpoint(request: EndpointRouteRequest): Promise<EndpointInvocationResult> {
    const route = this.resolveRoute(request);
    const runtimeResponse = await this.runtimeInvoker.invoke({
      systemId: route.resolvedEndpoint.rootSystemAssetId,
      versionId: route.resolvedEndpoint.rootSystemVersionId,
      executionId: normalizeOptional(route.request.invocation.executionId),
      async: route.request.invocation.async,
      idempotencyKey: normalizeOptional(route.request.invocation.idempotencyKey),
      inputPayload: route.request.invocation.inputPayload,
      inputContentType: normalizeOptional(route.request.invocation.inputContentType),
      inputSchemaVersion: normalizeOptional(route.request.invocation.inputSchemaVersion),
      context: route.request.invocation.context,
      callerContext: route.request.callerContext,
      authentication: route.request.authentication,
      tenantId: normalizeOptional(route.request.tenantId) ?? route.resolvedEndpoint.tenantId,
      requestSource: normalizeOptional(route.request.requestSource) ?? "deployment-endpoint-routing",
    });

    return Object.freeze({ route, runtimeResponse });
  }

  private requireDeploymentRecord(deploymentId: string): DeploymentRecord {
    const record = this.deploymentRepository.getById(deploymentId);
    if (!record) {
      throw new Error(`Deployment '${deploymentId}' was not found.`);
    }
    return record;
  }
}

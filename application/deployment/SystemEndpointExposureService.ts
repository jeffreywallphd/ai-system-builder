import { createHash } from "node:crypto";
import type { DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import type {
  DeployedSystemEndpoint,
  EndpointCallableMetadata,
  EndpointExposureRecord,
  ResolvedEndpointDeployment,
  SystemEndpointId,
} from "../../domain/deployment/SystemEndpointExposureDomain";
import type { DeploymentVersionManager } from "./DeploymentVersionManager";
import type { DeploymentRecordRepository } from "./DeploymentExecutionService";
import type { DeploymentAccessContext } from "./DeploymentAccessControl";
import { DeploymentIsolationEvaluator } from "./DeploymentIsolationEvaluator";
import type { DeploymentEnvironmentContext } from "../../domain/deployment/DeploymentIsolationDomain";

export interface EndpointExposureRepository {
  save(record: EndpointExposureRecord): EndpointExposureRecord;
  getByEndpointId(endpointId: string): EndpointExposureRecord | undefined;
  listByRootSystemAssetId(rootSystemAssetId: string): ReadonlyArray<EndpointExposureRecord>;
}

export class InMemoryEndpointExposureRepository implements EndpointExposureRepository {
  private readonly recordsById = new Map<string, EndpointExposureRecord>();

  public save(record: EndpointExposureRecord): EndpointExposureRecord {
    this.recordsById.set(record.recordId, record);
    return record;
  }

  public getByEndpointId(endpointId: string): EndpointExposureRecord | undefined {
    const normalized = endpointId.trim();
    return [...this.recordsById.values()].find((entry) => entry.endpoint.endpointId.value === normalized);
  }

  public listByRootSystemAssetId(rootSystemAssetId: string): ReadonlyArray<EndpointExposureRecord> {
    const normalized = rootSystemAssetId.trim();
    return Object.freeze([...this.recordsById.values()]
      .filter((entry) => entry.endpoint.rootSystemAssetId === normalized)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }
}

export class SystemEndpointExposureService {
  public constructor(
    private readonly deploymentVersionManager: Pick<DeploymentVersionManager, "getActiveDeployment">,
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly repository: EndpointExposureRepository = new InMemoryEndpointExposureRepository(),
    private readonly clock: () => Date = () => new Date(),
    private readonly isolationEvaluator: DeploymentIsolationEvaluator = new DeploymentIsolationEvaluator(),
  ) {}

  public exposeActiveDeployment(input: {
    readonly rootSystemAssetId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly endpointName?: string;
    readonly callable?: Partial<EndpointCallableMetadata>;
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): EndpointExposureRecord {
    const active = this.deploymentVersionManager.getActiveDeployment({
      rootSystemAssetId: input.rootSystemAssetId,
      targetId: input.targetId,
      targetType: input.targetType,
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
    });
    if (!active) {
      throw new Error("No active deployment is available to expose an endpoint.");
    }
    const deployment = this.requireDeployment(active.deploymentId);
    this.isolationEvaluator.assertRecordAccessible({
      record: deployment,
      context: this.resolveIsolationContext({
        accessContext: input.accessContext,
        resourceTenantId: input.resourceTenantId,
        requestSource: input.requestSource,
        targetId: input.targetId,
        targetType: input.targetType,
        deploymentEnvironmentId: deployment.provisionedEnvironmentId,
      }),
      expectedDeploymentId: deployment.deploymentId,
    });

    const endpointName = input.endpointName?.trim() || `${deployment.rootSystemAssetId}:${deployment.targetId}`;
    const endpointId = this.createEndpointId({
      endpointName,
      rootSystemAssetId: deployment.rootSystemAssetId,
      targetId: deployment.targetId,
      targetType: deployment.targetType,
      tenantId: deployment.isolation.boundary.tenantId,
    });
    const now = this.clock().toISOString();
    const existing = this.repository.getByEndpointId(endpointId.value);
    const exposedAt = existing?.exposedAt ?? now;
    const recordId = existing?.recordId ?? `endpoint-exposure:${endpointId.value}`;

    const endpoint: DeployedSystemEndpoint = Object.freeze({
      endpointId,
      endpointName,
      rootSystemAssetId: deployment.rootSystemAssetId,
      targetId: deployment.targetId,
      targetType: deployment.targetType,
      deploymentEnvironmentId: deployment.provisionedEnvironmentId ?? "pending-provisioning",
      tenantId: deployment.isolation.boundary.tenantId,
      callable: Object.freeze({
        protocol: "runtime-external-v1",
        invocationMode: input.callable?.invocationMode ?? "sync",
        contentType: input.callable?.contentType?.trim() || "application/json",
        contractVersion: input.callable?.contractVersion?.trim() || "v1",
      }),
    });

    return this.repository.save(Object.freeze({
      recordId,
      endpoint,
      deploymentId: deployment.deploymentId,
      rootSystemVersionId: deployment.rootSystemVersionId,
      bundleId: deployment.bundleId,
      bundleVersionKey: deployment.bundleVersionKey,
      packageId: deployment.packageId,
      deploymentConfigurationId: deployment.deploymentConfigurationId,
      activationUpdatedAt: deployment.activationUpdatedAt,
      exposedAt,
      updatedAt: now,
    }));
  }

  public resolveEndpoint(input: {
    readonly endpointId: string;
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ResolvedEndpointDeployment | undefined {
    const record = this.repository.getByEndpointId(input.endpointId);
    if (!record) {
      return undefined;
    }
    const deployment = this.requireDeployment(record.deploymentId);
    this.isolationEvaluator.assertRecordAccessible({
      record: deployment,
      context: this.resolveIsolationContext({
        accessContext: input.accessContext,
        resourceTenantId: input.resourceTenantId,
        requestSource: input.requestSource,
        targetId: deployment.targetId,
        targetType: deployment.targetType,
        deploymentEnvironmentId: deployment.provisionedEnvironmentId,
      }),
      expectedDeploymentId: record.deploymentId,
    });

    return Object.freeze({
      endpoint: record.endpoint,
      deploymentId: deployment.deploymentId,
      rootSystemAssetId: deployment.rootSystemAssetId,
      rootSystemVersionId: deployment.rootSystemVersionId,
      bundleId: deployment.bundleId,
      bundleVersionKey: deployment.bundleVersionKey,
      packageId: deployment.packageId,
      deploymentConfigurationId: deployment.deploymentConfigurationId,
      targetId: deployment.targetId,
      targetType: deployment.targetType,
      deploymentEnvironmentId: deployment.provisionedEnvironmentId ?? "pending-provisioning",
      activationUpdatedAt: deployment.activationUpdatedAt,
    });
  }

  public listExposedEndpoints(input: {
    readonly rootSystemAssetId: string;
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ReadonlyArray<EndpointExposureRecord> {
    const records = this.repository.listByRootSystemAssetId(input.rootSystemAssetId);
    const context = this.resolveIsolationContext({
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
    });
    return Object.freeze(records.filter((entry) => {
      const deployment = this.deploymentRepository.getById(entry.deploymentId);
      if (!deployment) {
        return false;
      }
      return this.isolationEvaluator.filterRecords({ records: [deployment], context }).length > 0;
    }));
  }

  private requireDeployment(deploymentId: string): DeploymentRecord {
    const deployment = this.deploymentRepository.getById(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' was not found.`);
    }
    return deployment;
  }

  private createEndpointId(input: {
    readonly endpointName: string;
    readonly rootSystemAssetId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly tenantId?: string;
  }): SystemEndpointId {
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 20);
    return Object.freeze({ value: `endpoint:${hash}` });
  }

  private resolveIsolationContext(input: {
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
    readonly deploymentEnvironmentId?: string;
  }): DeploymentEnvironmentContext {
    return Object.freeze({
      tenantId: input.resourceTenantId?.trim() || input.accessContext?.tenantId?.trim() || undefined,
      deploymentEnvironmentId: input.deploymentEnvironmentId?.trim() || undefined,
      targetId: input.targetId?.trim() || undefined,
      targetType: input.targetType,
      source: input.requestSource?.trim() || input.accessContext?.source?.trim() || undefined,
      callerId: input.accessContext?.caller?.callerId?.trim() || undefined,
      sessionId: input.accessContext?.caller?.sessionId?.trim() || undefined,
    });
  }
}

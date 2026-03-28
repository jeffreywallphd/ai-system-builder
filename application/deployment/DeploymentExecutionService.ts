import { createHash } from "node:crypto";
import {
  createDeploymentExecutionRequest,
  DeploymentStatuses,
  type DeploymentExecutionRequest,
  type DeploymentExecutionResult,
  type DeploymentRecord,
} from "../../domain/deployment/DeploymentExecutionDomain";
import type { ProvisionedDeploymentEnvironment } from "../../domain/deployment/EnvironmentProvisioningDomain";
import { EnvironmentProvisioningCompatibilityValidator } from "./EnvironmentProvisioningCompatibilityValidator";

export interface DeploymentRecordRepository {
  save(record: DeploymentRecord): DeploymentRecord;
  getById(deploymentId: string): DeploymentRecord | undefined;
  listByEnvironment(environmentId: string): ReadonlyArray<DeploymentRecord>;
}

export class InMemoryDeploymentRecordRepository implements DeploymentRecordRepository {
  private readonly recordsById = new Map<string, DeploymentRecord>();
  private readonly idsByEnvironment = new Map<string, Set<string>>();

  public save(record: DeploymentRecord): DeploymentRecord {
    this.recordsById.set(record.deploymentId, record);
    const environmentId = record.provisionedEnvironmentId;
    const existing = this.idsByEnvironment.get(environmentId) ?? new Set<string>();
    existing.add(record.deploymentId);
    this.idsByEnvironment.set(environmentId, existing);
    return record;
  }

  public getById(deploymentId: string): DeploymentRecord | undefined {
    const normalized = deploymentId.trim();
    return normalized ? this.recordsById.get(normalized) : undefined;
  }

  public listByEnvironment(environmentId: string): ReadonlyArray<DeploymentRecord> {
    const normalized = environmentId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    const ids = this.idsByEnvironment.get(normalized);
    if (!ids) {
      return Object.freeze([]);
    }

    return Object.freeze([...ids]
      .map((id) => this.recordsById.get(id))
      .filter((entry): entry is DeploymentRecord => Boolean(entry))
      .sort((left, right) => right.deployedAt.localeCompare(left.deployedAt)));
  }
}

export class DeploymentExecutionService {
  public constructor(
    private readonly provisioningCompatibilityValidator: EnvironmentProvisioningCompatibilityValidator = new EnvironmentProvisioningCompatibilityValidator(),
    private readonly repository: DeploymentRecordRepository = new InMemoryDeploymentRecordRepository(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public execute(request: DeploymentExecutionRequest): DeploymentExecutionResult {
    const normalizedRequest = createDeploymentExecutionRequest(request);

    const issues = this.validatePreconditions(normalizedRequest);
    if (issues.length > 0) {
      return Object.freeze({
        status: DeploymentStatuses.rejected,
        issues: Object.freeze(issues),
      });
    }

    const deployment = this.createDeploymentRecord(normalizedRequest);
    this.repository.save(deployment);

    return Object.freeze({
      status: DeploymentStatuses.succeeded,
      deployment,
      issues: Object.freeze([]),
    });
  }

  public getDeployment(deploymentId: string): DeploymentRecord | undefined {
    return this.repository.getById(deploymentId);
  }

  public listDeploymentsForEnvironment(environmentId: string): ReadonlyArray<DeploymentRecord> {
    return this.repository.listByEnvironment(environmentId);
  }

  private validatePreconditions(request: DeploymentExecutionRequest): Array<{ readonly code: string; readonly message: string }> {
    const issues: Array<{ readonly code: string; readonly message: string }> = [];

    const compatibility = this.provisioningCompatibilityValidator.validate({
      bundle: request.bundle,
      deploymentConfiguration: request.deploymentConfiguration,
      target: request.target,
    });
    if (!compatibility.compatible) {
      issues.push(...compatibility.issues.map((issue) => ({
        code: "deployment-input-incompatible",
        message: issue.message,
      })));
    }

    this.validateProvisionedEnvironmentLinkage(request.provisionedEnvironment, request, issues);

    return issues;
  }

  private validateProvisionedEnvironmentLinkage(
    provisionedEnvironment: ProvisionedDeploymentEnvironment,
    request: DeploymentExecutionRequest,
    issues: Array<{ readonly code: string; readonly message: string }>,
  ): void {
    if (provisionedEnvironment.targetId !== request.target.targetId.value || provisionedEnvironment.targetType !== request.target.type) {
      issues.push({
        code: "provisioned-environment-target-mismatch",
        message: "Provisioned environment target linkage does not match deployment request target.",
      });
    }

    if (provisionedEnvironment.bundleId !== request.bundle.bundleId.value) {
      issues.push({
        code: "provisioned-environment-bundle-mismatch",
        message: "Provisioned environment bundle linkage does not match deployment request bundle.",
      });
    }

    if (provisionedEnvironment.bundleReproducibilityKey !== request.bundle.manifest.build.reproducibilityKey) {
      issues.push({
        code: "provisioned-environment-version-mismatch",
        message: "Provisioned environment is not pinned to the requested bundle reproducibility key.",
      });
    }

    if (provisionedEnvironment.deploymentConfigurationId !== request.deploymentConfiguration.configurationId.value) {
      issues.push({
        code: "provisioned-environment-config-mismatch",
        message: "Provisioned environment configuration linkage does not match deployment request configuration.",
      });
    }
  }

  private createDeploymentRecord(request: DeploymentExecutionRequest): DeploymentRecord {
    const nestedSystemCount = request.bundle.manifest.package.dependencyVersionSnapshot
      .filter((entry) => entry.assetId.startsWith("system:"))
      .length;

    const determinismPayload = JSON.stringify({
      requestId: request.requestId,
      bundleId: request.bundle.bundleId.value,
      buildKey: request.bundle.manifest.build.reproducibilityKey,
      configurationId: request.deploymentConfiguration.configurationId.value,
      targetId: request.target.targetId.value,
      targetType: request.target.type,
      environmentId: request.provisionedEnvironment.environmentId,
    });
    const deploymentDeterminismKey = createHash("sha256").update(determinismPayload).digest("hex");

    return Object.freeze({
      deploymentId: `deployment:${request.bundle.manifest.package.packageId}:${deploymentDeterminismKey.slice(0, 16)}`,
      requestId: request.requestId,
      status: DeploymentStatuses.succeeded,
      bundleId: request.bundle.bundleId.value,
      bundleVersionKey: request.bundle.manifest.build.reproducibilityKey,
      packageId: request.bundle.manifest.package.packageId,
      rootSystemAssetId: request.bundle.manifest.package.rootSystemAssetId,
      rootSystemVersionId: request.bundle.manifest.package.rootSystemVersionId,
      deploymentConfigurationId: request.deploymentConfiguration.configurationId.value,
      targetId: request.target.targetId.value,
      targetType: request.target.type,
      provisionedEnvironmentId: request.provisionedEnvironment.environmentId,
      nestedSystemCount,
      deployedAt: this.clock().toISOString(),
      metadata: Object.freeze({
        deploymentDeterminismKey,
        notes: Object.freeze([
          `bundle:${request.bundle.bundleId.value}`,
          `configuration:${request.deploymentConfiguration.configurationId.value}`,
          `environment:${request.provisionedEnvironment.environmentId}`,
        ]),
      }),
    });
  }
}

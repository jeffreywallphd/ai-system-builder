import { createHash } from "node:crypto";
import {
  createDeploymentExecutionRequest,
  createDeploymentLifecycleRequest,
  DeploymentActivationActionKinds,
  DeploymentActivationStates,
  DeploymentStatuses,
  type DeploymentExecutionRequest,
  type DeploymentExecutionResult,
  type DeploymentLifecycleRequest,
  type DeploymentRecord,
} from "../../domain/deployment/DeploymentExecutionDomain";
import { DeploymentLogLevels } from "../../domain/deployment/DeploymentDiagnosticsDomain";
import {
  EnvironmentProvisioningStatuses,
  type EnvironmentProvisioningInterface,
  type ProvisionedDeploymentEnvironment,
} from "../../domain/deployment/EnvironmentProvisioningDomain";
import { DeploymentStates, type DeploymentStateSnapshot, type DeploymentStateTransition } from "../../domain/deployment/DeploymentStateDomain";
import { DeploymentDiagnosticsService, InMemoryDeploymentDiagnosticsRepository } from "./DeploymentDiagnosticsService";
import { EnvironmentProvisioningCompatibilityValidator } from "./EnvironmentProvisioningCompatibilityValidator";
import { EnvironmentProvisioningService } from "./EnvironmentProvisioningService";
import { DeploymentStateTracker } from "./DeploymentStateTracker";

export interface DeploymentRecordRepository {
  save(record: DeploymentRecord): DeploymentRecord;
  getById(deploymentId: string): DeploymentRecord | undefined;
  listAll(): ReadonlyArray<DeploymentRecord>;
  listByEnvironment(environmentId: string): ReadonlyArray<DeploymentRecord>;
  listByState(state: DeploymentRecord["state"]): ReadonlyArray<DeploymentRecord>;
}

export class InMemoryDeploymentRecordRepository implements DeploymentRecordRepository {
  private readonly recordsById = new Map<string, DeploymentRecord>();
  private readonly idsByEnvironment = new Map<string, Set<string>>();

  public save(record: DeploymentRecord): DeploymentRecord {
    this.recordsById.set(record.deploymentId, record);
    const environmentId = record.provisionedEnvironmentId;
    if (environmentId) {
      const existing = this.idsByEnvironment.get(environmentId) ?? new Set<string>();
      existing.add(record.deploymentId);
      this.idsByEnvironment.set(environmentId, existing);
    }
    return record;
  }

  public getById(deploymentId: string): DeploymentRecord | undefined {
    const normalized = deploymentId.trim();
    return normalized ? this.recordsById.get(normalized) : undefined;
  }

  public listAll(): ReadonlyArray<DeploymentRecord> {
    return Object.freeze([...this.recordsById.values()].sort((left, right) => right.deployedAt.localeCompare(left.deployedAt)));
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

  public listByState(state: DeploymentRecord["state"]): ReadonlyArray<DeploymentRecord> {
    return Object.freeze([...this.recordsById.values()]
      .filter((entry) => entry.state === state)
      .sort((left, right) => right.deployedAt.localeCompare(left.deployedAt)));
  }
}

export class DeploymentExecutionService {
  public constructor(
    private readonly provisioningCompatibilityValidator: EnvironmentProvisioningCompatibilityValidator = new EnvironmentProvisioningCompatibilityValidator(),
    private readonly repository: DeploymentRecordRepository = new InMemoryDeploymentRecordRepository(),
    private readonly clock: () => Date = () => new Date(),
    private readonly provisioningInterface: EnvironmentProvisioningInterface = new EnvironmentProvisioningService(),
    private readonly stateTracker: DeploymentStateTracker = new DeploymentStateTracker(),
    private readonly diagnosticsService: DeploymentDiagnosticsService = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => this.clock()),
  ) {}

  public executeLifecycle(request: DeploymentLifecycleRequest): DeploymentExecutionResult {
    const normalized = createDeploymentLifecycleRequest(request);
    const deploymentId = this.deriveDeploymentId({
      requestId: normalized.requestId,
      bundleId: normalized.bundle.bundleId.value,
      buildKey: normalized.bundle.manifest.build.reproducibilityKey,
      configurationId: normalized.deploymentConfiguration.configurationId.value,
      targetId: normalized.target.targetId.value,
      targetType: normalized.target.type,
      environmentId: "pending-provisioning",
    });

    let record = this.initializeDeploymentRecord({
      deploymentId,
      requestId: normalized.requestId,
      bundleId: normalized.bundle.bundleId.value,
      bundleVersionKey: normalized.bundle.manifest.build.reproducibilityKey,
      packageId: normalized.bundle.manifest.package.packageId,
      rootSystemAssetId: normalized.bundle.manifest.package.rootSystemAssetId,
      rootSystemVersionId: normalized.bundle.manifest.package.rootSystemVersionId,
      deploymentConfigurationId: normalized.deploymentConfiguration.configurationId.value,
      targetId: normalized.target.targetId.value,
      targetType: normalized.target.type,
      nestedSystemCount: normalized.bundle.manifest.package.dependencyVersionSnapshot.filter((entry) => entry.assetId.startsWith("system:")).length,
      deployedAt: this.clock().toISOString(),
    });

    record = this.transitionRecord(record, DeploymentStates.provisioningInProgress, "provisioning-started");

    const provisioning = this.provisioningInterface.provision({
      requestId: `${normalized.requestId}:provision`,
      bundle: normalized.bundle,
      deploymentConfiguration: normalized.deploymentConfiguration,
      target: normalized.target,
      requestedAt: normalized.requestedAt,
    });

    this.diagnosticsService.logEvent({
      deploymentId: record.deploymentId,
      eventKind: "provisioning-result",
      message: `Provisioning ${provisioning.status}.`,
      level: provisioning.status === EnvironmentProvisioningStatuses.ready ? DeploymentLogLevels.info : DeploymentLogLevels.warning,
      details: Object.freeze({
        requestId: provisioning.requestId,
        status: provisioning.status,
        planId: provisioning.plan.planId,
      }),
    });

    if (provisioning.status !== EnvironmentProvisioningStatuses.ready || !provisioning.provisionedEnvironment) {
      for (const issue of provisioning.issues) {
        this.diagnosticsService.recordFailure({
          deploymentId: record.deploymentId,
          eventKind: "provisioning-failure",
          code: issue.code,
          summary: issue.message,
        });
      }
      const failed = this.transitionRecord(record, DeploymentStates.failed, "provisioning-failed");
      this.repository.save(failed);
      return Object.freeze({
        status: DeploymentStatuses.rejected,
        deployment: failed,
        issues: provisioning.issues,
      });
    }

    record = this.withProvisionedEnvironment(record, provisioning.provisionedEnvironment);
    record = this.transitionRecord(record, DeploymentStates.provisioningComplete, "provisioning-complete");
    record = this.transitionRecord(record, DeploymentStates.deploymentInProgress, "deployment-started");

    const execution = this.execute({
      requestId: normalized.requestId,
      bundle: normalized.bundle,
      deploymentConfiguration: normalized.deploymentConfiguration,
      target: normalized.target,
      provisionedEnvironment: provisioning.provisionedEnvironment,
      requestedAt: normalized.requestedAt,
    }, record);

    return execution;
  }

  public execute(request: DeploymentExecutionRequest, existingRecord?: DeploymentRecord): DeploymentExecutionResult {
    const normalizedRequest = createDeploymentExecutionRequest(request);

    let record = existingRecord ?? this.createDeploymentRecord(normalizedRequest);
    if (!existingRecord) {
      this.repository.save(record);
      record = this.transitionRecord(record, DeploymentStates.deploymentInProgress, "deployment-started-with-preprovisioned-environment");
    }

    const issues = this.validatePreconditions(normalizedRequest);
    if (issues.length > 0) {
      for (const issue of issues) {
        this.diagnosticsService.recordFailure({
          deploymentId: record.deploymentId,
          eventKind: "deployment-failure",
          code: issue.code,
          summary: issue.message,
        });
      }
      const failed = this.transitionRecord(record, DeploymentStates.failed, "deployment-preconditions-failed");
      this.repository.save(failed);
      return Object.freeze({
        status: DeploymentStatuses.rejected,
        deployment: failed,
        issues: Object.freeze(issues),
      });
    }

    const succeeded = this.transitionRecord(record, DeploymentStates.active, "deployment-succeeded");
    const persisted = this.repository.save(Object.freeze({
      ...succeeded,
      status: DeploymentStatuses.succeeded,
      provisionedEnvironmentId: normalizedRequest.provisionedEnvironment.environmentId,
    }));

    this.diagnosticsService.logEvent({
      deploymentId: persisted.deploymentId,
      eventKind: "deployment-result",
      message: "Deployment execution completed successfully.",
      details: Object.freeze({
        environmentId: normalizedRequest.provisionedEnvironment.environmentId,
        targetId: normalizedRequest.target.targetId.value,
      }),
    });

    return Object.freeze({
      status: DeploymentStatuses.succeeded,
      deployment: persisted,
      issues: Object.freeze([]),
    });
  }

  public getDeployment(deploymentId: string): DeploymentRecord | undefined {
    return this.repository.getById(deploymentId);
  }

  public listDeploymentsForEnvironment(environmentId: string): ReadonlyArray<DeploymentRecord> {
    return this.repository.listByEnvironment(environmentId);
  }

  public listDeploymentsByState(state: DeploymentRecord["state"]): ReadonlyArray<DeploymentRecord> {
    return this.repository.listByState(state);
  }

  public getDeploymentStateSnapshot(deploymentId: string): DeploymentStateSnapshot | undefined {
    return this.repository.getById(deploymentId)?.stateSnapshot;
  }

  public listStateTransitions(deploymentId: string): ReadonlyArray<DeploymentStateTransition> {
    return this.repository.getById(deploymentId)?.stateTransitions ?? Object.freeze([]);
  }

  public listDeploymentLogs(deploymentId: string) {
    return this.diagnosticsService.listLogs(deploymentId);
  }

  public listDeploymentDiagnostics(deploymentId: string) {
    return this.diagnosticsService.listDiagnostics(deploymentId);
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

    const deploymentDeterminismKey = this.deriveDeploymentDeterminismKey({
      requestId: request.requestId,
      bundleId: request.bundle.bundleId.value,
      buildKey: request.bundle.manifest.build.reproducibilityKey,
      configurationId: request.deploymentConfiguration.configurationId.value,
      targetId: request.target.targetId.value,
      targetType: request.target.type,
      environmentId: request.provisionedEnvironment.environmentId,
    });

    return this.initializeDeploymentRecord({
      deploymentId: `deployment:${request.bundle.manifest.package.packageId}:${deploymentDeterminismKey.slice(0, 16)}`,
      requestId: request.requestId,
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

  private initializeDeploymentRecord(input: {
    readonly deploymentId: string;
    readonly requestId: string;
    readonly bundleId: string;
    readonly bundleVersionKey: string;
    readonly packageId: string;
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly deploymentConfigurationId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly provisionedEnvironmentId?: string;
    readonly nestedSystemCount: number;
    readonly deployedAt: string;
    readonly metadata?: DeploymentRecord["metadata"];
  }): DeploymentRecord {
    const initial = this.stateTracker.initialize({ deploymentId: input.deploymentId, at: input.deployedAt, initialState: DeploymentStates.requested });
    this.diagnosticsService.logStateTransition({ deploymentId: input.deploymentId, transition: initial.transitions[0]! });

    const metadata = input.metadata ?? Object.freeze({
      deploymentDeterminismKey: this.deriveDeploymentDeterminismKey({
        requestId: input.requestId,
        bundleId: input.bundleId,
        buildKey: input.bundleVersionKey,
        configurationId: input.deploymentConfigurationId,
        targetId: input.targetId,
        targetType: input.targetType,
        environmentId: input.provisionedEnvironmentId ?? "pending-provisioning",
      }),
      notes: Object.freeze([
        `bundle:${input.bundleId}`,
        `configuration:${input.deploymentConfigurationId}`,
      ]),
    });

    return Object.freeze({
      deploymentId: input.deploymentId,
      requestId: input.requestId,
      status: DeploymentStatuses.pending,
      state: initial.state,
      stateSnapshot: initial.snapshot,
      stateTransitions: initial.transitions,
      activationState: DeploymentActivationStates.inactive,
      activationUpdatedAt: input.deployedAt,
      activationHistory: Object.freeze([{
        eventId: `${input.deploymentId}:activation:0`,
        deploymentId: input.deploymentId,
        toState: DeploymentActivationStates.inactive,
        actionKind: DeploymentActivationActionKinds.initialized,
        reason: "deployment-record-initialized",
        at: input.deployedAt,
      }]),
      bundleId: input.bundleId,
      bundleVersionKey: input.bundleVersionKey,
      packageId: input.packageId,
      rootSystemAssetId: input.rootSystemAssetId,
      rootSystemVersionId: input.rootSystemVersionId,
      deploymentConfigurationId: input.deploymentConfigurationId,
      targetId: input.targetId,
      targetType: input.targetType,
      provisionedEnvironmentId: input.provisionedEnvironmentId,
      nestedSystemCount: input.nestedSystemCount,
      deployedAt: input.deployedAt,
      metadata,
    });
  }

  private transitionRecord(record: DeploymentRecord, toState: DeploymentRecord["state"], reason: string): DeploymentRecord {
    const transitioned = this.stateTracker.transition({
      deploymentId: record.deploymentId,
      currentState: record.state,
      transitions: record.stateTransitions,
      toState,
      at: this.clock().toISOString(),
      reason,
    });
    this.diagnosticsService.logStateTransition({ deploymentId: record.deploymentId, transition: transitioned.transition });

    return Object.freeze({
      ...record,
      state: transitioned.state,
      stateSnapshot: transitioned.snapshot,
      stateTransitions: transitioned.transitions,
      status: transitioned.state === DeploymentStates.failed ? DeploymentStatuses.rejected : record.status,
    });
  }

  public setDeploymentActivationState(input: {
    readonly deploymentId: string;
    readonly toState: DeploymentRecord["activationState"];
    readonly reason: string;
    readonly actionKind: "deployment" | "version-management" | "rollback";
    readonly relatedDeploymentId?: string;
  }): DeploymentRecord {
    const record = this.repository.getById(input.deploymentId);
    if (!record) {
      throw new Error(`Deployment '${input.deploymentId}' was not found.`);
    }

    if (record.activationState === input.toState) {
      return record;
    }

    const at = this.clock().toISOString();
    const activationEvent = Object.freeze({
      eventId: `${record.deploymentId}:activation:${record.activationHistory.length}`,
      deploymentId: record.deploymentId,
      fromState: record.activationState,
      toState: input.toState,
      actionKind: input.actionKind,
      reason: input.reason,
      at,
      relatedDeploymentId: input.relatedDeploymentId,
    } satisfies DeploymentRecord["activationHistory"][number]);

    const updated = Object.freeze({
      ...record,
      activationState: input.toState,
      activationUpdatedAt: at,
      activationHistory: Object.freeze([...record.activationHistory, activationEvent]),
    });

    this.diagnosticsService.logEvent({
      deploymentId: updated.deploymentId,
      eventKind: "activation-transition",
      message: `Deployment activation changed from '${record.activationState}' to '${updated.activationState}'.`,
      details: Object.freeze({
        fromState: record.activationState,
        toState: updated.activationState,
        actionKind: input.actionKind,
      }),
    });

    return this.repository.save(updated);
  }

  private withProvisionedEnvironment(record: DeploymentRecord, environment: ProvisionedDeploymentEnvironment): DeploymentRecord {
    return Object.freeze({
      ...record,
      provisionedEnvironmentId: environment.environmentId,
      metadata: Object.freeze({
        ...record.metadata,
        notes: Object.freeze([...record.metadata.notes, `environment:${environment.environmentId}`]),
      }),
    });
  }

  private deriveDeploymentId(input: {
    readonly requestId: string;
    readonly bundleId: string;
    readonly buildKey: string;
    readonly configurationId: string;
    readonly targetId: string;
    readonly targetType: string;
    readonly environmentId: string;
  }): string {
    const key = this.deriveDeploymentDeterminismKey(input);
    return `deployment:${input.bundleId}:${key.slice(0, 16)}`;
  }

  private deriveDeploymentDeterminismKey(input: {
    readonly requestId: string;
    readonly bundleId: string;
    readonly buildKey: string;
    readonly configurationId: string;
    readonly targetId: string;
    readonly targetType: string;
    readonly environmentId: string;
  }): string {
    const determinismPayload = JSON.stringify(input);
    return createHash("sha256").update(determinismPayload).digest("hex");
  }
}

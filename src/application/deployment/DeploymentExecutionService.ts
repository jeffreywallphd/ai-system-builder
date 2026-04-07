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
  deriveDeploymentIsolationIds,
  type DeploymentEnvironmentContext,
  type IsolatedDeploymentScope,
} from "../../domain/deployment/DeploymentIsolationDomain";
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
import {
  DeploymentAccessActions,
  DeploymentAccessEvaluator,
  type DeploymentAccessContext,
} from "./DeploymentAccessControl";
import {
  DeploymentQuotaActions,
  DeploymentQuotaEvaluator,
} from "./DeploymentQuotaEvaluator";
import { DeploymentIsolationEvaluator } from "./DeploymentIsolationEvaluator";
import { DeploymentAuditEventKinds, DeploymentAuditOutcomes } from "../../domain/deployment/DeploymentAuditTrailDomain";
import type { DeploymentAuditTrailService } from "./DeploymentAuditTrailService";

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
    private readonly accessEvaluator: DeploymentAccessEvaluator = new DeploymentAccessEvaluator(),
    private readonly quotaEvaluator: DeploymentQuotaEvaluator = new DeploymentQuotaEvaluator(),
    private readonly isolationEvaluator: DeploymentIsolationEvaluator = new DeploymentIsolationEvaluator(),
    private readonly auditTrailService?: DeploymentAuditTrailService,
  ) {}

  public executeLifecycle(
    request: DeploymentLifecycleRequest,
    governance?: { readonly accessContext?: DeploymentAccessContext; readonly resourceTenantId?: string; readonly requestSource?: string },
  ): DeploymentExecutionResult {
    const normalized = createDeploymentLifecycleRequest(request);
    this.assertDeploymentAccess({
      action: DeploymentAccessActions.executeDeployment,
      accessContext: governance?.accessContext,
      resourceTenantId: governance?.resourceTenantId,
      requestSource: governance?.requestSource,
      rootSystemAssetId: normalized.bundle.manifest.package.rootSystemAssetId,
      rootSystemVersionId: normalized.bundle.manifest.package.rootSystemVersionId,
      targetId: normalized.target.targetId.value,
      targetType: normalized.target.type,
    });
    this.assertDeploymentQuota({
      action: DeploymentQuotaActions.executeDeployment,
      accessContext: governance?.accessContext,
      rootSystemAssetId: normalized.bundle.manifest.package.rootSystemAssetId,
      rootSystemVersionId: normalized.bundle.manifest.package.rootSystemVersionId,
      targetId: normalized.target.targetId.value,
      targetType: normalized.target.type,
    });
    this.auditTrailService?.record({
      eventKind: DeploymentAuditEventKinds.deploymentRequested,
      outcome: DeploymentAuditOutcomes.accepted,
      requestSource: this.normalizeRequestSource(governance?.requestSource),
      caller: this.normalizeCaller(governance?.accessContext),
      tenant: Object.freeze({
        tenantId: governance?.resourceTenantId ?? governance?.accessContext?.tenantId,
        source: governance?.requestSource,
      }),
      deployment: Object.freeze({
        requestId: normalized.requestId,
        rootSystemAssetId: normalized.bundle.manifest.package.rootSystemAssetId,
        rootSystemVersionId: normalized.bundle.manifest.package.rootSystemVersionId,
        bundleId: normalized.bundle.bundleId.value,
        bundleVersionKey: normalized.bundle.manifest.build.reproducibilityKey,
        deploymentConfigurationId: normalized.deploymentConfiguration.configurationId.value,
        targetId: normalized.target.targetId.value,
        targetType: normalized.target.type,
      }),
      detail: Object.freeze({ message: "Deployment lifecycle execution requested." }),
      occurredAt: this.clock().toISOString(),
    });

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
      isolationContext: this.createIsolationContext({
        accessContext: governance?.accessContext,
        resourceTenantId: governance?.resourceTenantId,
        source: governance?.requestSource,
        targetId: normalized.target.targetId.value,
        targetType: normalized.target.type,
        deploymentEnvironmentId: "pending-provisioning",
      }),
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
      this.recordDeploymentOutcomeAudit({
        eventKind: DeploymentAuditEventKinds.deploymentRejected,
        outcome: DeploymentAuditOutcomes.rejected,
        record: failed,
        requestSource: governance?.requestSource,
        accessContext: governance?.accessContext,
        resourceTenantId: governance?.resourceTenantId,
        message: "Deployment rejected because provisioning did not produce a ready environment.",
        errorCode: provisioning.issues[0]?.code,
      });
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
    }, record, {
      skipGovernanceChecks: true,
      accessContext: governance?.accessContext,
      resourceTenantId: governance?.resourceTenantId,
      requestSource: governance?.requestSource,
    });

    return execution;
  }

  public execute(
    request: DeploymentExecutionRequest,
    existingRecord?: DeploymentRecord,
    governance?: {
      readonly skipGovernanceChecks?: boolean;
      readonly accessContext?: DeploymentAccessContext;
      readonly resourceTenantId?: string;
      readonly requestSource?: string;
    },
  ): DeploymentExecutionResult {
    const normalizedRequest = createDeploymentExecutionRequest(request);
    if (!governance?.skipGovernanceChecks) {
      this.assertDeploymentAccess({
        action: DeploymentAccessActions.executeDeployment,
        accessContext: governance?.accessContext,
        resourceTenantId: governance?.resourceTenantId,
        requestSource: governance?.requestSource,
        rootSystemAssetId: normalizedRequest.bundle.manifest.package.rootSystemAssetId,
        rootSystemVersionId: normalizedRequest.bundle.manifest.package.rootSystemVersionId,
        targetId: normalizedRequest.target.targetId.value,
        targetType: normalizedRequest.target.type,
      });
      this.assertDeploymentQuota({
        action: DeploymentQuotaActions.executeDeployment,
        accessContext: governance?.accessContext,
        rootSystemAssetId: normalizedRequest.bundle.manifest.package.rootSystemAssetId,
        rootSystemVersionId: normalizedRequest.bundle.manifest.package.rootSystemVersionId,
        targetId: normalizedRequest.target.targetId.value,
        targetType: normalizedRequest.target.type,
      });
    }

    let record = existingRecord ?? this.createDeploymentRecord(normalizedRequest, governance);
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
      this.recordDeploymentOutcomeAudit({
        eventKind: DeploymentAuditEventKinds.deploymentRejected,
        outcome: DeploymentAuditOutcomes.rejected,
        record: failed,
        requestSource: governance?.requestSource,
        accessContext: governance?.accessContext,
        resourceTenantId: governance?.resourceTenantId,
        message: "Deployment rejected because preconditions failed.",
        errorCode: issues[0]?.code,
      });
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
    this.recordDeploymentOutcomeAudit({
      eventKind: DeploymentAuditEventKinds.deploymentSucceeded,
      outcome: DeploymentAuditOutcomes.succeeded,
      record: persisted,
      requestSource: governance?.requestSource,
      accessContext: governance?.accessContext,
      resourceTenantId: governance?.resourceTenantId,
      message: "Deployment execution completed successfully.",
    });

    return Object.freeze({
      status: DeploymentStatuses.succeeded,
      deployment: persisted,
      issues: Object.freeze([]),
    });
  }

  public getDeployment(deploymentId: string): DeploymentRecord | undefined {
    const record = this.repository.getById(deploymentId);
    return record;
  }

  public getDeploymentIsolated(input: {
    readonly deploymentId: string;
    readonly isolationContext?: DeploymentEnvironmentContext;
  }): DeploymentRecord | undefined {
    const record = this.repository.getById(input.deploymentId);
    if (!record) {
      return undefined;
    }
    this.isolationEvaluator.assertRecordAccessible({
      record,
      context: input.isolationContext,
      expectedDeploymentId: input.deploymentId,
    });
    return record;
  }

  public listDeploymentsForEnvironment(
    environmentId: string,
    isolationContext?: DeploymentEnvironmentContext,
  ): ReadonlyArray<DeploymentRecord> {
    const records = this.repository.listByEnvironment(environmentId);
    return this.isolationEvaluator.filterRecords({ records, context: isolationContext });
  }

  public listDeploymentsByState(
    state: DeploymentRecord["state"],
    isolationContext?: DeploymentEnvironmentContext,
  ): ReadonlyArray<DeploymentRecord> {
    const records = this.repository.listByState(state);
    return this.isolationEvaluator.filterRecords({ records, context: isolationContext });
  }

  public getDeploymentStateSnapshot(
    deploymentId: string,
    isolationContext?: DeploymentEnvironmentContext,
  ): DeploymentStateSnapshot | undefined {
    return this.getDeploymentIsolated({ deploymentId, isolationContext })?.stateSnapshot;
  }

  public listStateTransitions(
    deploymentId: string,
    isolationContext?: DeploymentEnvironmentContext,
  ): ReadonlyArray<DeploymentStateTransition> {
    return this.getDeploymentIsolated({ deploymentId, isolationContext })?.stateTransitions ?? Object.freeze([]);
  }

  public listDeploymentLogs(deploymentId: string, isolationContext?: DeploymentEnvironmentContext) {
    this.getDeploymentIsolated({ deploymentId, isolationContext });
    return this.diagnosticsService.listLogs(deploymentId);
  }

  public listDeploymentDiagnostics(deploymentId: string, isolationContext?: DeploymentEnvironmentContext) {
    this.getDeploymentIsolated({ deploymentId, isolationContext });
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

  private createDeploymentRecord(
    request: DeploymentExecutionRequest,
    governance?: {
      readonly accessContext?: DeploymentAccessContext;
      readonly resourceTenantId?: string;
      readonly requestSource?: string;
    },
  ): DeploymentRecord {
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
      isolationContext: this.createIsolationContext({
        accessContext: governance?.accessContext,
        resourceTenantId: governance?.resourceTenantId,
        source: governance?.requestSource,
        targetId: request.target.targetId.value,
        targetType: request.target.type,
        deploymentEnvironmentId: request.provisionedEnvironment.environmentId,
      }),
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
    readonly isolationContext: DeploymentEnvironmentContext;
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
      isolation: this.createIsolatedScope({
        deploymentId: input.deploymentId,
        rootSystemAssetId: input.rootSystemAssetId,
        rootSystemVersionId: input.rootSystemVersionId,
        bundleId: input.bundleId,
        bundleVersionKey: input.bundleVersionKey,
        packageId: input.packageId,
        deploymentConfigurationId: input.deploymentConfigurationId,
        targetId: input.targetId,
        targetType: input.targetType,
        nestedSystemCount: input.nestedSystemCount,
        deploymentEnvironmentId: input.provisionedEnvironmentId ?? input.isolationContext.deploymentEnvironmentId ?? "pending-provisioning",
        tenantId: input.isolationContext.tenantId,
        context: input.isolationContext,
      }),
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
      isolation: Object.freeze({
        ...record.isolation,
        context: Object.freeze({
          ...record.isolation.context,
          deploymentEnvironmentId: environment.environmentId,
          targetId: environment.targetId,
          targetType: environment.targetType,
        }),
        boundary: Object.freeze({
          ...record.isolation.boundary,
          deploymentEnvironmentId: environment.environmentId,
          targetId: environment.targetId,
          targetType: environment.targetType,
        }),
      }),
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

  private assertDeploymentAccess(input: {
    readonly action: typeof DeploymentAccessActions[keyof typeof DeploymentAccessActions];
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
    readonly rootSystemAssetId?: string;
    readonly rootSystemVersionId?: string;
    readonly deploymentId?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
  }): void {
    this.accessEvaluator.assertAllowed({
      action: input.action,
      context: input.accessContext
        ? Object.freeze({
          ...input.accessContext,
          source: input.requestSource ?? input.accessContext.source,
        })
        : undefined,
      resourceTenantId: input.resourceTenantId,
      rootSystemAssetId: input.rootSystemAssetId,
      rootSystemVersionId: input.rootSystemVersionId,
      deploymentId: input.deploymentId,
      targetId: input.targetId,
      targetType: input.targetType,
    });
  }

  private assertDeploymentQuota(input: {
    readonly action: typeof DeploymentQuotaActions[keyof typeof DeploymentQuotaActions];
    readonly accessContext?: DeploymentAccessContext;
    readonly rootSystemAssetId?: string;
    readonly rootSystemVersionId?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
  }): void {
    this.quotaEvaluator.assertAllowed({
      action: input.action,
      accessContext: input.accessContext,
      rootSystemAssetId: input.rootSystemAssetId,
      rootSystemVersionId: input.rootSystemVersionId,
      targetId: input.targetId,
      targetType: input.targetType,
    });
  }

  private createIsolationContext(input: {
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly source?: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly deploymentEnvironmentId: string;
  }): DeploymentEnvironmentContext {
    return Object.freeze({
      tenantId: input.resourceTenantId?.trim() || input.accessContext?.tenantId?.trim() || undefined,
      deploymentEnvironmentId: input.deploymentEnvironmentId.trim(),
      targetId: input.targetId.trim(),
      targetType: input.targetType,
      source: input.source?.trim() || input.accessContext?.source?.trim() || undefined,
      callerId: input.accessContext?.caller?.callerId?.trim() || undefined,
      sessionId: input.accessContext?.caller?.sessionId?.trim() || undefined,
    });
  }

  private createIsolatedScope(input: {
    readonly deploymentId: string;
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly bundleId: string;
    readonly bundleVersionKey: string;
    readonly packageId: string;
    readonly deploymentConfigurationId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly nestedSystemCount: number;
    readonly deploymentEnvironmentId: string;
    readonly tenantId?: string;
    readonly context: DeploymentEnvironmentContext;
  }): IsolatedDeploymentScope {
    const ids = deriveDeploymentIsolationIds({
      deploymentId: input.deploymentId,
      deploymentEnvironmentId: input.deploymentEnvironmentId,
      targetId: input.targetId,
      targetType: input.targetType,
      tenantId: input.tenantId,
    });
    return Object.freeze({
      scopeId: ids.scopeId,
      context: input.context,
      boundary: Object.freeze({
        boundaryId: ids.boundaryId,
        deploymentEnvironmentId: input.deploymentEnvironmentId,
        targetId: input.targetId,
        targetType: input.targetType,
        tenantId: input.tenantId,
      }),
      linkage: Object.freeze({
        deploymentId: input.deploymentId,
        rootSystemAssetId: input.rootSystemAssetId,
        rootSystemVersionId: input.rootSystemVersionId,
        bundleId: input.bundleId,
        bundleVersionKey: input.bundleVersionKey,
        packageId: input.packageId,
        deploymentConfigurationId: input.deploymentConfigurationId,
        targetId: input.targetId,
        targetType: input.targetType,
        nestedSystemCount: input.nestedSystemCount,
      }),
      runtimeBinding: Object.freeze({
        runtimeTenantId: input.tenantId,
        runtimeContextKey: ids.runtimeContextKey,
      }),
    });
  }

  private normalizeCaller(accessContext?: DeploymentAccessContext) {
    return Object.freeze({
      callerKind: accessContext?.caller?.callerKind,
      callerId: accessContext?.caller?.callerId,
      sessionId: accessContext?.caller?.sessionId,
      roles: accessContext?.caller?.roles,
      authenticatedPrincipalId: accessContext?.caller?.authenticatedPrincipalId,
    });
  }

  private normalizeRequestSource(source?: string): "deployment-api" | "external-api" | "studio-shell-internal" | "internal-trusted" | "unknown" {
    if (source === "deployment-api" || source === "external-api" || source === "studio-shell-internal" || source === "internal-trusted") {
      return source;
    }
    return "unknown";
  }

  private recordDeploymentOutcomeAudit(input: {
    readonly eventKind: typeof DeploymentAuditEventKinds[keyof typeof DeploymentAuditEventKinds];
    readonly outcome: typeof DeploymentAuditOutcomes[keyof typeof DeploymentAuditOutcomes];
    readonly record: DeploymentRecord;
    readonly requestSource?: string;
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly message: string;
    readonly errorCode?: string;
  }): void {
    this.auditTrailService?.record({
      eventKind: input.eventKind,
      outcome: input.outcome,
      requestSource: this.normalizeRequestSource(input.requestSource),
      caller: this.normalizeCaller(input.accessContext),
      tenant: Object.freeze({
        tenantId: input.resourceTenantId ?? input.accessContext?.tenantId ?? input.record.isolation.boundary.tenantId,
        source: input.requestSource,
      }),
      deployment: Object.freeze({
        deploymentId: input.record.deploymentId,
        requestId: input.record.requestId,
        rootSystemAssetId: input.record.rootSystemAssetId,
        rootSystemVersionId: input.record.rootSystemVersionId,
        bundleId: input.record.bundleId,
        bundleVersionKey: input.record.bundleVersionKey,
        deploymentConfigurationId: input.record.deploymentConfigurationId,
        targetId: input.record.targetId,
        targetType: input.record.targetType,
        deploymentEnvironmentId: input.record.provisionedEnvironmentId,
      }),
      detail: Object.freeze({
        message: input.message,
        errorCode: input.errorCode,
      }),
      occurredAt: this.clock().toISOString(),
    });
  }
}

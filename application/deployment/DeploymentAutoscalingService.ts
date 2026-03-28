import {
  createDeploymentScalingConfiguration,
  createScaleActionRequest,
  createScaleDecision,
  ScaleActionKinds,
  ScaleActionStatuses,
  ScaleDirections,
  type DeploymentScaleStatus,
  type DeploymentScalingConfiguration,
  type DeploymentScalingPolicy,
  type ScaleActionRequest,
  type ScaleDecision,
} from "../../domain/deployment/DeploymentAutoscalingDomain";
import { DeploymentActivationStates, DeploymentStatuses, type DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import { DeploymentStates } from "../../domain/deployment/DeploymentStateDomain";
import type { DeploymentRecordRepository } from "./DeploymentExecutionService";
import { DeploymentAuditEventKinds, DeploymentAuditOutcomes } from "../../domain/deployment/DeploymentAuditTrailDomain";
import type { DeploymentAuditTrailService } from "./DeploymentAuditTrailService";

export interface DeploymentScalingRepository {
  saveConfiguration(configuration: DeploymentScalingConfiguration): DeploymentScalingConfiguration;
  getConfigurationByDeploymentId(deploymentId: string): DeploymentScalingConfiguration | undefined;
  saveStatus(status: DeploymentScaleStatus): DeploymentScaleStatus;
  getStatusByDeploymentId(deploymentId: string): DeploymentScaleStatus | undefined;
  saveScaleAction(action: ScaleActionRequest): ScaleActionRequest;
  listScaleActionsByDeploymentId(deploymentId: string, limit?: number): ReadonlyArray<ScaleActionRequest>;
}

export class InMemoryDeploymentScalingRepository implements DeploymentScalingRepository {
  private readonly configurationsByDeploymentId = new Map<string, DeploymentScalingConfiguration>();
  private readonly statusesByDeploymentId = new Map<string, DeploymentScaleStatus>();
  private readonly actionsById = new Map<string, ScaleActionRequest>();

  public saveConfiguration(configuration: DeploymentScalingConfiguration): DeploymentScalingConfiguration {
    this.configurationsByDeploymentId.set(configuration.deploymentId, configuration);
    return configuration;
  }

  public getConfigurationByDeploymentId(deploymentId: string): DeploymentScalingConfiguration | undefined {
    const normalized = deploymentId.trim();
    return normalized ? this.configurationsByDeploymentId.get(normalized) : undefined;
  }

  public saveStatus(status: DeploymentScaleStatus): DeploymentScaleStatus {
    this.statusesByDeploymentId.set(status.deploymentId, status);
    return status;
  }

  public getStatusByDeploymentId(deploymentId: string): DeploymentScaleStatus | undefined {
    const normalized = deploymentId.trim();
    return normalized ? this.statusesByDeploymentId.get(normalized) : undefined;
  }

  public saveScaleAction(action: ScaleActionRequest): ScaleActionRequest {
    this.actionsById.set(action.actionId, action);
    return action;
  }

  public listScaleActionsByDeploymentId(deploymentId: string, limit = 100): ReadonlyArray<ScaleActionRequest> {
    const normalized = deploymentId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    return Object.freeze([...this.actionsById.values()]
      .filter((entry) => entry.deploymentId === normalized)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
      .slice(0, Math.max(0, limit)));
  }
}

export interface AutoscalingInterface {
  upsertScalingConfiguration(input: {
    readonly deploymentId: string;
    readonly minCapacity: number;
    readonly maxCapacity: number;
    readonly desiredCapacity: number;
    readonly policy: DeploymentScalingPolicy;
    readonly requestedBy: string;
    readonly caller?: {
      readonly callerKind?: string;
      readonly callerId?: string;
      readonly sessionId?: string;
      readonly roles?: ReadonlyArray<string>;
      readonly authenticatedPrincipalId?: string;
    };
    readonly tenantId?: string;
    readonly requestSource?: string;
  }): DeploymentScalingConfiguration;
  getScaleStatus(deploymentId: string): DeploymentScaleStatus | undefined;
  evaluateScaleDecision(input: {
    readonly deploymentId: string;
    readonly observedCapacity: number;
    readonly observedUtilizationPercent?: number;
    readonly observedHealthStatus?: string;
    readonly evaluatedAt?: string;
  }): ScaleDecision;
  requestScaleAction(input: {
    readonly deploymentId: string;
    readonly requestedCapacity: number;
    readonly requestedBy: string;
    readonly reason?: string;
    readonly actionKind?: ScaleActionRequest["actionKind"];
    readonly decision?: ScaleDecision;
    readonly caller?: AutoscalingInterface["upsertScalingConfiguration"] extends (input: infer T) => unknown ? T extends { readonly caller?: infer C } ? C : never : never;
    readonly tenantId?: string;
    readonly requestSource?: string;
  }): ScaleActionRequest;
}

export class DeploymentAutoscalingService implements AutoscalingInterface {
  public constructor(
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly scalingRepository: DeploymentScalingRepository = new InMemoryDeploymentScalingRepository(),
    private readonly clock: () => Date = () => new Date(),
    private readonly auditTrailService?: DeploymentAuditTrailService,
  ) {}

  public upsertScalingConfiguration(input: {
    readonly deploymentId: string;
    readonly minCapacity: number;
    readonly maxCapacity: number;
    readonly desiredCapacity: number;
    readonly policy: DeploymentScalingPolicy;
    readonly requestedBy: string;
    readonly caller?: {
      readonly callerKind?: string;
      readonly callerId?: string;
      readonly sessionId?: string;
      readonly roles?: ReadonlyArray<string>;
      readonly authenticatedPrincipalId?: string;
    };
    readonly tenantId?: string;
    readonly requestSource?: string;
  }): DeploymentScalingConfiguration {
    const record = this.requireActiveDeployment(input.deploymentId);
    const now = this.clock().toISOString();
    const previous = this.scalingRepository.getConfigurationByDeploymentId(record.deploymentId);

    const configuration = createDeploymentScalingConfiguration({
      configurationId: previous?.configurationId ?? `deployment-scaling:${record.deploymentId}`,
      deploymentId: record.deploymentId,
      rootSystemAssetId: record.rootSystemAssetId,
      rootSystemVersionId: record.rootSystemVersionId,
      bundleId: record.bundleId,
      bundleVersionKey: record.bundleVersionKey,
      deploymentConfigurationId: record.deploymentConfigurationId,
      targetId: record.targetId,
      targetType: record.targetType,
      deploymentEnvironmentId: record.provisionedEnvironmentId,
      tenantId: record.isolation.boundary.tenantId,
      nestedSystemCount: record.nestedSystemCount,
      minCapacity: input.minCapacity,
      maxCapacity: input.maxCapacity,
      desiredCapacity: input.desiredCapacity,
      policy: input.policy,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
    this.scalingRepository.saveConfiguration(configuration);

    const existingStatus = this.scalingRepository.getStatusByDeploymentId(record.deploymentId);
    this.scalingRepository.saveStatus(Object.freeze({
      deploymentId: record.deploymentId,
      currentCapacity: existingStatus?.currentCapacity ?? configuration.desiredCapacity,
      desiredCapacity: configuration.desiredCapacity,
      minCapacity: configuration.minCapacity,
      maxCapacity: configuration.maxCapacity,
      pendingActionCount: existingStatus?.pendingActionCount ?? 0,
      lastActionAt: existingStatus?.lastActionAt,
      lastEvaluatedAt: existingStatus?.lastEvaluatedAt,
      lastDecisionDirection: existingStatus?.lastDecisionDirection,
      summary: existingStatus?.summary ?? "Scaling configuration initialized.",
    }));

    this.auditTrailService?.record({
      eventKind: DeploymentAuditEventKinds.scalingConfigurationChanged,
      outcome: DeploymentAuditOutcomes.succeeded,
      requestSource: this.normalizeRequestSource(input.requestSource),
      caller: this.normalizeCaller(input.caller, input.requestedBy),
      tenant: Object.freeze({ tenantId: input.tenantId ?? record.isolation.boundary.tenantId, source: input.requestSource }),
      deployment: this.createAuditDeploymentLinkage(record),
      detail: Object.freeze({
        message: "Deployment scaling configuration upserted.",
      }),
      metadata: Object.freeze({
        minCapacity: configuration.minCapacity.toString(10),
        maxCapacity: configuration.maxCapacity.toString(10),
        desiredCapacity: configuration.desiredCapacity.toString(10),
      }),
      occurredAt: now,
    });

    return configuration;
  }

  public getScaleStatus(deploymentId: string): DeploymentScaleStatus | undefined {
    const normalized = deploymentId.trim();
    if (!normalized) {
      return undefined;
    }
    return this.scalingRepository.getStatusByDeploymentId(normalized);
  }

  public evaluateScaleDecision(input: {
    readonly deploymentId: string;
    readonly observedCapacity: number;
    readonly observedUtilizationPercent?: number;
    readonly observedHealthStatus?: string;
    readonly evaluatedAt?: string;
  }): ScaleDecision {
    const configuration = this.requireScalingConfiguration(input.deploymentId);
    if (input.observedCapacity < configuration.minCapacity || input.observedCapacity > configuration.maxCapacity) {
      throw new Error(`Observed capacity ${input.observedCapacity} is outside configured bounds [${configuration.minCapacity}, ${configuration.maxCapacity}].`);
    }

    const utilizationTarget = configuration.policy.targetUtilizationPercent;
    const observedUtilization = input.observedUtilizationPercent;
    let direction = ScaleDirections.none;
    let targetCapacity = input.observedCapacity;
    let rationale = "Capacity is within bounded policy tolerances.";

    if (typeof utilizationTarget === "number" && typeof observedUtilization === "number") {
      const upperBound = utilizationTarget + 5;
      const lowerBound = Math.max(0, utilizationTarget - 5);
      if (observedUtilization > upperBound && input.observedCapacity < configuration.maxCapacity) {
        direction = ScaleDirections.scaleOut;
        targetCapacity = Math.min(configuration.maxCapacity, input.observedCapacity + (configuration.policy.scaleOutStep ?? 1));
        rationale = `Observed utilization ${observedUtilization}% is above policy threshold ${upperBound}%.`;
      } else if (observedUtilization < lowerBound && input.observedCapacity > configuration.minCapacity) {
        direction = ScaleDirections.scaleIn;
        targetCapacity = Math.max(configuration.minCapacity, input.observedCapacity - (configuration.policy.scaleInStep ?? 1));
        rationale = `Observed utilization ${observedUtilization}% is below policy threshold ${lowerBound}%.`;
      }
    }

    const decision = createScaleDecision({
      decisionId: `scale-decision:${configuration.deploymentId}:${Date.now().toString(36)}`,
      deploymentId: configuration.deploymentId,
      direction,
      targetCapacity,
      rationale,
      inputSnapshot: Object.freeze({
        observedCapacity: input.observedCapacity.toString(10),
        observedUtilizationPercent: input.observedUtilizationPercent?.toString(10) ?? "unknown",
        observedHealthStatus: input.observedHealthStatus?.trim() || "unknown",
      }),
      decidedAt: input.evaluatedAt?.trim() || this.clock().toISOString(),
    });

    const status = this.scalingRepository.getStatusByDeploymentId(configuration.deploymentId);
    this.scalingRepository.saveStatus(Object.freeze({
      deploymentId: configuration.deploymentId,
      currentCapacity: status?.currentCapacity ?? input.observedCapacity,
      desiredCapacity: targetCapacity,
      minCapacity: configuration.minCapacity,
      maxCapacity: configuration.maxCapacity,
      pendingActionCount: status?.pendingActionCount ?? 0,
      lastActionAt: status?.lastActionAt,
      lastEvaluatedAt: decision.decidedAt,
      lastDecisionDirection: decision.direction,
      summary: decision.rationale,
    }));

    return decision;
  }

  public requestScaleAction(input: {
    readonly deploymentId: string;
    readonly requestedCapacity: number;
    readonly requestedBy: string;
    readonly reason?: string;
    readonly actionKind?: ScaleActionRequest["actionKind"];
    readonly decision?: ScaleDecision;
    readonly caller?: {
      readonly callerKind?: string;
      readonly callerId?: string;
      readonly sessionId?: string;
      readonly roles?: ReadonlyArray<string>;
      readonly authenticatedPrincipalId?: string;
    };
    readonly tenantId?: string;
    readonly requestSource?: string;
  }): ScaleActionRequest {
    const record = this.requireActiveDeployment(input.deploymentId);
    const configuration = this.requireScalingConfiguration(record.deploymentId);
    const now = this.clock().toISOString();

    const bounded = input.requestedCapacity >= configuration.minCapacity && input.requestedCapacity <= configuration.maxCapacity;
    const action = createScaleActionRequest({
      actionId: `scale-action:${record.deploymentId}:${Date.now().toString(36)}`,
      deploymentId: record.deploymentId,
      actionKind: input.actionKind ?? ScaleActionKinds.manualAdjustment,
      requestedCapacity: input.requestedCapacity,
      requestedBy: input.requestedBy,
      requestedAt: now,
      status: bounded ? ScaleActionStatuses.requested : ScaleActionStatuses.rejected,
      reason: bounded ? input.reason : input.reason?.trim() || `Requested capacity is outside configured bounds [${configuration.minCapacity}, ${configuration.maxCapacity}].`,
      decision: input.decision,
    });

    this.scalingRepository.saveScaleAction(action);

    const priorStatus = this.scalingRepository.getStatusByDeploymentId(record.deploymentId);
    this.scalingRepository.saveStatus(Object.freeze({
      deploymentId: record.deploymentId,
      currentCapacity: priorStatus?.currentCapacity ?? configuration.desiredCapacity,
      desiredCapacity: bounded ? action.requestedCapacity : (priorStatus?.desiredCapacity ?? configuration.desiredCapacity),
      minCapacity: configuration.minCapacity,
      maxCapacity: configuration.maxCapacity,
      pendingActionCount: (priorStatus?.pendingActionCount ?? 0) + (bounded ? 1 : 0),
      lastActionAt: now,
      lastEvaluatedAt: priorStatus?.lastEvaluatedAt,
      lastDecisionDirection: priorStatus?.lastDecisionDirection,
      summary: bounded ? "Scale action requested." : "Scale action rejected due to capacity bounds.",
    }));

    this.auditTrailService?.record({
      eventKind: DeploymentAuditEventKinds.scaleActionRequested,
      outcome: bounded ? DeploymentAuditOutcomes.accepted : DeploymentAuditOutcomes.rejected,
      requestSource: this.normalizeRequestSource(input.requestSource),
      caller: this.normalizeCaller(input.caller, input.requestedBy),
      tenant: Object.freeze({ tenantId: input.tenantId ?? record.isolation.boundary.tenantId, source: input.requestSource }),
      deployment: this.createAuditDeploymentLinkage(record),
      detail: Object.freeze({
        message: bounded ? "Scale action accepted as bounded request." : "Scale action rejected as out of bounds.",
        errorCode: bounded ? undefined : "scale-capacity-out-of-bounds",
      }),
      metadata: Object.freeze({
        requestedCapacity: input.requestedCapacity.toString(10),
        actionKind: action.actionKind,
      }),
      occurredAt: now,
    });

    return action;
  }

  private requireScalingConfiguration(deploymentId: string): DeploymentScalingConfiguration {
    const configuration = this.scalingRepository.getConfigurationByDeploymentId(deploymentId);
    if (!configuration) {
      throw new Error(`Deployment '${deploymentId}' does not have a scaling configuration.`);
    }
    return configuration;
  }

  private requireActiveDeployment(deploymentId: string): DeploymentRecord {
    const normalized = deploymentId.trim();
    if (!normalized) {
      throw new Error("Deployment autoscaling requires deploymentId.");
    }
    const record = this.deploymentRepository.getById(normalized);
    if (!record) {
      throw new Error(`Deployment '${normalized}' was not found.`);
    }
    if (record.status !== DeploymentStatuses.succeeded || record.state !== DeploymentStates.active || record.activationState !== DeploymentActivationStates.active) {
      throw new Error(`Deployment '${normalized}' is not an active deployment and cannot be scaled.`);
    }
    return record;
  }

  private normalizeCaller(caller: {
    readonly callerKind?: string;
    readonly callerId?: string;
    readonly sessionId?: string;
    readonly roles?: ReadonlyArray<string>;
    readonly authenticatedPrincipalId?: string;
  } | undefined, requestedBy: string) {
    return Object.freeze({
      callerKind: caller?.callerKind,
      callerId: caller?.callerId ?? requestedBy,
      sessionId: caller?.sessionId,
      roles: caller?.roles,
      authenticatedPrincipalId: caller?.authenticatedPrincipalId,
    });
  }

  private normalizeRequestSource(source?: string): "deployment-api" | "external-api" | "studio-shell-internal" | "internal-trusted" | "unknown" {
    if (source === "deployment-api" || source === "external-api" || source === "studio-shell-internal" || source === "internal-trusted") {
      return source;
    }
    return "unknown";
  }

  private createAuditDeploymentLinkage(record: DeploymentRecord) {
    return Object.freeze({
      deploymentId: record.deploymentId,
      requestId: record.requestId,
      rootSystemAssetId: record.rootSystemAssetId,
      rootSystemVersionId: record.rootSystemVersionId,
      bundleId: record.bundleId,
      bundleVersionKey: record.bundleVersionKey,
      deploymentConfigurationId: record.deploymentConfigurationId,
      targetId: record.targetId,
      targetType: record.targetType,
      deploymentEnvironmentId: record.provisionedEnvironmentId,
    });
  }
}

import { createHash } from "node:crypto";
import { DeploymentActivationStates, DeploymentStatuses, type DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import {
  type RollbackActionRecord,
  type RollbackDecision,
  type RollbackRequest,
  type RollbackResult,
} from "../../domain/deployment/DeploymentRollbackDomain";
import { DeploymentStates } from "../../domain/deployment/DeploymentStateDomain";
import { DeploymentLogLevels } from "../../domain/deployment/DeploymentDiagnosticsDomain";
import { type DeploymentVersionManager } from "./DeploymentVersionManager";
import type { DeploymentDiagnosticsService } from "./DeploymentDiagnosticsService";
import type { DeploymentRecordRepository } from "./DeploymentExecutionService";
import {
  DeploymentAccessActions,
  DeploymentAccessEvaluator,
  type DeploymentAccessContext,
} from "./DeploymentAccessControl";
import {
  DeploymentQuotaActions,
  DeploymentQuotaEvaluator,
} from "./DeploymentQuotaEvaluator";

export interface DeploymentRollbackActionRepository {
  save(record: RollbackActionRecord): RollbackActionRecord;
  listBySystemAndTarget(input: { readonly rootSystemAssetId: string; readonly targetId: string; readonly targetType: DeploymentRecord["targetType"] }): ReadonlyArray<RollbackActionRecord>;
}

export class InMemoryDeploymentRollbackActionRepository implements DeploymentRollbackActionRepository {
  private readonly records = new Map<string, RollbackActionRecord>();

  public save(record: RollbackActionRecord): RollbackActionRecord {
    this.records.set(record.actionId, record);
    return record;
  }

  public listBySystemAndTarget(input: { readonly rootSystemAssetId: string; readonly targetId: string; readonly targetType: DeploymentRecord["targetType"] }): ReadonlyArray<RollbackActionRecord> {
    return Object.freeze([...this.records.values()]
      .filter((entry) => entry.rootSystemAssetId === input.rootSystemAssetId)
      .filter((entry) => entry.targetId === input.targetId)
      .filter((entry) => entry.targetType === input.targetType)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)));
  }
}

export class DeploymentRollbackService {
  public constructor(
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly versionManager: Pick<DeploymentVersionManager, "setActiveDeployment" | "getActiveDeployment">,
    private readonly diagnosticsService: Pick<DeploymentDiagnosticsService, "logEvent">,
    private readonly rollbackRepository: DeploymentRollbackActionRepository = new InMemoryDeploymentRollbackActionRepository(),
    private readonly clock: () => Date = () => new Date(),
    private readonly accessEvaluator: DeploymentAccessEvaluator = new DeploymentAccessEvaluator(),
    private readonly quotaEvaluator: DeploymentQuotaEvaluator = new DeploymentQuotaEvaluator(),
  ) {}

  public isRollbackEligible(request: RollbackRequest): RollbackDecision {
    return this.evaluateRollbackDecision(request).decision;
  }

  public rollback(request: RollbackRequest & {
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): RollbackResult {
    const normalized = this.normalizeRequest(request);
    this.accessEvaluator.assertAllowed({
      action: DeploymentAccessActions.rollbackDeployment,
      context: request.accessContext
        ? Object.freeze({
          ...request.accessContext,
          source: request.requestSource ?? request.accessContext.source,
        })
        : undefined,
      resourceTenantId: request.resourceTenantId,
      rootSystemAssetId: normalized.rootSystemAssetId,
      targetId: normalized.targetId,
      targetType: normalized.targetType,
      deploymentId: normalized.toDeploymentId,
    });
    this.quotaEvaluator.assertAllowed({
      action: DeploymentQuotaActions.rollbackDeployment,
      accessContext: request.accessContext,
      rootSystemAssetId: normalized.rootSystemAssetId,
      targetId: normalized.targetId,
      targetType: normalized.targetType,
    });
    const evaluated = this.evaluateRollbackDecision(normalized, {
      accessContext: request.accessContext,
      resourceTenantId: request.resourceTenantId,
      requestSource: request.requestSource,
    });
    if (evaluated.decision.eligible && evaluated.currentDeployment && evaluated.targetDeployment) {
      this.versionManager.setActiveDeployment({
        deploymentId: evaluated.targetDeployment.deploymentId,
        reason: normalized.reason?.trim() || `rollback:${normalized.requestId}`,
        actionKind: "rollback",
        accessContext: request.accessContext,
        resourceTenantId: request.resourceTenantId,
        requestSource: request.requestSource,
      });

      this.diagnosticsService.logEvent({
        deploymentId: evaluated.targetDeployment.deploymentId,
        eventKind: "rollback-performed",
        level: DeploymentLogLevels.warning,
        message: `Rollback re-activated deployment '${evaluated.targetDeployment.deploymentId}'.`,
        details: Object.freeze({
          requestId: normalized.requestId,
          fromDeploymentId: evaluated.currentDeployment.deploymentId,
          requestedBy: normalized.requestedBy,
        }),
      });
    }

    const action = this.rollbackRepository.save(Object.freeze({
      actionId: this.deriveActionId(normalized),
      requestId: normalized.requestId,
      requestedBy: normalized.requestedBy,
      requestedAt: normalized.requestedAt,
      rootSystemAssetId: normalized.rootSystemAssetId,
      targetId: normalized.targetId,
      targetType: normalized.targetType,
      fromDeploymentId: evaluated.currentDeployment?.deploymentId,
      toDeploymentId: evaluated.targetDeployment?.deploymentId,
      performed: evaluated.decision.eligible,
      decision: evaluated.decision,
    }));

    return Object.freeze({
      requestId: action.requestId,
      performed: action.performed,
      requestedAt: action.requestedAt,
      requestedBy: action.requestedBy,
      rootSystemAssetId: action.rootSystemAssetId,
      targetId: action.targetId,
      targetType: action.targetType,
      fromDeploymentId: action.fromDeploymentId,
      toDeploymentId: action.toDeploymentId,
      decision: action.decision,
      actionId: action.actionId,
    });
  }

  public listRollbackActions(input: {
    readonly rootSystemAssetId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ReadonlyArray<RollbackActionRecord> {
    this.accessEvaluator.assertAllowed({
      action: DeploymentAccessActions.readDeploymentHistory,
      context: input.accessContext
        ? Object.freeze({
          ...input.accessContext,
          source: input.requestSource ?? input.accessContext.source,
        })
        : undefined,
      resourceTenantId: input.resourceTenantId,
      rootSystemAssetId: input.rootSystemAssetId,
      targetId: input.targetId,
      targetType: input.targetType,
    });
    return this.rollbackRepository.listBySystemAndTarget(input);
  }

  private normalizeRequest(request: RollbackRequest): RollbackRequest {
    const requestId = request.requestId.trim();
    const rootSystemAssetId = request.rootSystemAssetId.trim();
    const targetId = request.targetId.trim();
    const requestedBy = request.requestedBy.trim();
    const requestedAt = request.requestedAt.trim();
    if (!requestId || !rootSystemAssetId || !targetId || !requestedBy || !requestedAt) {
      throw new Error("Rollback request requires requestId, rootSystemAssetId, targetId, requestedBy, and requestedAt.");
    }

    return Object.freeze({
      ...request,
      requestId,
      rootSystemAssetId,
      targetId,
      requestedBy,
      requestedAt,
      toDeploymentId: request.toDeploymentId?.trim() || undefined,
      reason: request.reason?.trim() || undefined,
    });
  }

  private evaluateRollbackDecision(request: RollbackRequest, governance?: {
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): {
    readonly decision: RollbackDecision;
    readonly currentDeployment?: DeploymentRecord;
    readonly targetDeployment?: DeploymentRecord;
  } {
    const active = this.versionManager.getActiveDeployment({
      rootSystemAssetId: request.rootSystemAssetId,
      targetId: request.targetId,
      targetType: request.targetType,
      accessContext: governance?.accessContext,
      resourceTenantId: governance?.resourceTenantId,
      requestSource: governance?.requestSource,
    });
    if (!active) {
      return { decision: { eligible: false, code: "no-active-deployment", message: "No active deployment exists for this system/target scope." } };
    }

    const currentDeployment = this.deploymentRepository.getById(active.deploymentId);
    if (!currentDeployment) {
      return { decision: { eligible: false, code: "no-active-deployment", message: "The active deployment record could not be resolved." } };
    }

    const candidates = this.deploymentRepository.listAll()
      .filter((entry) => entry.rootSystemAssetId === request.rootSystemAssetId)
      .filter((entry) => entry.targetId === request.targetId)
      .filter((entry) => entry.targetType === request.targetType)
      .filter((entry) => entry.deploymentId !== currentDeployment.deploymentId)
      .sort((left, right) => right.activationUpdatedAt.localeCompare(left.activationUpdatedAt));

    const targetDeployment = request.toDeploymentId
      ? candidates.find((entry) => entry.deploymentId === request.toDeploymentId)
      : candidates[0];

    if (!targetDeployment) {
      return {
        decision: {
          eligible: false,
          code: "candidate-not-found",
          message: "No prior deployment is available for rollback in this target scope.",
        },
        currentDeployment,
      };
    }

    if (targetDeployment.targetId !== currentDeployment.targetId || targetDeployment.targetType !== currentDeployment.targetType) {
      return {
        decision: {
          eligible: false,
          code: "target-mismatch",
          message: "Rollback candidate does not match the active deployment target scope.",
        },
        currentDeployment,
        targetDeployment,
      };
    }

    if (targetDeployment.activationState === DeploymentActivationStates.active) {
      return {
        decision: {
          eligible: false,
          code: "already-active",
          message: "Rollback candidate is already active.",
        },
        currentDeployment,
        targetDeployment,
      };
    }

    if (targetDeployment.status !== DeploymentStatuses.succeeded || targetDeployment.state !== DeploymentStates.active) {
      return {
        decision: {
          eligible: false,
          code: "candidate-not-eligible",
          message: "Rollback candidate is not in an eligible deployment state.",
        },
        currentDeployment,
        targetDeployment,
      };
    }

    return {
      decision: {
        eligible: true,
        code: "eligible",
        message: "Rollback candidate is eligible for activation.",
      },
      currentDeployment,
      targetDeployment,
    };
  }

  private deriveActionId(request: RollbackRequest): string {
    const at = this.clock().toISOString();
    const value = createHash("sha256")
      .update(JSON.stringify({ request, at }))
      .digest("hex")
      .slice(0, 20);
    return `rollback:${request.rootSystemAssetId}:${value}`;
  }
}

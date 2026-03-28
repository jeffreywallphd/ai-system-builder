import { DeploymentActivationStates, DeploymentStatuses, type DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import {
  type DeploymentHistoryQuery,
  type ManagedDeploymentVersion,
  toManagedDeploymentVersion,
} from "../../domain/deployment/DeploymentVersionManagementDomain";
import { DeploymentStates } from "../../domain/deployment/DeploymentStateDomain";
import type { DeploymentExecutionService, DeploymentRecordRepository } from "./DeploymentExecutionService";
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
import type { DeploymentEnvironmentContext } from "../../domain/deployment/DeploymentIsolationDomain";
import { DeploymentAuditEventKinds, DeploymentAuditOutcomes } from "../../domain/deployment/DeploymentAuditTrailDomain";
import type { DeploymentAuditTrailService } from "./DeploymentAuditTrailService";

export class DeploymentVersionManager {
  public constructor(
    private readonly repository: DeploymentRecordRepository,
    private readonly deploymentExecutionService: Pick<DeploymentExecutionService, "setDeploymentActivationState">,
    private readonly accessEvaluator: DeploymentAccessEvaluator = new DeploymentAccessEvaluator(),
    private readonly quotaEvaluator: DeploymentQuotaEvaluator = new DeploymentQuotaEvaluator(),
    private readonly isolationEvaluator: DeploymentIsolationEvaluator = new DeploymentIsolationEvaluator(),
    private readonly auditTrailService?: DeploymentAuditTrailService,
  ) {}

  public listDeploymentsForSystemVersion(input: {
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ReadonlyArray<ManagedDeploymentVersion> {
    return this.listDeploymentHistory({
      rootSystemAssetId: input.rootSystemAssetId,
      rootSystemVersionId: input.rootSystemVersionId,
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
    });
  }

  public listDeploymentHistory(query: DeploymentHistoryQuery & {
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ReadonlyArray<ManagedDeploymentVersion> {
    const rootSystemAssetId = query.rootSystemAssetId.trim();
    if (!rootSystemAssetId) {
      throw new Error("Deployment history query rootSystemAssetId is required.");
    }
    this.assertAccess({
      action: DeploymentAccessActions.readDeploymentHistory,
      accessContext: query.accessContext,
      resourceTenantId: query.resourceTenantId,
      requestSource: query.requestSource,
      rootSystemAssetId,
      rootSystemVersionId: query.rootSystemVersionId,
      targetId: query.targetId,
      targetType: query.targetType,
    });

    const rootSystemVersionId = query.rootSystemVersionId?.trim();
    const targetId = query.targetId?.trim();
    const isolationContext = this.resolveIsolationContext({
      accessContext: query.accessContext,
      resourceTenantId: query.resourceTenantId,
      requestSource: query.requestSource,
      targetId,
      targetType: query.targetType,
    });

    return Object.freeze(this.isolationEvaluator.filterRecords({ records: this.repository.listAll(), context: isolationContext })
      .filter((record) => record.rootSystemAssetId === rootSystemAssetId)
      .filter((record) => !rootSystemVersionId || record.rootSystemVersionId === rootSystemVersionId)
      .filter((record) => !targetId || record.targetId === targetId)
      .filter((record) => !query.targetType || record.targetType === query.targetType)
      .map((record) => toManagedDeploymentVersion(record))
      .sort((left, right) => right.deployedAt.localeCompare(left.deployedAt)));
  }

  public getActiveDeployment(input: {
    readonly rootSystemAssetId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): ManagedDeploymentVersion | undefined {
    const rootSystemAssetId = input.rootSystemAssetId.trim();
    const targetId = input.targetId.trim();
    if (!rootSystemAssetId || !targetId) {
      throw new Error("Active deployment lookup requires rootSystemAssetId and targetId.");
    }
    this.assertAccess({
      action: DeploymentAccessActions.readDeploymentDetails,
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
      rootSystemAssetId,
      targetId,
      targetType: input.targetType,
    });
    const isolationContext = this.resolveIsolationContext({
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
      targetId,
      targetType: input.targetType,
    });

    const record = this.isolationEvaluator.filterRecords({ records: this.repository.listAll(), context: isolationContext })
      .filter((candidate) => candidate.rootSystemAssetId === rootSystemAssetId)
      .filter((candidate) => candidate.targetId === targetId)
      .filter((candidate) => candidate.targetType === input.targetType)
      .filter((candidate) => candidate.activationState === DeploymentActivationStates.active)
      .sort((left, right) => right.activationUpdatedAt.localeCompare(left.activationUpdatedAt))[0];

    return record ? toManagedDeploymentVersion(record) : undefined;
  }

  public setActiveDeployment(input: {
    readonly deploymentId: string;
    readonly reason?: string;
    readonly actionKind?: "version-management" | "rollback";
    readonly accessContext?: DeploymentAccessContext;
    readonly resourceTenantId?: string;
    readonly requestSource?: string;
  }): {
    readonly active: ManagedDeploymentVersion;
    readonly superseded: ReadonlyArray<ManagedDeploymentVersion>;
  } {
    const deploymentId = input.deploymentId.trim();
    if (!deploymentId) {
      throw new Error("Active deployment selection requires deploymentId.");
    }

    const selected = this.repository.getById(deploymentId);
    if (!selected) {
      throw new Error(`Deployment '${deploymentId}' was not found.`);
    }

    if (selected.status !== DeploymentStatuses.succeeded || selected.state !== DeploymentStates.active) {
      throw new Error(`Deployment '${deploymentId}' is not eligible for activation.`);
    }
    this.assertAccess({
      action: DeploymentAccessActions.changeActiveDeployment,
      accessContext: input.accessContext,
      resourceTenantId: input.resourceTenantId,
      requestSource: input.requestSource,
      deploymentId,
      rootSystemAssetId: selected.rootSystemAssetId,
      rootSystemVersionId: selected.rootSystemVersionId,
      targetId: selected.targetId,
      targetType: selected.targetType,
    });
    this.quotaEvaluator.assertAllowed({
      action: DeploymentQuotaActions.changeActiveDeployment,
      accessContext: input.accessContext,
      rootSystemAssetId: selected.rootSystemAssetId,
      rootSystemVersionId: selected.rootSystemVersionId,
      targetId: selected.targetId,
      targetType: selected.targetType,
    });
    this.isolationEvaluator.assertRecordAccessible({
      record: selected,
      context: this.resolveIsolationContext({
        accessContext: input.accessContext,
        resourceTenantId: input.resourceTenantId,
        requestSource: input.requestSource,
        targetId: selected.targetId,
        targetType: selected.targetType,
        deploymentEnvironmentId: selected.provisionedEnvironmentId,
      }),
      expectedDeploymentId: selected.deploymentId,
    });

    const reason = input.reason?.trim() || "active-deployment-selected";
    const actionKind = input.actionKind ?? "version-management";

    const scoped = this.repository.listAll()
      .filter((candidate) => candidate.rootSystemAssetId === selected.rootSystemAssetId)
      .filter((candidate) => candidate.targetId === selected.targetId)
      .filter((candidate) => candidate.targetType === selected.targetType)
      .filter((candidate) => candidate.deploymentId !== selected.deploymentId);

    const superseded: Array<ManagedDeploymentVersion> = [];
    for (const candidate of scoped) {
      if (candidate.activationState === DeploymentActivationStates.active) {
        const updated = this.deploymentExecutionService.setDeploymentActivationState({
          deploymentId: candidate.deploymentId,
          toState: DeploymentActivationStates.superseded,
          reason: `${reason}:superseded-by:${selected.deploymentId}`,
          actionKind,
          relatedDeploymentId: selected.deploymentId,
        });
        superseded.push(toManagedDeploymentVersion(updated));
        continue;
      }

      if (candidate.activationState === DeploymentActivationStates.superseded) {
        superseded.push(toManagedDeploymentVersion(candidate));
      }
    }

    const activeRecord = this.deploymentExecutionService.setDeploymentActivationState({
      deploymentId: selected.deploymentId,
      toState: DeploymentActivationStates.active,
      reason,
      actionKind,
    });
    this.auditTrailService?.record({
      eventKind: DeploymentAuditEventKinds.activationChanged,
      outcome: DeploymentAuditOutcomes.succeeded,
      requestSource: this.normalizeRequestSource(input.requestSource),
      caller: this.normalizeCaller(input.accessContext),
      tenant: Object.freeze({
        tenantId: input.resourceTenantId ?? input.accessContext?.tenantId ?? selected.isolation.boundary.tenantId,
        source: input.requestSource,
      }),
      deployment: Object.freeze({
        deploymentId: activeRecord.deploymentId,
        requestId: activeRecord.requestId,
        rootSystemAssetId: activeRecord.rootSystemAssetId,
        rootSystemVersionId: activeRecord.rootSystemVersionId,
        bundleId: activeRecord.bundleId,
        bundleVersionKey: activeRecord.bundleVersionKey,
        deploymentConfigurationId: activeRecord.deploymentConfigurationId,
        targetId: activeRecord.targetId,
        targetType: activeRecord.targetType,
        deploymentEnvironmentId: activeRecord.provisionedEnvironmentId,
      }),
      detail: Object.freeze({
        message: "Deployment activation changed.",
      }),
      metadata: Object.freeze({
        reason,
        actionKind,
        supersededCount: superseded.length.toString(10),
      }),
    });

    return Object.freeze({
      active: toManagedDeploymentVersion(activeRecord),
      superseded: Object.freeze(superseded.sort((left, right) => right.activationUpdatedAt.localeCompare(left.activationUpdatedAt))),
    });
  }

  private assertAccess(input: {
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
}

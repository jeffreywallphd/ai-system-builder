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

export class DeploymentVersionManager {
  public constructor(
    private readonly repository: DeploymentRecordRepository,
    private readonly deploymentExecutionService: Pick<DeploymentExecutionService, "setDeploymentActivationState">,
    private readonly accessEvaluator: DeploymentAccessEvaluator = new DeploymentAccessEvaluator(),
    private readonly quotaEvaluator: DeploymentQuotaEvaluator = new DeploymentQuotaEvaluator(),
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

    return Object.freeze(this.repository.listAll()
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

    const record = this.repository.listAll()
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
}

import { DeploymentStatuses, type DeploymentRecord } from "../../domain/deployment/DeploymentExecutionDomain";
import {
  DeploymentHealthStatuses,
  type DeploymentHealthSignalSnapshot,
  type DeploymentHealthSnapshot,
  type DeploymentHealthStatus,
} from "../../domain/deployment/DeploymentHealthDomain";
import { DeploymentStates } from "../../domain/deployment/DeploymentStateDomain";
import type { EndpointRouteRequest } from "../../domain/deployment/EndpointRoutingDomain";
import type { EndpointExposureRepository } from "./SystemEndpointExposureService";
import type { DeploymentDiagnosticsService } from "./DeploymentDiagnosticsService";
import type { DeploymentRecordRepository } from "./DeploymentExecutionService";
import type { EndpointRoutingService } from "./EndpointRoutingService";
import type { DeploymentVersionManager } from "./DeploymentVersionManager";

export interface DeploymentHealthSnapshotRepository {
  save(snapshot: DeploymentHealthSnapshot): DeploymentHealthSnapshot;
  getByDeploymentId(deploymentId: string): DeploymentHealthSnapshot | undefined;
}

export class InMemoryDeploymentHealthSnapshotRepository implements DeploymentHealthSnapshotRepository {
  private readonly snapshotsByDeploymentId = new Map<string, DeploymentHealthSnapshot>();

  public save(snapshot: DeploymentHealthSnapshot): DeploymentHealthSnapshot {
    this.snapshotsByDeploymentId.set(snapshot.deploymentId, snapshot);
    return snapshot;
  }

  public getByDeploymentId(deploymentId: string): DeploymentHealthSnapshot | undefined {
    const normalized = deploymentId.trim();
    return normalized ? this.snapshotsByDeploymentId.get(normalized) : undefined;
  }
}

export class DeploymentHealthEvaluator {
  public evaluate(input: {
    readonly record: DeploymentRecord;
    readonly activeDeploymentId?: string;
    readonly signalSnapshot: DeploymentHealthSignalSnapshot;
  }): {
    readonly status: DeploymentHealthStatus;
    readonly reasons: ReadonlyArray<string>;
  } {
    const reasons: string[] = [];
    const { signalSnapshot } = input;

    if (
      signalSnapshot.deploymentStatus === DeploymentStatuses.pending
      || signalSnapshot.deploymentState === DeploymentStates.provisioningInProgress
      || signalSnapshot.deploymentState === DeploymentStates.provisioningComplete
      || signalSnapshot.deploymentState === DeploymentStates.deploymentInProgress
      || signalSnapshot.deploymentState === DeploymentStates.requested
    ) {
      reasons.push("Deployment is still progressing through provisioning/deployment lifecycle.");
      return Object.freeze({ status: DeploymentHealthStatuses.pending, reasons: Object.freeze(reasons) });
    }

    if (
      signalSnapshot.deploymentStatus === DeploymentStatuses.rejected
      || signalSnapshot.deploymentState === DeploymentStates.failed
    ) {
      reasons.push("Deployment is in a terminal failed/rejected state.");
      return Object.freeze({ status: DeploymentHealthStatuses.unhealthy, reasons: Object.freeze(reasons) });
    }

    if (signalSnapshot.activationState !== "active" || input.activeDeploymentId !== input.record.deploymentId) {
      reasons.push("Deployment is not the active deployment for its target boundary.");
      return Object.freeze({ status: DeploymentHealthStatuses.unknown, reasons: Object.freeze(reasons) });
    }

    if (signalSnapshot.endpointExposureCount === 0) {
      reasons.push("Active deployment has no exposed endpoint records.");
      return Object.freeze({ status: DeploymentHealthStatuses.degraded, reasons: Object.freeze(reasons) });
    }

    if (signalSnapshot.endpointResolvableCount === 0) {
      reasons.push("Exposed endpoints did not resolve through endpoint routing.");
      return Object.freeze({ status: DeploymentHealthStatuses.unhealthy, reasons: Object.freeze(reasons) });
    }

    if (signalSnapshot.diagnosticErrorCount > 0) {
      reasons.push("Deployment diagnostics include error-level records.");
      return Object.freeze({ status: DeploymentHealthStatuses.degraded, reasons: Object.freeze(reasons) });
    }

    if (signalSnapshot.diagnosticWarningCount > 0) {
      reasons.push("Deployment diagnostics include warning-level signals.");
      return Object.freeze({ status: DeploymentHealthStatuses.degraded, reasons: Object.freeze(reasons) });
    }

    reasons.push("Active deployment endpoint routing is resolvable and no degradation signals were detected.");
    return Object.freeze({ status: DeploymentHealthStatuses.healthy, reasons: Object.freeze(reasons) });
  }
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export class DeploymentHealthMonitor {
  public constructor(
    private readonly deploymentRepository: DeploymentRecordRepository,
    private readonly diagnosticsService: Pick<DeploymentDiagnosticsService, "listDiagnostics">,
    private readonly endpointExposureRepository: Pick<EndpointExposureRepository, "listByRootSystemAssetId">,
    private readonly endpointRoutingService: Pick<EndpointRoutingService, "resolveRoute">,
    private readonly deploymentVersionManager: Pick<DeploymentVersionManager, "getActiveDeployment">,
    private readonly evaluator: DeploymentHealthEvaluator = new DeploymentHealthEvaluator(),
    private readonly repository: DeploymentHealthSnapshotRepository = new InMemoryDeploymentHealthSnapshotRepository(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public getDeploymentHealth(input: {
    readonly deploymentId: string;
    readonly callerContext?: EndpointRouteRequest["callerContext"];
    readonly tenantId?: string;
    readonly requestSource?: string;
  }): DeploymentHealthSnapshot {
    const deploymentId = normalizeRequired(input.deploymentId, "Deployment health deploymentId");
    const record = this.deploymentRepository.getById(deploymentId);
    if (!record) {
      throw new Error(`Deployment '${deploymentId}' was not found.`);
    }

    const active = this.deploymentVersionManager.getActiveDeployment({
      rootSystemAssetId: record.rootSystemAssetId,
      targetId: record.targetId,
      targetType: record.targetType,
      accessContext: input.callerContext
        ? {
          caller: input.callerContext,
          tenantId: input.tenantId,
          source: input.requestSource,
        }
        : undefined,
      resourceTenantId: input.tenantId,
      requestSource: input.requestSource,
    });

    const diagnostics = this.diagnosticsService.listDiagnostics(record.deploymentId);
    const endpointRecords = this.endpointExposureRepository
      .listByRootSystemAssetId(record.rootSystemAssetId)
      .filter((entry) => entry.deploymentId === record.deploymentId);

    const resolvableCount = endpointRecords.filter((entry) => {
      try {
        const resolved = this.endpointRoutingService.resolveRoute({
          endpointId: entry.endpoint.endpointId.value,
          invocation: Object.freeze({}),
          callerContext: input.callerContext,
          tenantId: input.tenantId,
          requestSource: input.requestSource,
        });
        return resolved.resolvedEndpoint.deploymentId === record.deploymentId;
      } catch {
        return false;
      }
    }).length;

    const signalSnapshot: DeploymentHealthSignalSnapshot = Object.freeze({
      deploymentStatus: record.status,
      deploymentState: record.state,
      activationState: record.activationState,
      diagnosticErrorCount: diagnostics.filter((entry) => entry.severity === "error").length,
      diagnosticWarningCount: diagnostics.filter((entry) => entry.severity === "warning").length,
      endpointExposureCount: endpointRecords.length,
      endpointResolvableCount: resolvableCount,
    });

    const evaluation = this.evaluator.evaluate({
      record,
      activeDeploymentId: active?.deploymentId,
      signalSnapshot,
    });

    const snapshot: DeploymentHealthSnapshot = Object.freeze({
      deploymentId: record.deploymentId,
      status: evaluation.status,
      evaluatedAt: this.clock().toISOString(),
      reasons: evaluation.reasons,
      linkage: Object.freeze({
        rootSystemAssetId: record.rootSystemAssetId,
        rootSystemVersionId: record.rootSystemVersionId,
        targetId: record.targetId,
        targetType: record.targetType,
        deploymentEnvironmentId: record.provisionedEnvironmentId,
        endpointIds: Object.freeze(endpointRecords.map((entry) => entry.endpoint.endpointId.value)),
        activeDeploymentId: active?.deploymentId,
        nestedSystemCount: record.nestedSystemCount,
        tenantId: record.isolation.boundary.tenantId,
      }),
      signals: signalSnapshot,
    });

    return this.repository.save(snapshot);
  }
}

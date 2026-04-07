import type { IAuditLedgerRepository } from "../ports/AuditLedgerPersistencePorts";
import type { IAuditLedgerWriteObservabilityPort } from "../ports/AuditLedgerObservabilityPorts";
import { publishAuditLedgerWriteObservabilityBestEffort } from "../ports/AuditLedgerObservabilityPorts";

export interface ReconcileAuditLedgerStartupStateRequest {
  readonly asOf?: string;
  readonly limit?: number;
}

export interface ReconcileAuditLedgerStartupStateResult {
  readonly checkedAt: string;
  readonly supported: boolean;
  readonly repairedCount: number;
  readonly manualFollowUpCount: number;
  readonly issueCount: number;
}

export interface ReconcileAuditLedgerStartupStateDependencies {
  readonly repository: IAuditLedgerRepository;
  readonly observabilityPort?: IAuditLedgerWriteObservabilityPort;
  readonly now?: () => Date;
}

export class ReconcileAuditLedgerStartupStateUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: ReconcileAuditLedgerStartupStateDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(
    request: ReconcileAuditLedgerStartupStateRequest = {},
  ): Promise<ReconcileAuditLedgerStartupStateResult> {
    const checkedAt = normalizeOptional(request.asOf) ?? this.now().toISOString();
    const limit = normalizePositiveLimit(request.limit);

    const reconcile = this.dependencies.repository.reconcileWritePathAnomalies;
    if (!reconcile) {
      return Object.freeze({
        checkedAt,
        supported: false,
        repairedCount: 0,
        manualFollowUpCount: 0,
        issueCount: 0,
      });
    }

    const result = await reconcile.call(this.dependencies.repository, {
      asOf: checkedAt,
      limit,
    });
    await publishAuditLedgerWriteObservabilityBestEffort(this.dependencies.observabilityPort, Object.freeze({
      event: "audit-ledger.write.reconciliation.completed",
      source: "audit-ledger",
      outcome: result.manualFollowUpCount > 0 ? "failure" : "success",
      severity: result.manualFollowUpCount > 0 ? "warn" : "info",
      occurredAt: checkedAt,
      details: Object.freeze({
        supported: true,
        repairedCount: result.repairedCount,
        manualFollowUpCount: result.manualFollowUpCount,
      }),
      counters: Object.freeze({
        repairedCount: result.repairedCount,
        manualFollowUpCount: result.manualFollowUpCount,
        issueCount: result.issues.length,
      }),
    }));

    return Object.freeze({
      checkedAt: result.checkedAt,
      supported: true,
      repairedCount: result.repairedCount,
      manualFollowUpCount: result.manualFollowUpCount,
      issueCount: result.issues.length,
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizePositiveLimit(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

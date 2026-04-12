import {
  RecoverRunOrchestrationStartupStateUseCase,
  type RecoverRunOrchestrationStartupStateResult,
} from "@application/runs/use-cases/RecoverRunOrchestrationStartupStateUseCase";
import type {
  ReconcileAuditLedgerStartupStateResult,
} from "@application/audit/use-cases/ReconcileAuditLedgerStartupStateUseCase";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { StartupSpan, StartupTracer } from "@hosts/bootstrap/startupTracer";
import type { SqliteRunCollectedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";

export interface ServerOrchestrationRecoveryLogger {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
}

export interface ServerOrchestrationRecoveryCompositionModuleInput {
  readonly startupTracer: StartupTracer;
  readonly startupRootSpan: StartupSpan;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly runCollectedResultPersistencePort: SqliteRunCollectedResultPersistenceAdapter;
  readonly workspaceClock: IIdentityClock;
  readonly reconcileAuditLedgerStartupState: (input: {
    readonly workspaceClock: IIdentityClock;
  }) => Promise<ReconcileAuditLedgerStartupStateResult>;
  readonly logger?: ServerOrchestrationRecoveryLogger;
}

export interface ServerOrchestrationRecoveryCompositionModuleOutput {
  readonly runStartupRecovery: RecoverRunOrchestrationStartupStateResult;
  readonly auditStartupReconciliation: ReconcileAuditLedgerStartupStateResult;
}

export async function composeServerOrchestrationRecoveryCompositionModule(
  input: ServerOrchestrationRecoveryCompositionModuleInput,
): Promise<ServerOrchestrationRecoveryCompositionModuleOutput> {
  const runStartupRecovery = await runStartupStepSpan({
    tracer: input.startupTracer,
    parentSpan: input.startupRootSpan,
    name: "orchestration-recovery",
    run: async () => new RecoverRunOrchestrationStartupStateUseCase({
      runRepository: input.persistentPlatformServices.platformPersistenceRepository,
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      placementHoldRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      resultCollectionPersistencePort: input.runCollectedResultPersistencePort,
      transactionManager: input.persistentPlatformServices.platformPersistenceRepository,
      now: () => input.workspaceClock.now(),
    }).execute(),
  });

  if (runStartupRecovery.summary.appliedCount > 0 || runStartupRecovery.summary.manualFollowUpCount > 0) {
    input.logger?.info({
      event: "run.orchestration-recovery.startup",
      requestId: "server-startup",
      details: Object.freeze({
        asOf: runStartupRecovery.asOf,
        appliedCount: runStartupRecovery.summary.appliedCount,
        manualFollowUpCount: runStartupRecovery.summary.manualFollowUpCount,
      }),
    });
  }

  const auditStartupReconciliation = await input.reconcileAuditLedgerStartupState({
    workspaceClock: input.workspaceClock,
  });

  if (auditStartupReconciliation.manualFollowUpCount > 0 || auditStartupReconciliation.repairedCount > 0) {
    input.logger?.warn({
      event: "audit-ledger.write-reconciliation.startup",
      requestId: "server-startup",
      details: Object.freeze({
        checkedAt: auditStartupReconciliation.checkedAt,
        supported: auditStartupReconciliation.supported,
        repairedCount: auditStartupReconciliation.repairedCount,
        manualFollowUpCount: auditStartupReconciliation.manualFollowUpCount,
        issueCount: auditStartupReconciliation.issueCount,
      }),
    });
  }

  return Object.freeze({
    runStartupRecovery,
    auditStartupReconciliation,
  });
}

async function runStartupStepSpan<TResult>(input: {
  readonly tracer: StartupTracer;
  readonly parentSpan: StartupSpan;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly run: (span: StartupSpan) => Promise<TResult> | TResult;
}): Promise<TResult> {
  const span = input.parentSpan.startChild(input.name, {
    metadata: input.metadata,
  });
  try {
    const result = await input.run(span);
    span.complete();
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
}

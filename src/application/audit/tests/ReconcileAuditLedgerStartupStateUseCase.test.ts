import { describe, expect, it } from "bun:test";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "../AuditApplicationContracts";
import type { CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import type { AuditLedgerWriteObservabilityEvent, IAuditLedgerWriteObservabilityPort } from "../ports/AuditLedgerObservabilityPorts";
import { ReconcileAuditLedgerStartupStateUseCase } from "../use-cases/ReconcileAuditLedgerStartupStateUseCase";

class NoopAuditRepository implements IAuditLedgerRepository {
  public async appendAuditEvent(_event: CanonicalAuditEvent, _context: AuditLedgerAppendContext): Promise<AuditLedgerAppendResult> {
    throw new Error("not implemented");
  }

  public async listAuditEvents(_query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    return [];
  }

  public async countAuditEvents(_query: AuditLedgerQuery): Promise<number> {
    return 0;
  }

  public async getAuditEventById(_eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return undefined;
  }
}

class ReconcilingAuditRepository extends NoopAuditRepository {
  public async reconcileWritePathAnomalies(): Promise<{
    readonly checkedAt: string;
    readonly repairedCount: number;
    readonly manualFollowUpCount: number;
    readonly issues: ReadonlyArray<{
      readonly kind: "orphaned-mutation-replay";
      readonly operationKey: string;
      readonly eventId: string;
      readonly details: string;
    }>;
  }> {
    return {
      checkedAt: "2026-04-07T22:00:00.000Z",
      repairedCount: 0,
      manualFollowUpCount: 1,
      issues: [{
        kind: "orphaned-mutation-replay",
        operationKey: "audit:bad:1",
        eventId: "audit:missing:1",
        details: "missing event row",
      }],
    };
  }
}

class RecordingWriteObservabilityPort implements IAuditLedgerWriteObservabilityPort {
  public readonly events: AuditLedgerWriteObservabilityEvent[] = [];

  public async recordAuditLedgerWrite(event: AuditLedgerWriteObservabilityEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("ReconcileAuditLedgerStartupStateUseCase", () => {
  it("returns supported=false when repository does not implement startup reconciliation", async () => {
    const useCase = new ReconcileAuditLedgerStartupStateUseCase({
      repository: new NoopAuditRepository(),
      now: () => new Date("2026-04-07T22:10:00.000Z"),
    });

    const result = await useCase.execute();
    expect(result.supported).toBeFalse();
    expect(result.manualFollowUpCount).toBe(0);
  });

  it("publishes reconciliation observability and summary when anomalies are detected", async () => {
    const observabilityPort = new RecordingWriteObservabilityPort();
    const useCase = new ReconcileAuditLedgerStartupStateUseCase({
      repository: new ReconcilingAuditRepository(),
      observabilityPort,
      now: () => new Date("2026-04-07T22:11:00.000Z"),
    });

    const result = await useCase.execute();
    expect(result.supported).toBeTrue();
    expect(result.manualFollowUpCount).toBe(1);
    expect(observabilityPort.events).toHaveLength(1);
    expect(observabilityPort.events[0]?.event).toBe("audit-ledger.write.reconciliation.completed");
    expect(observabilityPort.events[0]?.outcome).toBe("failure");
  });
});

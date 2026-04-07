import {
  createStudioHandoffAuditRecord,
  type StudioHandoffAuditEventKind,
  type StudioHandoffAuditOutcome,
  type StudioHandoffAuditRecord,
} from "../../domain/studio-handoff/StudioHandoffAuditTrail";

export interface StudioHandoffAuditRepository {
  save(record: StudioHandoffAuditRecord): StudioHandoffAuditRecord;
  listRecent(limit?: number): ReadonlyArray<StudioHandoffAuditRecord>;
  listByHandoffId(handoffId: string, limit?: number): ReadonlyArray<StudioHandoffAuditRecord>;
}

export class InMemoryStudioHandoffAuditRepository implements StudioHandoffAuditRepository {
  private readonly records = new Map<string, StudioHandoffAuditRecord>();

  public save(record: StudioHandoffAuditRecord): StudioHandoffAuditRecord {
    this.records.set(record.auditId, record);
    return record;
  }

  public listRecent(limit = 100): ReadonlyArray<StudioHandoffAuditRecord> {
    return Object.freeze([...this.records.values()]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, Math.max(0, limit)));
  }

  public listByHandoffId(handoffId: string, limit = 100): ReadonlyArray<StudioHandoffAuditRecord> {
    const normalized = handoffId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    return Object.freeze([...this.records.values()]
      .filter((entry) => entry.handoff.handoffId === normalized)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, Math.max(0, limit)));
  }
}

export interface RecordStudioHandoffAuditInput {
  readonly eventKind: StudioHandoffAuditEventKind;
  readonly outcome: StudioHandoffAuditOutcome;
  readonly handoff: StudioHandoffAuditRecord["handoff"];
  readonly actor?: StudioHandoffAuditRecord["actor"];
  readonly sourceStudio: StudioHandoffAuditRecord["sourceStudio"];
  readonly targetStudio: StudioHandoffAuditRecord["targetStudio"];
  readonly assets: StudioHandoffAuditRecord["assets"];
  readonly metadata?: StudioHandoffAuditRecord["metadata"];
  readonly detail?: StudioHandoffAuditRecord["detail"];
  readonly occurredAt?: string;
}

export class StudioHandoffAuditTrailService {
  public constructor(private readonly repository: StudioHandoffAuditRepository) {}

  public record(input: RecordStudioHandoffAuditInput): StudioHandoffAuditRecord {
    const record = createStudioHandoffAuditRecord({
      eventKind: input.eventKind,
      outcome: input.outcome,
      handoff: input.handoff,
      actor: input.actor,
      sourceStudio: input.sourceStudio,
      targetStudio: input.targetStudio,
      assets: input.assets,
      metadata: input.metadata,
      detail: input.detail,
      occurredAt: input.occurredAt,
    });
    this.repository.save(record);
    return record;
  }

  public listRecent(limit?: number): ReadonlyArray<StudioHandoffAuditRecord> {
    return this.repository.listRecent(limit);
  }

  public listByHandoffId(handoffId: string, limit?: number): ReadonlyArray<StudioHandoffAuditRecord> {
    return this.repository.listByHandoffId(handoffId, limit);
  }
}

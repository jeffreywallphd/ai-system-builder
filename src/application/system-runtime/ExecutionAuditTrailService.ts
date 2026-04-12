import {
  createExecutionAuditRecord,
  type ExecutionAuditEventKind,
  type ExecutionAuditRecord,
} from "@domain/system-runtime/ExecutionAuditTrailDomain";
import type { ExecutionAuditRepository } from "./ExecutionAuditRepository";

export interface RecordExecutionAuditInput {
  readonly eventKind: ExecutionAuditEventKind;
  readonly requestSource: ExecutionAuditRecord["requestSource"];
  readonly caller: ExecutionAuditRecord["caller"];
  readonly tenant: ExecutionAuditRecord["tenant"];
  readonly execution: ExecutionAuditRecord["execution"];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly detail?: ExecutionAuditRecord["detail"];
  readonly occurredAt?: string;
}

export class ExecutionAuditTrailService {
  public constructor(private readonly repository: ExecutionAuditRepository) {}

  public record(input: RecordExecutionAuditInput): ExecutionAuditRecord {
    const record = createExecutionAuditRecord({
      eventKind: input.eventKind,
      requestSource: input.requestSource,
      caller: input.caller,
      tenant: input.tenant,
      execution: input.execution,
      metadata: input.metadata,
      detail: input.detail,
      occurredAt: input.occurredAt,
    });
    this.repository.save(record);
    return record;
  }

  public listByExecutionId(executionId: string, limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    return this.repository.listByExecutionId(executionId, limit);
  }

  public listRecent(limit?: number): ReadonlyArray<ExecutionAuditRecord> {
    return this.repository.listRecent(limit);
  }
}


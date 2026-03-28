import {
  createDeploymentAuditRecord,
  type DeploymentAuditEventKind,
  type DeploymentAuditOutcome,
  type DeploymentAuditRecord,
} from "../../domain/deployment/DeploymentAuditTrailDomain";

export interface DeploymentAuditRepository {
  save(record: DeploymentAuditRecord): DeploymentAuditRecord;
  listRecent(limit?: number): ReadonlyArray<DeploymentAuditRecord>;
  listByDeploymentId(deploymentId: string, limit?: number): ReadonlyArray<DeploymentAuditRecord>;
}

export class InMemoryDeploymentAuditRepository implements DeploymentAuditRepository {
  private readonly records = new Map<string, DeploymentAuditRecord>();

  public save(record: DeploymentAuditRecord): DeploymentAuditRecord {
    this.records.set(record.auditId, record);
    return record;
  }

  public listRecent(limit = 100): ReadonlyArray<DeploymentAuditRecord> {
    return Object.freeze([...this.records.values()]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, Math.max(0, limit)));
  }

  public listByDeploymentId(deploymentId: string, limit = 100): ReadonlyArray<DeploymentAuditRecord> {
    const normalized = deploymentId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }
    return Object.freeze([...this.records.values()]
      .filter((entry) => entry.deployment.deploymentId === normalized)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, Math.max(0, limit)));
  }
}

export interface RecordDeploymentAuditInput {
  readonly eventKind: DeploymentAuditEventKind;
  readonly outcome: DeploymentAuditOutcome;
  readonly requestSource: DeploymentAuditRecord["requestSource"];
  readonly caller: DeploymentAuditRecord["caller"];
  readonly tenant: DeploymentAuditRecord["tenant"];
  readonly deployment: DeploymentAuditRecord["deployment"];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly detail?: DeploymentAuditRecord["detail"];
  readonly occurredAt?: string;
}

export class DeploymentAuditTrailService {
  public constructor(private readonly repository: DeploymentAuditRepository) {}

  public record(input: RecordDeploymentAuditInput): DeploymentAuditRecord {
    const record = createDeploymentAuditRecord({
      eventKind: input.eventKind,
      outcome: input.outcome,
      requestSource: input.requestSource,
      caller: input.caller,
      tenant: input.tenant,
      deployment: input.deployment,
      metadata: input.metadata,
      detail: input.detail,
      occurredAt: input.occurredAt,
    });
    this.repository.save(record);
    return record;
  }

  public listRecent(limit?: number): ReadonlyArray<DeploymentAuditRecord> {
    return this.repository.listRecent(limit);
  }

  public listByDeploymentId(deploymentId: string, limit?: number): ReadonlyArray<DeploymentAuditRecord> {
    return this.repository.listByDeploymentId(deploymentId, limit);
  }
}

import type {
  IWorkflowPersistenceRepository,
  WorkflowPersistenceListQuery,
} from "../../application/ports/interfaces/IWorkflowPersistenceRepository";
import type {
  PersistedWorkflowRecord,
  PersistedWorkflowSummary,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import {
  normalizePersistedWorkflowRecord,
  toPersistedWorkflowSummary,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";

export class InMemoryWorkflowPersistenceRepository implements IWorkflowPersistenceRepository {
  private readonly records = new Map<string, PersistedWorkflowRecord>();

  public async create(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    const normalized = normalizePersistedWorkflowRecord(record);
    const id = normalized.id;
    if (!id) {
      throw new Error("Persisted workflow id is required.");
    }
    if (this.records.has(id)) {
      throw new Error(`Persisted workflow '${id}' already exists.`);
    }
    this.records.set(id, normalized);
    return normalized;
  }

  public async update(record: PersistedWorkflowRecord): Promise<PersistedWorkflowRecord> {
    const normalized = normalizePersistedWorkflowRecord(record);
    const id = normalized.id;
    if (!id || !this.records.has(id)) {
      throw new Error(`Persisted workflow '${id}' does not exist.`);
    }
    this.records.set(id, normalized);
    return normalized;
  }

  public async getById(id: string): Promise<PersistedWorkflowRecord | undefined> {
    return this.records.get(id.trim());
  }

  public async list(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    const normalizedSearch = query?.searchText?.trim().toLowerCase();
    let entries = [...this.records.values()];
    if (query?.status) {
      entries = entries.filter((entry) => entry.status === query.status);
    }
    if (query?.ownerId?.trim()) {
      entries = entries.filter((entry) => entry.ownershipContext?.ownerId === query.ownerId?.trim());
    }
    if (query?.studioId?.trim()) {
      entries = entries.filter((entry) => entry.ownershipContext?.studioId === query.studioId?.trim());
    }
    if (normalizedSearch) {
      entries = entries.filter((entry) => (
        entry.name.toLowerCase().includes(normalizedSearch)
        || entry.metadata.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
      ));
    }

    entries.sort((left, right) => right.timestamps.updatedAt.localeCompare(left.timestamps.updatedAt));
    if (Number.isInteger(query?.limit) && (query?.limit ?? 0) > 0) {
      entries = entries.slice(0, query!.limit);
    }

    return Object.freeze(entries.map((entry) => toPersistedWorkflowSummary(entry)));
  }

  public async duplicate(
    sourceWorkflowId: string,
    duplicateRecord: PersistedWorkflowRecord,
  ): Promise<PersistedWorkflowRecord> {
    const sourceId = sourceWorkflowId.trim();
    if (!sourceId || !this.records.has(sourceId)) {
      throw new Error(`Persisted workflow '${sourceId}' does not exist.`);
    }
    return this.create(duplicateRecord);
  }
}

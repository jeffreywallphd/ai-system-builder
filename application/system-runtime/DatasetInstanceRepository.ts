import type { DatasetInstance, DatasetInstanceRole } from "../../domain/system-runtime/DatasetInstanceDomain";

export interface DatasetInstanceRepository {
  save(instance: DatasetInstance): DatasetInstance;
  getById(instanceId: string): DatasetInstance | undefined;
  listBySystemId(systemId: string): ReadonlyArray<DatasetInstance>;
  findBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class InMemoryDatasetInstanceRepository implements DatasetInstanceRepository {
  private readonly byId = new Map<string, DatasetInstance>();

  public save(instance: DatasetInstance): DatasetInstance {
    this.byId.set(instance.instanceId, instance);
    return instance;
  }

  public getById(instanceId: string): DatasetInstance | undefined {
    const normalized = normalizeOptional(instanceId);
    if (!normalized) {
      return undefined;
    }
    return this.byId.get(normalized);
  }

  public listBySystemId(systemId: string): ReadonlyArray<DatasetInstance> {
    const normalized = normalizeOptional(systemId);
    if (!normalized) {
      return Object.freeze([]);
    }
    return Object.freeze(
      [...this.byId.values()]
        .filter((instance) => instance.systemId === normalized)
        .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
    );
  }

  public findBySystemAndRole(input: {
    readonly systemId: string;
    readonly role: DatasetInstanceRole;
    readonly purpose?: string;
  }): DatasetInstance | undefined {
    const normalizedSystemId = normalizeOptional(input.systemId);
    if (!normalizedSystemId) {
      return undefined;
    }
    const normalizedPurpose = normalizeOptional(input.purpose);
    return [...this.byId.values()].find((instance) =>
      instance.systemId === normalizedSystemId
      && instance.role === input.role
      && normalizeOptional(instance.purpose) === normalizedPurpose
    );
  }
}

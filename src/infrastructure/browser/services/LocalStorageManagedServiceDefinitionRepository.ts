import type { ManagedServiceDefinition } from "@application/services/ManagedServiceDefinition";
import {
  createManagedServiceDefinition,
  ManagedServiceSources,
} from "@application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRepository } from "@application/services/interfaces/IManagedServiceDefinitionRepository";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const defaultStorageKey = "ai-loom-studio.managed-service-definitions";

export class LocalStorageManagedServiceDefinitionRepository implements IManagedServiceDefinitionRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage: StorageLike | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async listPersistedDefinitions(): Promise<ReadonlyArray<ManagedServiceDefinition>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<ManagedServiceDefinition>;
      return Object.freeze(
        parsed.map((definition) => createManagedServiceDefinition({
          ...definition,
          source: definition.source ?? ManagedServiceSources.custom,
        })),
      );
    } catch {
      return Object.freeze([]);
    }
  }

  public async savePersistedDefinition(definition: ManagedServiceDefinition): Promise<ManagedServiceDefinition> {
    const current = await this.listPersistedDefinitions();
    const next = Object.freeze([
      ...current.filter((candidate) => candidate.serviceId !== definition.serviceId),
      definition,
    ]);
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
    return definition;
  }

  public async deletePersistedDefinition(serviceId: string): Promise<void> {
    const current = await this.listPersistedDefinitions();
    const next = current.filter((definition) => definition.serviceId !== serviceId);
    if (next.length === 0) {
      if (typeof this.storage?.removeItem === "function") {
        this.storage.removeItem(this.storageKey);
        return;
      }
    }

    this.storage?.setItem(this.storageKey, JSON.stringify(next));
  }
}


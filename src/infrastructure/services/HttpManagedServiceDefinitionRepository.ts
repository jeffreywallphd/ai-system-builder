import type { ManagedServiceDefinition } from "@application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRepository } from "@application/services/interfaces/IManagedServiceDefinitionRepository";
import type { IManagedServiceSupervisorClient } from "@application/services/interfaces/IManagedServiceSupervisorClient";

export class HttpManagedServiceDefinitionRepository implements IManagedServiceDefinitionRepository {
  public constructor(
    private readonly client: IManagedServiceSupervisorClient,
  ) {}

  public async listPersistedDefinitions(): Promise<ReadonlyArray<ManagedServiceDefinition>> {
    const response = await this.client.listDefinitions();
    return response.definitions;
  }

  public async savePersistedDefinition(definition: ManagedServiceDefinition): Promise<ManagedServiceDefinition> {
    const response = await this.client.saveDefinition(definition);
    return response.definition;
  }

  public async deletePersistedDefinition(serviceId: string): Promise<void> {
    await this.client.deleteDefinition(serviceId);
  }
}


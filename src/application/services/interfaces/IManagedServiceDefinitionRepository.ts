import type { ManagedServiceDefinition } from "../ManagedServiceDefinition";

export interface IManagedServiceDefinitionRepository {
  listPersistedDefinitions(): Promise<ReadonlyArray<ManagedServiceDefinition>>;
  savePersistedDefinition(definition: ManagedServiceDefinition): Promise<ManagedServiceDefinition>;
  deletePersistedDefinition(serviceId: string): Promise<void>;
}

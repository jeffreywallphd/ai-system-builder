import type { ManagedServiceDefinition } from "../ManagedServiceDefinition";

export interface IManagedServiceDefinitionRegistry {
  listDefinitions(): ReadonlyArray<ManagedServiceDefinition>;
  getDefinition(serviceId: string): ManagedServiceDefinition | undefined;
}

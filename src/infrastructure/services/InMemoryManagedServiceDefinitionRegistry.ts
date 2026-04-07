import type { ManagedServiceDefinition } from "@application/services/ManagedServiceDefinition";
import { validateManagedServiceDefinition } from "@application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRegistry } from "@application/services/interfaces/IManagedServiceDefinitionRegistry";

export class InMemoryManagedServiceDefinitionRegistry implements IManagedServiceDefinitionRegistry {
  private readonly definitions = new Map<string, ManagedServiceDefinition>();

  constructor(definitions: ReadonlyArray<ManagedServiceDefinition>) {
    for (const definition of definitions) {
      const validatedDefinition = validateManagedServiceDefinition(definition);
      if (this.definitions.has(validatedDefinition.serviceId)) {
        throw new Error(`Managed service '${validatedDefinition.serviceId}' is already registered.`);
      }
      this.definitions.set(validatedDefinition.serviceId, validatedDefinition);
    }
  }

  public listDefinitions(): ReadonlyArray<ManagedServiceDefinition> {
    return Object.freeze([...this.definitions.values()]);
  }

  public getDefinition(serviceId: string): ManagedServiceDefinition | undefined {
    return this.definitions.get(serviceId);
  }
}


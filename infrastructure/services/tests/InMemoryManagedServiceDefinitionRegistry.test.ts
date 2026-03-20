import { describe, expect, it } from "bun:test";
import {
  ManagedServiceRestartPolicies,
  ManagedServiceTransports,
  type ManagedServiceDefinition,
} from "../../../application/services/ManagedServiceDefinition";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "../../../application/services/interfaces/ManagedServiceTypes";
import { InMemoryManagedServiceDefinitionRegistry } from "../InMemoryManagedServiceDefinitionRegistry";

function createDefinition(serviceId: string, kind = ManagedServiceKinds.custom): ManagedServiceDefinition {
  return {
    serviceId,
    kind,
    displayName: `${serviceId} service`,
    transport: ManagedServiceTransports.process,
    args: ["serve"],
    environmentVariables: {},
    autoStartPolicy: ManagedServiceStartPolicies.manual,
    restartPolicy: ManagedServiceRestartPolicies.never,
    startupTimeoutMs: 5_000,
    tags: ["test"],
    capabilities: [],
  };
}

describe("InMemoryManagedServiceDefinitionRegistry", () => {
  it("looks up registered service definitions by service id", () => {
    const pythonDefinition = createDefinition("python-runtime", ManagedServiceKinds.pythonRuntime);
    const customDefinition = createDefinition("custom-service");
    const registry = new InMemoryManagedServiceDefinitionRegistry([
      pythonDefinition,
      customDefinition,
    ]);

    expect(registry.getDefinition("python-runtime")?.displayName).toBe("python-runtime service");
    expect(registry.listDefinitions().map((definition) => definition.serviceId)).toEqual([
      "python-runtime",
      "custom-service",
    ]);
  });

  it("rejects duplicate service ids", () => {
    expect(() => new InMemoryManagedServiceDefinitionRegistry([
      createDefinition("python-runtime"),
      createDefinition("python-runtime"),
    ])).toThrow("already registered");
  });
});

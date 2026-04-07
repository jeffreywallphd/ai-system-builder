import { describe, expect, it } from "bun:test";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "@application/services/interfaces/ManagedServiceTypes";
import {
  createManagedServiceDefinition,
  ManagedServiceRestartPolicies,
  ManagedServiceSources,
  ManagedServiceTransports,
} from "@application/services/ManagedServiceDefinition";
import { LocalStorageManagedServiceDefinitionRepository } from "../LocalStorageManagedServiceDefinitionRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("LocalStorageManagedServiceDefinitionRepository", () => {
  it("persists custom and built-in service definitions across saves", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageManagedServiceDefinitionRepository("test-services", storage);
    const customService = createManagedServiceDefinition({
      serviceId: "local-ollama",
      kind: ManagedServiceKinds.custom,
      displayName: "Local Ollama",
      source: ManagedServiceSources.custom,
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:11434",
      autoStartPolicy: ManagedServiceStartPolicies.manual,
      restartPolicy: ManagedServiceRestartPolicies.never,
    });
    const builtinOverride = createManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      source: ManagedServiceSources.builtin,
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:8100",
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
    });

    await repository.savePersistedDefinition(customService);
    await repository.savePersistedDefinition(builtinOverride);

    const restored = await repository.listPersistedDefinitions();

    expect(restored.map((definition) => definition.serviceId).sort()).toEqual([
      "local-ollama",
      "python-runtime",
    ]);
    expect(restored.find((definition) => definition.serviceId === "local-ollama")?.healthProbe?.url).toBe(
      "http://127.0.0.1:11434/health",
    );
    expect(restored.find((definition) => definition.serviceId === "python-runtime")?.source).toBe("builtin");

    await repository.deletePersistedDefinition("local-ollama");

    expect((await repository.listPersistedDefinitions()).map((definition) => definition.serviceId)).toEqual([
      "python-runtime",
    ]);
  });

  it("returns an empty list when storage contains invalid JSON", async () => {
    const storage = new MemoryStorage();
    storage.setItem("test-services", "not json");

    const repository = new LocalStorageManagedServiceDefinitionRepository("test-services", storage);
    expect(await repository.listPersistedDefinitions()).toEqual([]);
  });
});


import { describe, expect, it } from "bun:test";
import { DependencyContainer } from "../DependencyContainer";
import { InfrastructureRegistry, TOKENS } from "../InfrastructureRegistry";

describe("InfrastructureRegistry", () => {
  it("registers default infrastructure services", () => {
    const c = new DependencyContainer();
    InfrastructureRegistry.register(c, {
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
      },
      env: { APP_NAME: "loom" },
    });

    expect(c.isRegistered(TOKENS.FileStorage)).toBe(true);
    expect(c.isRegistered(TOKENS.AssetCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.WorkflowRepository)).toBe(true);
  });
});

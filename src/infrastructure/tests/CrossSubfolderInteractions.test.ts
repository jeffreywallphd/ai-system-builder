import { describe, expect, it } from "bun:test";
import { ApplicationBootstrap, APPLICATION_TOKENS } from "../../src/infrastructure/composition/ApplicationBootstrap";
import { TOKENS } from "../../src/infrastructure/composition/InfrastructureRegistry";

describe("infrastructure cross-subfolder interactions", () => {
  it("composes config/filesystem/composition services through bootstrap", () => {
    const container = ApplicationBootstrap.createContainer({
      env: { APP_NAME: "loom" },
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
      },
    });

    expect(container.resolve(TOKENS.EnvironmentConfigProvider)).toBeDefined();
    expect(container.resolve(TOKENS.FileStorage)).toBeDefined();
    expect(container.resolve(APPLICATION_TOKENS.WorkflowValidator)).toBeDefined();
  });
});

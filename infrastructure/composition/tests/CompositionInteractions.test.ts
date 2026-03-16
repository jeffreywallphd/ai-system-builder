import { describe, expect, it } from "bun:test";
import { ApplicationBootstrap, APPLICATION_TOKENS } from "../ApplicationBootstrap";

describe("composition interactions", () => {
  it("resolves services with transitive dependencies", () => {
    const c = ApplicationBootstrap.createContainer({
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
      },
    });

    const validator = c.resolve(APPLICATION_TOKENS.WorkflowValidator);
    const service = c.resolve(APPLICATION_TOKENS.NodeCompatibilityService);
    expect(validator).toBeDefined();
    expect(service).toBeDefined();
  });
});

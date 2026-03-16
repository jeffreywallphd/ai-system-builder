import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../AppRuntimeConfig";

describe("AppRuntimeConfig", () => {
  it("returns development defaults", () => {
    const config = AppRuntimeConfig.forDevelopment();

    expect(config.workflowRepositoryMode).toBe("memory");
    expect(config.workflowExecutorMode).toBe("preview");
    expect(config.nodeCatalogMode).toBe("mock");
    expect(config.seedStarterNode).toBe(true);
  });
});

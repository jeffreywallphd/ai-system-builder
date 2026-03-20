import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolsPage", () => {
  it("converts the tools page into an MCP tool authoring surface", () => {
    const source = readSource("ui/pages/ToolsPage.tsx");
    expect(source).toContain("MCP Tools");
    expect(source).toContain("McpLocalServerComposer");
    expect(source).toContain("Ask coding agent");
    expect(source).toContain("publish new workspace-local tools");
    expect(source).not.toContain("Developer workflows");
  });
});

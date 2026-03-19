import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("McpServerSearchBar", () => {
  it("uses friendly discovery wording and search controls", () => {
    const source = readSource("ui/components/mcp/McpServerSearchBar.tsx");

    expect(source).toContain("Discover MCP Servers");
    expect(source).toContain("Connection type");
    expect(source).toContain("Search by server name, provider, or notes");
  });
});

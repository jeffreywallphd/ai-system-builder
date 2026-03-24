import { describe, expect, it } from "bun:test";
import { normalizeMcpToolDefinition, validateMcpToolDefinition } from "../McpToolCapability";

describe("McpToolCapability", () => {
  it("validates required MCP tool contract fields", () => {
    const validation = validateMcpToolDefinition({
      id: "",
      version: "",
      displayName: "",
      sideEffects: "none",
      auth: { kind: "none" },
      tags: [],
      categories: [],
      inputSchema: undefined as never,
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain("missing-id");
    expect(validation.issues.map((issue) => issue.code)).toContain("invalid-input-schema");
  });

  it("normalizes binding and category/tag metadata", () => {
    const normalized = normalizeMcpToolDefinition({
      id: " weather.lookup ",
      version: " 1.0.0 ",
      displayName: " Weather Lookup ",
      sideEffects: "read",
      auth: { kind: "required", scopes: ["  weather.read  "] },
      tags: [" weather "],
      categories: [" data "],
      inputSchema: { type: "object" },
      binding: { serverId: " local ", toolName: " weather ", },
    });

    expect(normalized.id).toBe("weather.lookup");
    expect(normalized.binding?.serverId).toBe("local");
    expect(normalized.auth.scopes).toEqual(["weather.read"]);
  });
});

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
      author: "  Loom Labs  ",
      sideEffects: "read",
      auth: {
        kind: "required",
        scopes: ["  weather.read  "],
        credentialFields: [{ key: " apiKey ", label: " API Key ", secret: true, required: true }],
      },
      permissions: [" network.access "],
      tags: [" weather "],
      categories: [" data "],
      inputSchema: { type: "object" },
      binding: { serverId: " local ", toolName: " weather ", },
    });

    expect(normalized.id).toBe("weather.lookup");
    expect(normalized.author).toBe("Loom Labs");
    expect(normalized.binding?.serverId).toBe("local");
    expect(normalized.auth.scopes).toEqual(["weather.read"]);
    expect(normalized.auth.credentialFields).toEqual([{ key: "apiKey", label: "API Key", secret: true, required: true, format: undefined, description: undefined }]);
    expect(normalized.permissions).toEqual(["network.access"]);
  });

  it("rejects blank author metadata when provided", () => {
    const validation = validateMcpToolDefinition({
      id: "weather.lookup",
      version: "1.0.0",
      displayName: "Weather Lookup",
      author: "   ",
      sideEffects: "read",
      auth: { kind: "none" },
      tags: [],
      categories: [],
      inputSchema: { type: "object" },
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain("invalid-metadata");
  });

  it("validates and normalizes asset I/O contract metadata", () => {
    const validation = validateMcpToolDefinition({
      id: "asset.tool",
      version: "1.0.0",
      displayName: "Asset Tool",
      sideEffects: "read",
      auth: { kind: "none" },
      tags: [],
      categories: [],
      inputSchema: { type: "object" },
      assetIo: {
        inputs: [{ path: " ", valueKind: "asset-reference", resolution: "asset-record" }],
      },
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain("invalid-asset-io");

    const normalized = normalizeMcpToolDefinition({
      id: "asset.tool",
      version: "1.0.0",
      displayName: "Asset Tool",
      sideEffects: "read",
      auth: { kind: "none" },
      tags: [],
      categories: [],
      inputSchema: { type: "object" },
      assetIo: {
        inputs: [{ path: " source ", valueKind: "asset-reference", resolution: "asset-record", assetKinds: ["json"] }],
        outputs: [{ path: " result ", mode: "asset-create", assetKind: "json", name: " Output " }],
      },
    });
    expect(normalized.assetIo?.inputs?.[0]?.path).toBe("source");
    expect(normalized.assetIo?.outputs?.[0]?.path).toBe("result");
    expect(normalized.assetIo?.outputs?.[0]?.name).toBe("Output");
  });
});

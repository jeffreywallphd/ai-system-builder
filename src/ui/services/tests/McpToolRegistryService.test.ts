import { describe, expect, it } from "bun:test";
import { McpToolRegistryService } from "../McpToolRegistryService";

describe("McpToolRegistryService", () => {
  it("applies update with propagated approval from preview", async () => {
    let lastApplyRequest: Record<string, unknown> | undefined;
    const service = new McpToolRegistryService(
      {
        execute: async () =>
          Object.freeze({
            toolId: "mcp:local:weather",
            action: "update",
            transition: "upgrade",
            compatibility: "risky",
            dependencyReferences: Object.freeze([]),
            changeSummary: Object.freeze({}),
            warnings: Object.freeze([]),
            remediationSuggestions: Object.freeze([]),
          } as any),
      },
      {
        execute: async (request) => {
          lastApplyRequest = request as Record<string, unknown>;
          return Object.freeze({ status: "updated" } as any);
        },
      },
    );

    await service.applyUpdateWithApproval({
      toolId: "mcp:local:weather",
      approval: { acknowledgedRisk: true },
    });

    expect(lastApplyRequest?.approval).toEqual({ acknowledgedRisk: true, acknowledgedBreaking: true });
  });

  it("allows bypassing approval gate for automation workflows", async () => {
    let previewCalled = false;
    const service = new McpToolRegistryService(
      {
        execute: async () => {
          previewCalled = true;
          return Object.freeze({}) as any;
        },
      },
      {
        execute: async () => Object.freeze({ status: "updated" } as any),
      },
    );

    await service.applyUpdateWithApproval({
      toolId: "mcp:local:weather",
      requireExplicitApproval: false,
    });

    expect(previewCalled).toBe(false);
  });
});

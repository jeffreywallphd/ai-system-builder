import { describe, expect, it } from "bun:test";
import { RuntimeEnvironmentSelector } from "../RuntimeEnvironmentSelector";
import { RuntimeEnvironmentKinds } from "@domain/system-runtime/RuntimeEnvironmentDomain";

describe("RuntimeEnvironmentSelector", () => {
  it("represents/selects runtime environments for atomic/composite/system execution", () => {
    const selector = new RuntimeEnvironmentSelector();
    const listed = selector.listEnvironments();
    expect(listed.length).toBeGreaterThan(0);

    const resolution = selector.selectEnvironment({
      executableTaxonomies: [
        { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        { structuralKind: "system", semanticRole: "system", behaviorKind: "iterative" },
      ],
      requiresNestedSystems: true,
    });

    expect(resolution.status).toBe("resolved");
    expect(resolution.selectedEnvironment?.kind).toBe(RuntimeEnvironmentKinds.local);
  });

  it("supports explicit environment-kind selection including MCP-mediated profiles", () => {
    const selector = new RuntimeEnvironmentSelector([
      {
        environmentId: "runtime:local",
        kind: RuntimeEnvironmentKinds.local,
        displayName: "Local",
        isDefault: true,
        capabilities: {
          supportsStructuralKinds: ["atomic", "composite", "system"],
          supportsNestedSystems: true,
          supportsMcpMediatedExecution: false,
        },
      },
      {
        environmentId: "runtime:mcp",
        kind: RuntimeEnvironmentKinds.mcp,
        displayName: "MCP-backed",
        capabilities: {
          supportsStructuralKinds: ["atomic", "composite", "system"],
          supportsNestedSystems: true,
          supportsMcpMediatedExecution: true,
        },
      },
    ]);

    const mcpResolution = selector.selectEnvironment({
      requestedKind: RuntimeEnvironmentKinds.mcp,
      executableTaxonomies: [{ structuralKind: "system", semanticRole: "system", behaviorKind: "autonomous" }],
      requiresMcpMediatedExecution: true,
    });

    expect(mcpResolution.status).toBe("resolved");
    expect(mcpResolution.selectedEnvironment?.environmentId).toBe("runtime:mcp");
  });

  it("surfaces unsupported environment requests truthfully", () => {
    const selector = new RuntimeEnvironmentSelector([
      {
        environmentId: "runtime:local",
        kind: RuntimeEnvironmentKinds.local,
        displayName: "Local",
        isDefault: true,
        capabilities: {
          supportsStructuralKinds: ["atomic", "composite", "system"],
          supportsNestedSystems: true,
          supportsMcpMediatedExecution: false,
        },
      },
    ]);

    const unsupported = selector.selectEnvironment({
      requestedKind: RuntimeEnvironmentKinds.remote,
      executableTaxonomies: [{ structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" }],
    });

    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.reason).toContain("No runtime environment satisfies");
  });
});


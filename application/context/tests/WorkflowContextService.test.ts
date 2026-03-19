import { describe, expect, it } from "bun:test";
import { WorkflowContextService } from "../WorkflowContextService";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("WorkflowContextService", () => {
  it("assembles workflow-level context packages with selection and budgeting", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-style",
        name: "Style",
        fragments: [
          {
            id: "style-1",
            kind: "persona",
            content: "Keep the tone warm and concise.",
            order: 0,
          },
        ],
      }),
      new ContextPackage({
        id: "pkg-policy",
        name: "Policy",
        fragments: [
          {
            id: "policy-1",
            kind: "instructions",
            content: "Never reveal internal notes.",
            order: 0,
            metadata: {
              toolInstructions: "Use approved tools only.",
              toolUsePolicy: {
                allowedProviderKinds: ["workflow", "mcp"],
                mcp: { allowedServerIds: ["local"], allowedToolNames: ["echo"] },
              },
            },
          },
        ],
      }),
    ]);
    const workflow = makeWorkflow({}).withMetadata(
      new WorkflowMetadata({
        name: "Context Workflow",
        contextConfiguration: {
          packageReferences: [
            { packageId: "pkg-style", alias: "Style guide" },
            { packageId: "pkg-policy", alias: "Safety rules" },
          ],
          selectedPackageIds: ["pkg-style", "pkg-policy"],
          visibilityMode: "advanced",
          maxCharacters: 200,
        },
      })
    );

    const result = await new WorkflowContextService(repository).inspectWorkflowContext({
      workflow,
      selectedPackageIds: ["pkg-policy"],
    });

    expect(result.selectedPackageIds).toEqual(["pkg-policy"]);
    expect(result.inspection.finalPromptText).toContain("Never reveal internal notes.");
    expect(result.inspection.finalPromptText).not.toContain("warm and concise");
    expect(result.packageLabels).toEqual({
      "pkg-style": "Style guide",
      "pkg-policy": "Safety rules",
    });
    expect(result.executionContext.packageReferences).toEqual([
      { packageId: "pkg-policy", alias: "Safety rules", fragmentIds: undefined },
    ]);
    expect(result.executionContext.toolUsePolicy).toEqual({
      instructions: "Use approved tools only.",
      allowedProviderKinds: ["workflow", "mcp"],
      blockedProviderKinds: undefined,
      mcp: {
        allowedServerIds: ["local"],
        blockedServerIds: undefined,
        allowedToolNames: ["echo"],
        blockedToolNames: undefined,
      },
    });
  });
});

import { describe, expect, it } from "bun:test";
import { WorkflowContextService } from "../WorkflowContextService";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";
import { ContextRecipe } from "../models/ContextRecipe";
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

  it("merges package and dynamic capability guidance into execution context tool policy", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-base",
        name: "Base",
        fragments: [{ id: "base", kind: "instructions", content: "Base package guidance.", order: 0 }],
      }),
    ]);
    const workflow = makeWorkflow({}).withMetadata(
      new WorkflowMetadata({
        name: "Dynamic Context Workflow",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-base", alias: "Base package" }],
        },
      })
    );

    const result = await new WorkflowContextService(repository).inspectWorkflowContext({
      workflow,
      dynamicSources: [
        {
          sourceType: "capability-guidance",
          id: "cap-guidance",
          guidance: [
            {
              title: "MCP Use",
              content: "Prefer the local MCP search_docs tool.",
              providerKind: "mcp",
              serverId: "local",
              toolNames: ["search_docs"],
            },
          ],
        },
      ],
    });

    expect(result.executionContext.assembledContext.promptText).toContain("Prefer the local MCP search_docs tool.");
    expect(result.executionContext.toolUsePolicy).toEqual({
      instructions: "Prefer the local MCP search_docs tool.",
      allowedProviderKinds: ["mcp"],
      blockedProviderKinds: undefined,
      mcp: {
        allowedServerIds: ["local"],
        blockedServerIds: undefined,
        allowedToolNames: ["search_docs"],
        blockedToolNames: undefined,
      },
    });
  });

  it("applies selected recipe defaults without exposing recipe internals to the tool surface", async () => {
    const packageRepository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-company",
        name: "Company Knowledge",
        fragments: [{ id: "company", kind: "retrieved-context", content: "Use the company handbook.", order: 0 }],
      }),
    ]);
    const recipeRepository = new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "company-default",
        name: "Company Default",
        packageReferences: [{ packageId: "pkg-company", alias: "Company Knowledge" }],
        budgetingDefaults: { maxTokens: 150 },
        guidance: { responseStyle: "structured", detailLevel: "concise", strictStructuredOutput: true },
        toolUseGuidance: { mode: "guided", instructions: "Prefer approved workflow tools first." },
      }),
    ]);
    const workflow = makeWorkflow({}).withMetadata(
      new WorkflowMetadata({
        name: "Recipe Workflow",
        contextConfiguration: {
          recipeSelections: [{ recipeId: "company-default", alias: "Company default", surfaceInTool: true }],
          selectedRecipeIds: ["company-default"],
        },
      })
    );

    const result = await new WorkflowContextService(packageRepository, recipeRepository).inspectWorkflowContext({
      workflow,
    });

    expect(result.selectedRecipeIds).toEqual(["company-default"]);
    expect(result.selectedPackageIds).toEqual(["pkg-company"]);
    expect(result.recipeLabels).toEqual({ "company-default": "Company default" });
    expect(result.executionContext.assembledContext.promptText).toContain("Response style: structured.");
    expect(result.executionContext.assembledContext.promptText).toContain("Use the company handbook.");
    expect(result.executionContext.budget.maxTokens).toBe(150);
    expect(result.executionContext.toolUsePolicy?.instructions).toContain("Prefer approved workflow tools first.");
  });

});

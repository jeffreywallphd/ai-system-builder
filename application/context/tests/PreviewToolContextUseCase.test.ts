import { describe, expect, it } from "bun:test";
import { PreviewToolContextUseCase } from "../PreviewToolContextUseCase";
import { WorkflowContextService } from "../WorkflowContextService";
import { ContextPackage } from "../models/ContextPackage";
import { ContextRecipe } from "../models/ContextRecipe";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";
import { LoadToolDefinitionUseCase } from "../../tools/LoadToolDefinitionUseCase";
import type { IWorkflowRepository } from "../../ports/interfaces/IWorkflowRepository";

function makeWorkflowRepository(workflow: ReturnType<typeof makeWorkflow>): IWorkflowRepository {
  return {
    save: async (value) => value,
    load: async (id) => (id === workflow.id ? workflow : undefined),
    delete: async () => undefined,
    exists: async (id) => id === workflow.id,
    list: async () => [workflow],
  };
}

describe("PreviewToolContextUseCase", () => {
  it("keeps tool previews on the tool-safe recipe path while preserving package context", async () => {
    const workflow = makeWorkflow({ id: "wf-tool" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow Source",
        isPublishedAsTool: true,
        toolTitle: "Customer Tool",
        toolSlug: "customer-tool",
        contextConfiguration: {
          recipeSelections: [
            { recipeId: "recipe-safe", alias: "Safe", surfaceInTool: true },
            { recipeId: "recipe-author", alias: "Author Only", surfaceInTool: false },
          ],
          selectedRecipeIds: ["recipe-safe", "recipe-author"],
          packageReferences: [{ packageId: "pkg-policy", alias: "Policy" }],
          selectedPackageIds: ["pkg-policy"],
        },
      })
    );
    const packageRepository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-policy",
        name: "Policy",
        fragments: [{ id: "policy", kind: "instructions", content: "Never leak secrets.", order: 0 }],
      }),
    ]);
    const recipeRepository = new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "recipe-safe",
        name: "Safe",
        guidance: { responseStyle: "structured" },
      }),
      new ContextRecipe({
        id: "recipe-author",
        name: "Author Only",
        guidance: { responseStyle: "strict-structured" },
      }),
    ]);
    const workflowRepository = makeWorkflowRepository(workflow);
    const toolProjectionService = new WorkflowToolProjectionService();

    const result = await new PreviewToolContextUseCase(
      workflowRepository,
      new LoadToolDefinitionUseCase(workflowRepository, toolProjectionService),
      new WorkflowContextService(packageRepository, recipeRepository),
    ).execute({ toolId: "wf-tool" });

    expect(result.target.kind).toBe("tool");
    expect(result.target.label).toBe("Customer Tool");
    expect(result.selectedRecipeIds).toEqual(["recipe-safe"]);
    expect(result.inspection.assembledPromptText).toContain("Response style: structured.");
    expect(result.inspection.assembledPromptText).not.toContain("strict structured output");
    expect(result.deliveryTargets.map((target) => target.channel)).toContain("tool-execution");
  });
});

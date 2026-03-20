import { describe, expect, it } from "bun:test";
import { PreviewWorkflowContextUseCase } from "../PreviewWorkflowContextUseCase";
import { WorkflowContextService } from "../WorkflowContextService";
import { ContextPackage } from "../models/ContextPackage";
import { ContextRecipe } from "../models/ContextRecipe";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { InMemoryContextRecipeRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextRecipeRepository";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

function makeService() {
  return new WorkflowContextService(
    new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-style",
        name: "Style Guide",
        fragments: [
          { id: "sys", kind: "instructions", title: "System", content: "Stay factual.", order: 0 },
          { id: "persona", kind: "persona", title: "Persona", content: "Be warm.", order: 1, metadata: { visibility: "advanced" } },
        ],
      }),
    ]),
    new InMemoryContextRecipeRepository([
      new ContextRecipe({
        id: "recipe-default",
        name: "Default Recipe",
        packageReferences: [{ packageId: "pkg-style", alias: "Style Guide" }],
        guidance: { responseStyle: "structured", detailLevel: "concise" },
        toolUseGuidance: { instructions: "Use workflow tools first.", allowedProviderKinds: ["workflow"] },
      }),
    ]),
  );
}

describe("PreviewWorkflowContextUseCase", () => {
  it("returns deterministic workflow previews with inspection, budgeting, and delivery targets", async () => {
    const workflow = makeWorkflow({ id: "wf-author" }).withMetadata(
      new WorkflowMetadata({
        name: "Author Workflow",
        contextConfiguration: {
          recipeSelections: [{ recipeId: "recipe-default", alias: "Default Recipe" }],
          selectedRecipeIds: ["recipe-default"],
          packageReferences: [{ packageId: "pkg-style", alias: "Style Guide" }],
          selectedPackageIds: ["pkg-style"],
          maxCharacters: 200,
          trimPartialFragments: true,
        },
      })
    );

    const result = await new PreviewWorkflowContextUseCase(makeService()).execute({
      workflow,
      visibilityMode: "advanced",
    });

    expect(result.target).toEqual({ kind: "workflow", id: "wf-author", label: "Author Workflow" });
    expect(result.inspection.finalPromptText).toContain("Stay factual.");
    expect(result.inspection.entries).toContainEqual(expect.objectContaining({ fragmentId: "sys", status: "included" }));
    expect(result.executionContext.toolUsePolicy?.allowedProviderKinds).toEqual(["workflow"]);
    expect(result.deliveryTargets.map((target) => target.channel)).toEqual([
      "prompt",
      "workflow-execution",
      "tool-policy",
    ]);
  });
});

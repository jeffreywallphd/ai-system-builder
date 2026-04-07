import { describe, expect, it } from "bun:test";
import { SaveWorkflowUseCase } from "../SaveWorkflowUseCase";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowRepository, makeWorkflowValidator } from "./testUtils";

describe("SaveWorkflowUseCase", () => {
  it("validates and saves", async () => {
    const workflow = makeWorkflow({ id: "wf" });
    const result = await new SaveWorkflowUseCase(
      makeWorkflowRepository(),
      makeWorkflowValidator()
    ).execute({ workflow });

    expect(result.workflow.id).toBe("wf");
    expect(result.validation?.isValid).toBeTrue();
  });


  it("publishes workflow definitions to canonical asset system when configured", async () => {
    const workflow = makeWorkflow({ id: "wf-canonical" });
    const published: string[] = [];
    const publisher = {
      publishWorkflowDefinition: async (candidate: typeof workflow) => {
        published.push(candidate.id);
        return { assetId: `workflow-definition:${candidate.id}`, versionId: `asset-version:${candidate.id}:1` } as const;
      },
    };

    await new SaveWorkflowUseCase(
      makeWorkflowRepository(),
      makeWorkflowValidator(),
      publisher as any,
    ).execute({ workflow });

    expect(published).toEqual(["wf-canonical"]);
  });

  it("can skip validation", async () => {
    const workflow = makeWorkflow({ id: "wf" });
    const result = await new SaveWorkflowUseCase(makeWorkflowRepository()).execute({ workflow, validateBeforeSave: false });
    expect(result.validation).toBeUndefined();
  });
});

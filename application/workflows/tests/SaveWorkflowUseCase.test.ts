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

  it("can skip validation", async () => {
    const workflow = makeWorkflow({ id: "wf" });
    const result = await new SaveWorkflowUseCase(makeWorkflowRepository()).execute({ workflow, validateBeforeSave: false });
    expect(result.validation).toBeUndefined();
  });
});

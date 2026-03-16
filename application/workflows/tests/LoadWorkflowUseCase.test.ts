import { describe, expect, it } from "bun:test";
import { LoadWorkflowUseCase } from "../LoadWorkflowUseCase";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowRepository, makeWorkflowValidator } from "./testUtils";

describe("LoadWorkflowUseCase", () => {
  it("loads workflow and validates by default", async () => {
    const workflow = makeWorkflow({ id: "wf" });
    const useCase = new LoadWorkflowUseCase(
      makeWorkflowRepository({ load: async () => workflow }),
      makeWorkflowValidator()
    );

    const result = await useCase.execute({ workflowId: " wf " });
    expect(result.workflow?.id).toBe("wf");
    expect(result.validation?.isValid).toBeTrue();
  });

  it("handles missing workflow when throwIfNotFound is false", async () => {
    const result = await new LoadWorkflowUseCase(makeWorkflowRepository()).execute({
      workflowId: "missing",
      throwIfNotFound: false,
    });

    expect(result.workflow).toBeUndefined();
  });
});

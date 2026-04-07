import { describe, expect, it } from "bun:test";
import { ValidateWorkflowUseCase } from "../ValidateWorkflowUseCase";
import { makeWorkflow } from "@domain/services/tests/testUtils";
import { makeWorkflowValidator } from "./testUtils";

describe("ValidateWorkflowUseCase", () => {
  it("delegates validation", () => {
    const workflow = makeWorkflow({ id: "wf" });
    const result = new ValidateWorkflowUseCase(makeWorkflowValidator()).execute({ workflow });
    expect(result.workflow.id).toBe("wf");
    expect(result.validation.isValid).toBeTrue();
  });
});


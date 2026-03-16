import { describe, expect, it } from "bun:test";
import { ExecuteWorkflowUseCase } from "../ExecuteWorkflowUseCase";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowExecutor, makeWorkflowValidator } from "./testUtils";

describe("ExecuteWorkflowUseCase", () => {
  it("executes workflow and applies property overrides", async () => {
    const workflow = makeWorkflow({ nodes: [makeNode({ id: "n1" })] });
    const useCase = new ExecuteWorkflowUseCase(makeWorkflowExecutor(), makeWorkflowValidator());

    const result = await useCase.execute({
      workflow,
      propertyOverrides: { n1: { required: "override" } },
    });

    expect(result.effectiveWorkflow.getNode("n1")?.getProperty("required")?.value).toBe("override");
    expect(result.result.status).toBe("completed");
  });

  it("starts execution", async () => {
    const useCase = new ExecuteWorkflowUseCase(makeWorkflowExecutor(), makeWorkflowValidator());
    const workflow = makeWorkflow({ nodes: [makeNode({ id: "n1" })] });

    const result = await useCase.startExecution({ workflow });
    expect(result.handle.executionId).toBe("exec");
  });

  it("throws when override references unknown node", async () => {
    const useCase = new ExecuteWorkflowUseCase(makeWorkflowExecutor(), makeWorkflowValidator());
    await expect(useCase.execute({ workflow: makeWorkflow({}), propertyOverrides: { bad: { x: 1 } } })).rejects.toThrow("unknown node");
  });
});

import { describe, expect, it } from "bun:test";
import { ExecuteWorkflowUseCase } from "../ExecuteWorkflowUseCase";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowExecutor, makeWorkflowValidator } from "./testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { ContextPackage } from "../../context/models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { WorkflowContextService } from "../../context/WorkflowContextService";

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

  it("assembles workflow context into execution metadata when configured", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-style",
        name: "Style Guide",
        fragments: [{ id: "style", kind: "persona", content: "Be concise.", order: 0 }],
      }),
    ]);
    const workflow = makeWorkflow({ nodes: [makeNode({ id: "n1" })] }).withMetadata(
      new WorkflowMetadata({
        name: "Context Workflow",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-style", alias: "Style Guide" }],
          selectedPackageIds: ["pkg-style"],
        },
      })
    );
    let capturedMetadata: Readonly<Record<string, unknown>> | undefined;
    const executor = makeWorkflowExecutor({
      execute: async (input) => {
        capturedMetadata = input.executionMetadata;
        return { executionId: "exec", status: "completed", outputAssets: [] };
      },
    });
    const useCase = new ExecuteWorkflowUseCase(
      executor,
      makeWorkflowValidator(),
      new WorkflowContextService(repository)
    );

    await useCase.execute({ workflow });

    expect((capturedMetadata?.workflowContext as { promptText?: string })?.promptText).toContain("Be concise.");
  });
});

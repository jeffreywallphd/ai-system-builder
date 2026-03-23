import { describe, expect, it } from "bun:test";
import { ExecuteWorkflowUseCase } from "../ExecuteWorkflowUseCase";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { makeWorkflowExecutor, makeWorkflowValidator } from "./testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { ContextPackage } from "../../context/models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { WorkflowContextService } from "../../context/WorkflowContextService";
import { UnifiedExecutionEngine } from "../../execution/UnifiedExecutionEngine";
import { WorkflowExecutionUnitHandler } from "../../../infrastructure/execution/WorkflowExecutionUnitHandler";

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

  it("routes immediate workflow execution through the unified execution engine", async () => {
    const workflow = makeWorkflow({ nodes: [makeNode({ id: "n1" })] });
    let executedWorkflowId: string | undefined;
    const executor = makeWorkflowExecutor({
      execute: async (input, onEvent) => {
        executedWorkflowId = input.workflow.id;
        onEvent?.({
          executionId: "exec",
          kind: "workflow-completed",
          status: "completed",
          provenance: {
            classification: "scaffolded",
            runtime: "langchain",
            strategyId: "infra-scaffold-langchain",
            detail: "Workflow executed by the scaffold interpreter fallback.",
          },
        });

        return {
          executionId: "exec",
          status: "completed",
          outputAssets: [],
          provenance: {
            classification: "scaffolded",
            runtime: "langchain",
            strategyId: "infra-scaffold-langchain",
            detail: "Workflow executed by the scaffold interpreter fallback.",
          },
        };
      },
    });
    const useCase = new ExecuteWorkflowUseCase(
      executor,
      makeWorkflowValidator(),
      undefined,
      new UnifiedExecutionEngine([new WorkflowExecutionUnitHandler(executor)])
    );
    const observedEvents: string[] = [];

    const result = await useCase.execute({ workflow }, (event) => {
      observedEvents.push(`${event.kind}:${event.provenance?.classification}`);
    });

    expect(executedWorkflowId).toBe(workflow.id);
    expect(result.result.provenance?.classification).toBe("scaffolded");
    expect(observedEvents).toEqual(["workflow-completed:scaffolded"]);
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

    const workflowContext = capturedMetadata?.workflowContext as {
      inspection?: { finalPromptText?: string };
      assembledContext?: { promptText?: string };
    } | undefined;
    expect(workflowContext?.inspection?.finalPromptText).toContain("Be concise.");
    expect(workflowContext?.assembledContext?.promptText).toContain("Be concise.");
  });

  it("passes dynamic workflow context sources through execution metadata", async () => {
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

    await useCase.execute({
      workflow,
      parameters: {
        workflowContext: {
          dynamicSources: [
            {
              sourceType: "example",
              id: "few-shot",
              examples: [{ input: "Q", output: "A" }],
            },
          ],
        },
      },
    });

    const workflowContext = capturedMetadata?.workflowContext as {
      inspection?: { finalPromptText?: string };
      assembledContext?: { promptText?: string };
    } | undefined;
    expect(workflowContext?.inspection?.finalPromptText).toContain("Input:\nQ");
    expect(workflowContext?.assembledContext?.promptText).toContain("Output:\nA");
  });

});

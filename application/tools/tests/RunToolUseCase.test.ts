import { describe, expect, it } from "bun:test";
import { RunToolUseCase } from "../RunToolUseCase";
import { LoadToolDefinitionUseCase } from "../LoadToolDefinitionUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { WorkflowContextService } from "../../context/WorkflowContextService";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { ContextPackage } from "../../context/models/ContextPackage";
import { createWorkflowUnifiedExecutionEngine } from "../../../infrastructure/execution/createWorkflowUnifiedExecutionEngine";

describe("RunToolUseCase", () => {
  it("exposes execute api", () => {
    const repo = new InMemoryWorkflowRepository();
    const projection = new WorkflowToolProjectionService();
    const load = new LoadToolDefinitionUseCase(repo, projection);
    const useCase = new RunToolUseCase(repo, projection, { execute: async () => ({ executionId: "x", status: "completed", outputAssets: [] }), startExecution: async () => { throw new Error("no"); }, canExecute: () => true } as any, load);
    expect(typeof useCase.execute).toBe("function");
  });

  it("routes published tool execution through the unified engine and preserves provenance", async () => {
    const workflow = makeWorkflow({ id: "wf-tool" }).withMetadata(
      new WorkflowMetadata({
        name: "Tool Workflow",
        isPublishedAsTool: true,
        toolTitle: "Tool Workflow",
      })
    );
    const workflowRepository = new InMemoryWorkflowRepository([workflow]);
    const projection = new WorkflowToolProjectionService();
    const load = new LoadToolDefinitionUseCase(workflowRepository as any, projection);
    let executedWorkflowId: string | undefined;
    const workflowExecutor = {
      execute: async (input: any) => {
        executedWorkflowId = input.workflow.id;
        return {
          executionId: "tool-exec-1",
          status: "completed",
          outputAssets: [],
          provenance: {
            classification: "delegated",
            runtime: "python",
            strategyId: "infra-delegated-python",
            detail: "Workflow execution was delegated to the Python runtime.",
          },
        };
      },
      startExecution: async () => {
        throw new Error("not used");
      },
      canExecute: () => true,
    } as any;
    const useCase = new RunToolUseCase(
      workflowRepository as any,
      projection,
      workflowExecutor,
      load,
      undefined,
      createWorkflowUnifiedExecutionEngine(workflowExecutor)
    );

    const result = await useCase.execute({ toolId: "wf-tool", values: { prompt: "hello" } });

    expect(executedWorkflowId).toBe("wf-tool");
    expect(result.executionId).toBe("tool-exec-1");
    expect(result.provenance?.classification).toBe("delegated");
  });

  it("runs a published workflow tool with assembled workflow context metadata", async () => {
    const workflow = makeWorkflow({ id: "wf-context" }).withMetadata(
      new WorkflowMetadata({
        name: "Context Workflow",
        isPublishedAsTool: true,
        toolTitle: "Context Tool",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-style", alias: "Style guide" }],
          selectedPackageIds: ["pkg-style"],
          visibilityMode: "basic",
        },
      })
    );
    const workflowRepository = new InMemoryWorkflowRepository([workflow]);
    const contextRepository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "pkg-style",
        name: "Style guide",
        fragments: [{ id: "style", kind: "persona", content: "Be friendly.", order: 0 }],
      }),
    ]);
    const projection = new WorkflowToolProjectionService();
    const load = new LoadToolDefinitionUseCase(workflowRepository as any, projection);
    let capturedMetadata: Readonly<Record<string, unknown>> | undefined;
    const useCase = new RunToolUseCase(
      workflowRepository as any,
      projection,
      {
        execute: async (input) => {
          capturedMetadata = input.executionMetadata;
          return { executionId: "tool-exec", status: "completed", outputAssets: [] };
        },
        startExecution: async () => {
          throw new Error("not used");
        },
        canExecute: () => true,
      } as any,
      load,
      new WorkflowContextService(contextRepository)
    );

    await useCase.execute({ toolId: "wf-context", values: { "workflow.context.selectedPackageIds": ["pkg-style"] } });

    const workflowContext = capturedMetadata?.workflowContext as {
      inspection?: { finalPromptText?: string };
      assembledContext?: { promptText?: string };
    } | undefined;
    expect(workflowContext?.inspection?.finalPromptText).toContain("Be friendly.");
    expect(workflowContext?.assembledContext?.promptText).toContain("Be friendly.");
  });
});

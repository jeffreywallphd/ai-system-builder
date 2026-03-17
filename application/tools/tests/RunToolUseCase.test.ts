import { describe, expect, it } from "bun:test";
import { RunToolUseCase } from "../RunToolUseCase";
import { LoadToolDefinitionUseCase } from "../LoadToolDefinitionUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";

describe("RunToolUseCase", () => {
  it("exposes execute api", () => {
    const repo = new InMemoryWorkflowRepository();
    const projection = new WorkflowToolProjectionService();
    const load = new LoadToolDefinitionUseCase(repo, projection);
    const useCase = new RunToolUseCase(repo, projection, { execute: async () => ({ executionId: "x", status: "completed", outputAssets: [] }), startExecution: async () => { throw new Error("no"); }, canExecute: () => true } as any, load);
    expect(typeof useCase.execute).toBe("function");
  });
});

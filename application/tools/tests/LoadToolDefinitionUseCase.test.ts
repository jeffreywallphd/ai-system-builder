import { describe, expect, it } from "bun:test";
import { LoadToolDefinitionUseCase } from "../LoadToolDefinitionUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";

describe("LoadToolDefinitionUseCase", () => {
  it("throws when tool not found", async () => {
    const useCase = new LoadToolDefinitionUseCase(new InMemoryWorkflowRepository(), new WorkflowToolProjectionService());
    await expect(useCase.execute("missing")).rejects.toThrow();
  });
});

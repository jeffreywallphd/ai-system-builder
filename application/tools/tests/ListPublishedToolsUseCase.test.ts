import { describe, expect, it } from "bun:test";
import { ListPublishedToolsUseCase } from "../ListPublishedToolsUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";

describe("ListPublishedToolsUseCase", () => {
  it("returns tool summaries", async () => {
    const result = await new ListPublishedToolsUseCase(new InMemoryWorkflowRepository(), new WorkflowToolProjectionService()).execute();
    expect(result.tools).toBeDefined();
  });
});

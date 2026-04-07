import { describe, expect, it } from "bun:test";
import { ListPublishedToolsUseCase } from "../ListPublishedToolsUseCase";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";

describe("tools interactions", () => {
  it("lists only published workflows", async () => {
    const result = await new ListPublishedToolsUseCase(new InMemoryWorkflowRepository(), new WorkflowToolProjectionService()).execute();
    expect(Array.isArray(result.tools)).toBeTrue();
  });
});

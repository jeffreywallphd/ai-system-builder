import { describe, expect, it } from "bun:test";
import { LoadToolDefinitionUseCase } from "../LoadToolDefinitionUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("LoadToolDefinitionUseCase", () => {
  it("throws when tool not found", async () => {
    const useCase = new LoadToolDefinitionUseCase(new InMemoryWorkflowRepository(), new WorkflowToolProjectionService());
    await expect(useCase.execute("missing")).rejects.toThrow();
  });

  it("loads published tools by routing slug or stable internal id", async () => {
    const repository = new InMemoryWorkflowRepository();
    const workflow = makeWorkflow({ id: "wf.Internal_ID" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow Name",
        isPublishedAsTool: true,
        toolTitle: "Tool For Humans",
        toolSlug: " Routed Tool ",
      })
    );

    await repository.save(workflow);

    const useCase = new LoadToolDefinitionUseCase(repository, new WorkflowToolProjectionService());

    await expect(useCase.execute("routed-tool")).resolves.toMatchObject({
      id: "wf.Internal_ID",
      slug: "routed-tool",
    });
    await expect(useCase.execute("wf.Internal_ID")).resolves.toMatchObject({
      id: "wf.Internal_ID",
      slug: "routed-tool",
    });
  });
});

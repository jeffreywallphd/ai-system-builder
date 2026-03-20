import { describe, expect, it } from "bun:test";
import { ListPublishedToolsUseCase } from "../ListPublishedToolsUseCase";
import { InMemoryWorkflowRepository } from "../../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { WorkflowToolProjectionService } from "../../projection/WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("ListPublishedToolsUseCase", () => {
  it("returns tool summaries with classified types", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const node = makeNode({ id: "n1" });

    await workflowRepository.save(
      makeWorkflow({ id: "wf-image", nodes: [node] }).withMetadata(
        new WorkflowMetadata({
          name: "Image Creator",
          isPublishedAsTool: true,
          toolTitle: "Image Creator",
          toolDescription: "Generate social media images",
        })
      )
    );

    const result = await new ListPublishedToolsUseCase(
      workflowRepository,
      new WorkflowToolProjectionService()
    ).execute();

    expect(result.tools.length).toBe(1);
    expect(result.tools[0]?.id).toBe("wf-image");
    expect(result.tools[0]?.slug).toBe("image-creator");
    expect(result.tools[0]?.typeLabel).toBe("Image Creation");
    expect(result.availableTypes.length).toBeGreaterThan(0);
  });

  it("filters published tools by query and type", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    const node = makeNode({ id: "n1" });

    await workflowRepository.save(
      makeWorkflow({ id: "wf-video", nodes: [node] }).withMetadata(
        new WorkflowMetadata({
          name: "Video",
          isPublishedAsTool: true,
          toolTitle: "Video Clip Maker",
          toolDescription: "Create short video clips",
        })
      )
    );

    await workflowRepository.save(
      makeWorkflow({ id: "wf-summary", nodes: [node] }).withMetadata(
        new WorkflowMetadata({
          name: "Summary",
          isPublishedAsTool: true,
          toolTitle: "Meeting Summary",
          toolDescription: "Summarize transcripts",
        })
      )
    );

    const useCase = new ListPublishedToolsUseCase(
      workflowRepository,
      new WorkflowToolProjectionService()
    );

    const byQuery = await useCase.execute({ query: "video" });
    expect(byQuery.tools.length).toBe(1);

    const byType = await useCase.execute({ typeIds: ["summarization"] });
    expect(byType.tools.length).toBe(1);
    expect(byType.tools[0]?.title).toContain("Summary");
  });
  it("includes workflows in the tool projection list even when they are not explicitly published", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();

    await workflowRepository.save(
      makeWorkflow({ id: "wf-form-only", nodes: [makeNode({ id: "n2" })] }).withMetadata(
        new WorkflowMetadata({
          name: "Form Only Workflow",
          description: "Still available on the tool page",
        })
      )
    );

    const result = await new ListPublishedToolsUseCase(
      workflowRepository,
      new WorkflowToolProjectionService()
    ).execute();

    expect(result.tools.map((tool) => tool.id)).toContain("wf-form-only");
  });

});

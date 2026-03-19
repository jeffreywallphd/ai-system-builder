import { describe, expect, it } from "bun:test";
import { WorkflowToolProjectionService } from "../WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("WorkflowToolProjectionService", () => {
  it("projects workflow to tool definition", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "hello" })] });
    const workflow = makeWorkflow({ id: "wf1", nodes: [node] }).withMetadata(new WorkflowMetadata({ name: "WF", isPublishedAsTool: true, toolTitle: "Chat" }));
    const tool = new WorkflowToolProjectionService().projectToTool(workflow);
    expect(tool.id).toBe("wf1");
    expect(tool.slug).toBe("chat");
    expect(tool.title).toBe("Chat");
    expect(tool.sections.length).toBeGreaterThan(0);
  });

  it("uses workflow id as the stable tool id and normalizes published slug metadata", () => {
    const workflow = makeWorkflow({ id: "wf.Stable_ID" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow Name",
        isPublishedAsTool: true,
        toolTitle: "Friendly Tool",
        toolSlug: "  Publish Me Now!  ",
      })
    );

    const tool = new WorkflowToolProjectionService().projectToTool(workflow);

    expect(tool.id).toBe("wf.Stable_ID");
    expect(tool.workflowId).toBe("wf.Stable_ID");
    expect(tool.slug).toBe("publish-me-now");
  });

  it("falls back to title and then workflow id when deriving the route slug", () => {
    const projection = new WorkflowToolProjectionService();
    const titledWorkflow = makeWorkflow({ id: "WF.Internal_ID" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow Name",
        isPublishedAsTool: true,
        toolTitle: "  My Helpful Tool  ",
      })
    );
    const untitledWorkflow = makeWorkflow({ id: "WF.Internal_ID" }).withMetadata(
      new WorkflowMetadata({
        name: "   ---   ",
        isPublishedAsTool: true,
      })
    );

    expect(projection.resolveToolIdentity(titledWorkflow)).toEqual({
      id: "WF.Internal_ID",
      slug: "my-helpful-tool",
    });
    expect(projection.resolveToolIdentity(untitledWorkflow)).toEqual({
      id: "WF.Internal_ID",
      slug: "wf-internal-id",
    });
  });

  it("can keep author-only metadata out of published tools while still exposing the same field to authors", () => {
    const workflow = makeWorkflow({
      id: "wf1",
      nodes: [
        makeNode({
          id: "n1",
          properties: [
            new NodeProperty({
              id: "internal-notes",
              name: "Internal Notes",
              type: "text",
              value: "draft",
              projection: {
                exposeInAuthorForm: true,
                exposeInTool: false,
                authorVisibility: "advanced",
                toolVisibility: "hidden",
              },
            }),
          ],
        }),
      ],
    });

    const service = new WorkflowToolProjectionService();
    const tool = service.projectToTool(workflow);

    expect(tool.sections).toEqual([]);
  });
});

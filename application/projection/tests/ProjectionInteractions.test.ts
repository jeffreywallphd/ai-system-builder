import { describe, expect, it } from "bun:test";
import { WorkflowProjectionService } from "../WorkflowProjectionService";
import { WorkflowToolProjectionService } from "../WorkflowToolProjectionService";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";

describe("projection interactions", () => {
  it("keeps workflow as source of truth when applying form and tool input", () => {
    const node = makeNode({ id: "n1", properties: [new NodeProperty({ id: "p1", name: "Prompt", type: "text", value: "old" })] });
    const workflow = makeWorkflow({ id: "wf1", nodes: [node] }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-style", alias: "Style guide" }],
          selectedPackageIds: ["pkg-style"],
          visibilityMode: "advanced",
        },
      })
    );
    const formUpdated = new WorkflowProjectionService().applyFormInput(workflow, {
      "n1.p1": "new",
      "workflow.context.selectedPackageIds": ["pkg-style"],
      "workflow.context.visibilityMode": "basic",
    });
    const toolUpdated = new WorkflowToolProjectionService().applyToolInput(formUpdated, {
      "n1.p1": "newer",
    });
    expect(toolUpdated.getNode("n1")?.getProperty("p1")?.value).toBe("newer");
    expect(toolUpdated.metadata.contextConfiguration?.visibilityMode).toBe("basic");
  });

  it("normalizes attached package ordering and default selection when authors edit bindings", () => {
    const workflow = makeWorkflow({ id: "wf1" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-style", alias: "Style guide" }],
          selectedPackageIds: ["pkg-style"],
          visibilityMode: "advanced",
        },
      })
    );

    const updated = new WorkflowProjectionService().applyFormInput(workflow, {
      "workflow.context.packageReferences": [
        { packageId: "pkg-b", alias: "Package B", isEnabled: true },
        { packageId: "pkg-a", alias: "Package A", isEnabled: false },
        { packageId: "pkg-b", alias: "Duplicate B", isEnabled: true },
        { packageId: "pkg-c", alias: "Package C", isEnabled: true, includeFragmentIds: ["frag-2", "frag-1", "frag-2"] },
      ],
      "workflow.context.selectedPackageIds": ["pkg-c", "pkg-a", "pkg-b", "missing"],
    });

    expect(updated.metadata.contextConfiguration?.packageReferences).toEqual([
      { packageId: "pkg-b", alias: "Package B", version: undefined, includeFragmentIds: undefined, excludeFragmentIds: undefined, isEnabled: true },
      { packageId: "pkg-a", alias: "Package A", version: undefined, includeFragmentIds: undefined, excludeFragmentIds: undefined, isEnabled: false },
      { packageId: "pkg-c", alias: "Package C", version: undefined, includeFragmentIds: ["frag-2", "frag-1"], excludeFragmentIds: undefined, isEnabled: true },
    ]);
    expect(updated.metadata.contextConfiguration?.selectedPackageIds).toEqual(["pkg-b", "pkg-c"]);
  });
});

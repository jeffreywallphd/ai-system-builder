import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow unit coverage", () => {
  it("defines canvas, toolbar, metadata, validation, node-list, and inspector modules", () => {
    const canvas = readSource("ui/components/workflow/WorkflowCanvas.tsx");
    const toolbar = readSource(
      "ui/components/workflow/WorkflowCanvasToolbar.tsx"
    );
    const connectionInspector = readSource(
      "ui/components/workflow/ConnectionInspector.tsx"
    );
    const metadataPanel = readSource(
      "ui/components/workflow/WorkflowMetadataPanel.tsx"
    );
    const validationPanel = readSource(
      "ui/components/workflow/WorkflowValidationPanel.tsx"
    );
    const nodeList = readSource("ui/components/workflow/WorkflowNodeList.tsx");
    const reactFlowCanvas = readSource(
      "ui/components/workflow/reactflow/ReactFlowCanvas.tsx"
    );

    expect(canvas).toContain("export default function WorkflowCanvas");
    expect(canvas).toContain("fitViewNonce={fitViewNonce}");
    expect(toolbar).toContain("export default function WorkflowCanvasToolbar");
    expect(toolbar).toContain("Clear Selection");
    expect(connectionInspector).toContain(
      "export default function ConnectionInspector"
    );
    expect(connectionInspector).toContain("Remove Connection");
    expect(metadataPanel).toContain("Workflow Metadata");
    expect(validationPanel).toContain("Review workflow errors, warnings");
    expect(nodeList).toContain("Workflow Nodes");
    expect(reactFlowCanvas).toContain("export default function ReactFlowCanvas");
  });

  it("implements node and edge adapters for reactflow", () => {
    const nodeAdapter = readSource("ui/components/workflow/reactflow/NodeAdapter.ts");
    const edgeAdapter = readSource("ui/components/workflow/reactflow/EdgeAdapter.ts");
    const nodeWrapper = readSource(
      "ui/components/workflow/reactflow/ReactFlowNodeWrapper.tsx"
    );

    expect(nodeAdapter).toContain("export class NodeAdapter");
    expect(nodeAdapter).toContain('type: "aiLoomNode"');
    expect(edgeAdapter).toContain("export class EdgeAdapter");
    expect(edgeAdapter).toContain('type: "smoothstep"');
    expect(nodeWrapper).toContain("node.size?.width ?? 360");
  });
});

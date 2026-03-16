import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow unit coverage", () => {
  it("defines canvas, metadata, validation, node-list, and reactflow modules", () => {
    const canvas = readSource("ui/components/workflow/WorkflowCanvas.tsx");
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
    expect(canvas).toContain("import ReactFlowCanvas");
    expect(metadataPanel).toContain("Workflow Metadata");
    expect(validationPanel).toContain("Review workflow errors, warnings");
    expect(nodeList).toContain("Workflow Nodes");
    expect(reactFlowCanvas).toContain("export default function ReactFlowCanvas");
  });

  it("implements node and edge adapters for reactflow", () => {
    const nodeAdapter = readSource("ui/components/workflow/reactflow/NodeAdapter.ts");
    const edgeAdapter = readSource("ui/components/workflow/reactflow/EdgeAdapter.ts");

    expect(nodeAdapter).toContain("export class NodeAdapter");
    expect(nodeAdapter).toContain("type: \"aiLoomNode\"");
    expect(edgeAdapter).toContain("export class EdgeAdapter");
    expect(edgeAdapter).toContain("type: \"smoothstep\"");
  });
});

import { describe, expect, it } from "bun:test";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { Workflow } from "../../../../domain/workflows/Workflow";
import { WorkflowConnection } from "../../../../domain/workflows/WorkflowConnection";
import { WorkflowMetadata } from "../../../../domain/workflows/WorkflowMetadata";
import { InterpretedWorkflowExecutor } from "../InterpretedWorkflowExecutor";

function outputPort(id: string, type: "document" | "chunks"): NodePort {
  return new NodePort({
    id,
    name: id,
    direction: "output",
    compatibility: new NodePortCompatibilityProfile({ valueTypes: [type] }),
  });
}

function inputPort(id: string, type: "document" | "chunks"): NodePort {
  return new NodePort({
    id,
    name: id,
    direction: "input",
    compatibility: new NodePortCompatibilityProfile({ valueTypes: [type] }),
  });
}

describe("Interpreted document workflow", () => {
  it("executes uploader -> chunker -> displayer and exposes chunk outputs", async () => {
    const uploader = new Node({
      id: "uploader",
      definition: new NodeDefinition({
        id: "def-uploader",
        type: "shared.document-uploader",
        title: "Document Uploader",
        category: "input",
        executionKind: "generic",
        properties: [
          new NodeProperty({
            id: "document",
            name: "Document",
            type: "file",
            value: { name: "sample.txt", text: "alpha beta gamma delta epsilon" },
          }),
        ],
        outputPorts: [outputPort("document", "document")],
      }),
    });

    const chunker = new Node({
      id: "chunker",
      definition: new NodeDefinition({
        id: "def-chunker",
        type: "langchain.document-to-chunks",
        title: "Chunker",
        category: "transform",
        executionKind: "generic",
        properties: [
          new NodeProperty({ id: "chunk-size", name: "Chunk Size", type: "integer", value: 10 }),
          new NodeProperty({ id: "chunk-overlap", name: "Chunk Overlap", type: "integer", value: 2 }),
        ],
        inputPorts: [inputPort("document", "document")],
        outputPorts: [outputPort("chunks", "chunks")],
      }),
    });

    const displayer = new Node({
      id: "display",
      definition: new NodeDefinition({
        id: "def-display",
        type: "shared.chunk-displayer",
        title: "Displayer",
        category: "output",
        executionKind: "generic",
        inputPorts: [inputPort("chunks", "chunks")],
      }),
    });

    const workflow = new Workflow({
      id: "wf-doc",
      metadata: new WorkflowMetadata({ name: "Doc Workflow" }),
      nodes: [uploader, chunker, displayer],
      connections: [
        new WorkflowConnection({
          id: "c1",
          source: { nodeId: "uploader", portId: "document" },
          target: { nodeId: "chunker", portId: "document" },
        }),
        new WorkflowConnection({
          id: "c2",
          source: { nodeId: "chunker", portId: "chunks" },
          target: { nodeId: "display", portId: "chunks" },
        }),
      ],
    });

    let outputs: Record<string, unknown> | undefined;
    const result = await new InterpretedWorkflowExecutor().execute({ workflow }, (event) => {
      if (event.kind === "workflow-completed") {
        outputs = event.payload?.nodeOutputs as Record<string, unknown> | undefined;
      }
    });

    expect(result.status).toBe("completed");
    expect(outputs).toBeDefined();
    expect((outputs?.display as { display?: unknown })?.display).toBeDefined();
  });
});

import { describe, expect, it } from "bun:test";
import type {
  IWorkflow,
  IWorkflowAuditInfo,
  IWorkflowMetadata,
  IWorkflowRuntimeProfile,
  IWorkflowValidationResult,
} from "../interfaces/IWorkflow";
import type {
  IWorkflowConnection,
  IWorkflowConnectionCompatibilitySnapshot,
  IWorkflowConnectionEndpoint,
  IWorkflowConnectionMetadata,
} from "../interfaces/IWorkflowConnection";
import type {
  IWorkflowGraph,
  IWorkflowGraphCycle,
  IWorkflowGraphLayer,
  IWorkflowGraphValidationResult,
} from "../interfaces/IWorkflowGraph";
import {
  WorkflowConnection,
  WorkflowConnectionCompatibilitySnapshot,
  WorkflowConnectionEndpoint,
  WorkflowConnectionMetadata,
} from "../WorkflowConnection";
import {
  WorkflowAuditInfo,
  WorkflowMetadata,
  WorkflowRuntimeProfile,
} from "../WorkflowMetadata";
import {
  Workflow,
  WorkflowValidationResult,
} from "../Workflow";
import {
  WorkflowGraph,
  WorkflowGraphCycle,
  WorkflowGraphLayer,
  WorkflowGraphValidationResult,
} from "../WorkflowGraph";
import { makeConnection, makeNode } from "./testUtils";

describe("Workflow contracts", () => {
  it("concrete workflow classes satisfy interface contracts", () => {
    const metadata: IWorkflowMetadata = new WorkflowMetadata({ name: "wf" });
    const audit: IWorkflowAuditInfo = new WorkflowAuditInfo();
    const runtimeProfile: IWorkflowRuntimeProfile = new WorkflowRuntimeProfile({
      preferredRuntime: "ollama",
      allowedRuntimes: ["ollama"],
    });

    const endpoint: IWorkflowConnectionEndpoint = new WorkflowConnectionEndpoint({
      nodeId: "n",
      portId: "p",
    });
    const connectionMetadata: IWorkflowConnectionMetadata =
      new WorkflowConnectionMetadata({ label: "L" });
    const snapshot: IWorkflowConnectionCompatibilitySnapshot =
      new WorkflowConnectionCompatibilitySnapshot({ valueTypes: ["text"] });

    const connection: IWorkflowConnection = new WorkflowConnection({
      id: "c",
      source: endpoint,
      target: { nodeId: "n2", portId: "p2" },
      metadata: connectionMetadata,
      compatibilitySnapshot: snapshot,
    });

    const node = makeNode({ id: "n" });
    const node2 = makeNode({ id: "n2" });
    const graph: IWorkflowGraph = new WorkflowGraph({
      nodes: [node, node2],
      connections: [makeConnection("c2", "n", "n2")],
    });

    const cycle: IWorkflowGraphCycle = new WorkflowGraphCycle({ nodeIds: ["n", "n"] });
    const layer: IWorkflowGraphLayer = new WorkflowGraphLayer(0, [node]);
    const graphValidation: IWorkflowGraphValidationResult =
      new WorkflowGraphValidationResult({ isValid: true });
    const validation: IWorkflowValidationResult =
      new WorkflowValidationResult({ isValid: true });

    const workflow: IWorkflow = new Workflow({
      id: "wf",
      metadata,
      audit,
      runtimeProfile,
      nodes: [node, node2],
      connections: [connection],
    });

    expect(workflow.id).toBe("wf");
    expect(graph.getNode("n")?.id).toBe("n");
    expect(cycle.nodeIds.length).toBe(2);
    expect(layer.nodes.length).toBe(1);
    expect(graphValidation.isValid).toBeTrue();
    expect(validation.isValid).toBeTrue();
  });
});

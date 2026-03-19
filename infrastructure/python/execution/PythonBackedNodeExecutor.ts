import type { INodeExecutionContext } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { INodeExecutionResult, INodeExecutor } from "../../../application/ports/interfaces/INodeExecutor";
import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type { INode } from "../../../domain/nodes/interfaces/INode";

function nodePropertiesToObject(node: INode): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(node.properties.map((property) => [property.id, property.value]))
  );
}

export class PythonBackedNodeExecutor implements INodeExecutor {
  private readonly client: IPythonRuntimeClient;
  private readonly supportedNodeTypes: ReadonlySet<string>;

  constructor(client: IPythonRuntimeClient, supportedNodeTypes: ReadonlyArray<string> = []) {
    this.client = client;
    this.supportedNodeTypes = new Set(supportedNodeTypes.map((value) => value.toLowerCase()));
  }

  public canExecuteNode(node: INode, runtime = "python"): boolean {
    const nodeRuntime = node.executionProfile?.runtime?.toLowerCase();
    if (nodeRuntime && nodeRuntime !== runtime.toLowerCase()) {
      return false;
    }

    if (!node.isEnabled) {
      return false;
    }

    if (this.supportedNodeTypes.size === 0) {
      const nodeType = node.definition.type.toLowerCase();
      return nodeType.startsWith("langchain.") || nodeType.startsWith("mcp.");
    }

    return this.supportedNodeTypes.has(node.definition.type.toLowerCase());
  }

  public async executeNode(context: INodeExecutionContext): Promise<INodeExecutionResult> {
    if (!this.canExecuteNode(context.node)) {
      return {
        nodeId: context.node.id,
        status: "skipped",
        outputs: {},
        messages: ["Node not delegated to python runtime."],
      };
    }

    const response = await this.client.executeNode({
      workflowId: context.workflow.id,
      nodeId: context.node.id,
      nodeType: context.node.definition.type,
      inputs: context.resolvedInputs,
      properties: nodePropertiesToObject(context.node),
      context: {
        workflowInputs: context.workflowInputs,
        upstreamOutputs: context.upstreamOutputs,
      },
    });

    return {
      nodeId: response.nodeId,
      status: response.status,
      outputs: response.outputs,
      messages: response.messages,
      errorMessage: response.errorMessage,
    };
  }
}

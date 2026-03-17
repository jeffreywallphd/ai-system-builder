import type { IModelExecutor } from "../../../application/ports/interfaces/IModelExecutor";
import type { INodeExecutor, INodeExecutionResult } from "../../../application/ports/interfaces/INodeExecutor";
import type { INodeExecutionContext } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { INode } from "../../../domain/nodes/interfaces/INode";

export class LangChainNodeExecutor implements INodeExecutor {
  private readonly modelExecutor?: IModelExecutor;

  constructor(modelExecutor?: IModelExecutor) {
    this.modelExecutor = modelExecutor;
  }

  public canExecuteNode(node: INode, runtime = "langchain"): boolean {
    const nodeRuntime = node.executionProfile?.runtime?.toLowerCase();
    if (nodeRuntime && nodeRuntime !== runtime.toLowerCase()) {
      return false;
    }

    return node.isEnabled;
  }

  public async executeNode(context: INodeExecutionContext): Promise<INodeExecutionResult> {
    if (!this.canExecuteNode(context.node)) {
      return {
        nodeId: context.node.id,
        status: "skipped",
        outputs: {},
        messages: [`Node '${context.node.id}' skipped due to runtime or enabled-state mismatch.`],
      };
    }

    if (context.node.isModelAware() && this.modelExecutor) {
      const modelResult = await this.modelExecutor.execute({
        node: context.node,
        runtime: "langchain",
        inputs: context.resolvedInputs,
        parameters: context.workflowInputs,
      });

      return {
        nodeId: context.node.id,
        status: modelResult.status === "completed" ? "completed" : "failed",
        outputs: modelResult.outputs,
        messages: modelResult.messages,
        errorMessage: modelResult.errorMessage,
      };
    }

    return {
      nodeId: context.node.id,
      status: "completed",
      outputs: {
        result: context.resolvedInputs,
        metadata: {
          nodeType: context.node.definition.type,
        },
      },
      messages: ["LangChain node executed with scaffold interpreter."],
    };
  }
}

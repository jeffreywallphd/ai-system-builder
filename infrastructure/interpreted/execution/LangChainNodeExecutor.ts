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

    const nodeType = context.node.definition.type.toLowerCase();
    const inputs = context.resolvedInputs as Record<string, unknown>;
    const properties = Object.fromEntries(
      context.node.properties.map((property) => [property.id, property.value])
    );

    if (nodeType === "langchain.context-merger") {
      const blocks = ((inputs.context_blocks as ReadonlyArray<unknown> | undefined) ??
        (properties.context_blocks as ReadonlyArray<unknown> | undefined) ??
        [])
        .map((value) => String(value));
      const separator = String(inputs.separator ?? properties.separator ?? "\n\n");
      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          merged_context: blocks.join(separator),
          block_count: blocks.length,
        },
        messages: ["LangChain context merger executed with interpreter."],
      };
    }

    if (nodeType === "langchain.output-parser") {
      const outputText = String(inputs.output_text ?? properties.output_text ?? "");
      const prefix = String(inputs.prefix ?? properties.prefix ?? "");
      const parsedOutput = prefix && outputText.startsWith(prefix)
        ? outputText.slice(prefix.length).trim()
        : outputText.trim();
      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          parsed_output: parsedOutput,
          raw_output: outputText,
        },
        messages: ["LangChain output parser executed with interpreter."],
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

import type { IModelExecutor } from "../../../application/ports/interfaces/IModelExecutor";
import type { INodeExecutor, INodeExecutionResult } from "../../../application/ports/interfaces/INodeExecutor";
import type { INodeExecutionContext } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { INode } from "../../../domain/nodes/interfaces/INode";

interface UploadedDocument {
  readonly name?: string;
  readonly text?: string;
  readonly type?: string;
  readonly size?: number;
  readonly error?: string;
}

function readProperty(node: INode, propertyId: string): unknown {
  return node.properties.find((property) => property.id === propertyId)?.value;
}

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

    if (nodeType === "shared.document-uploader") {
      const document = readProperty(context.node, "document") as UploadedDocument | undefined;
      if (!document) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["No file uploaded. Select a document in node properties."],
          errorMessage: "No file uploaded.",
        };
      }

      if (document.error) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: [document.error],
          errorMessage: document.error,
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          document: {
            name: document.name ?? "document",
            text: document.text ?? "",
            mimeType: document.type ?? "text/plain",
            size: document.size ?? 0,
          },
        },
        messages: ["Document uploaded successfully."],
      };
    }

    if (nodeType === "langchain.document-to-chunks") {
      const document = inputs.document as UploadedDocument | undefined;
      if (!document || typeof document.text !== "string") {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["Chunker received no readable document input."],
          errorMessage: "Missing document input.",
        };
      }

      const chunkSize = Math.max(1, Number(properties["chunk-size"] ?? 500));
      const chunkOverlap = Math.max(0, Number(properties["chunk-overlap"] ?? 50));
      const step = Math.max(1, chunkSize - chunkOverlap);
      const text = document.text;
      const chunks: Array<{ index: number; text: string }> = [];

      for (let cursor = 0, index = 0; cursor < text.length; cursor += step, index += 1) {
        const content = text.slice(cursor, cursor + chunkSize).trim();
        if (!content) {
          continue;
        }
        chunks.push({ index, text: content });
      }

      if (chunks.length === 0) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["Chunker produced no chunks from the provided document."],
          errorMessage: "No chunks produced.",
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          chunks,
        },
        messages: [`Generated ${chunks.length} chunk(s).`],
      };
    }

    if (nodeType === "shared.chunk-displayer") {
      const chunks = inputs.chunks;
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            display: "No chunks received.",
          },
          messages: ["Chunk displayer received no chunks."],
          errorMessage: "No chunks received.",
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          display: chunks,
          chunks,
        },
        messages: [`Displaying ${chunks.length} chunk(s).`],
      };
    }

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

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

interface ChunkRecord {
  readonly index?: number;
  readonly text: string;
  readonly score?: number;
}

function readProperty(node: INode, propertyId: string): unknown {
  return node.properties.find((property) => property.id === propertyId)?.value;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>).text;
    return typeof text === "string" ? text : JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).join("\n\n");
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function toChunkRecords(value: unknown): ChunkRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const chunks: ChunkRecord[] = [];

  value.forEach((item, index) => {
    if (typeof item === "string") {
      if (item.trim().length > 0) {
        chunks.push({ index, text: item });
      }
      return;
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const directText = record.text;
      const nestedMetadata = record.metadata as Record<string, unknown> | undefined;
      const nestedText = nestedMetadata?.text;
      const text = typeof directText === "string" ? directText : nestedText;
      if (typeof text === "string" && text.trim().length > 0) {
        chunks.push({
          index: typeof record.index === "number" ? (record.index as number) : index,
          text,
        });
      }
    }
  });

  return chunks;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreText(query: string, candidate: string): number {
  const queryTokens = tokenize(query);
  const candidateTokens = new Set(tokenize(candidate));

  if (queryTokens.length === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

function buildEmbeddingVector(text: string, dimensions: number, normalizeVectors: boolean): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const source = text || " ";

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    vector[index % dimensions] += (code % 97) / 100;
  }

  if (!normalizeVectors) {
    return vector;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
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

      const chunkSize = Math.max(1, Number(properties["chunk-size"] ?? 1000));
      const chunkOverlap = Math.max(0, Number(properties["chunk-overlap"] ?? 200));
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
      const primary = inputs.primary ?? inputs.context_blocks ?? properties.primary;
      const secondary = inputs.secondary ?? properties.secondary;
      const mergeStrategy = String(properties["merge-strategy"] ?? "json-merge");
      const sources = [primary, secondary].filter((value) => value !== undefined);

      if (mergeStrategy === "concat-text") {
        const mergedText = sources.map((value) => normalizeText(value)).filter(Boolean).join("\n\n");
        return {
          nodeId: context.node.id,
          status: "completed",
          outputs: {
            merged: { text: mergedText },
            merged_context: mergedText,
            block_count: sources.length,
          },
          messages: ["LangChain context merger concatenated text sources."],
        };
      }

      const merged = sources.reduce<Record<string, unknown>>((accumulator, value, index) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return { ...accumulator, ...(value as Record<string, unknown>) };
        }

        accumulator[`context_${index + 1}`] = normalizeText(value);
        return accumulator;
      }, {});

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          merged,
          merged_context: merged,
          block_count: sources.length,
        },
        messages: ["LangChain context merger executed with interpreter."],
      };
    }

    if (nodeType === "langchain.output-parser") {
      const format = String(properties.format ?? "json");
      const outputValue = inputs.output ?? inputs.output_text ?? properties.output_text ?? "";
      const outputText = normalizeText(outputValue);
      const prefix = String(inputs.prefix ?? properties.prefix ?? "");
      const parsedText = prefix && outputText.startsWith(prefix)
        ? outputText.slice(prefix.length).trim()
        : outputText.trim();

      let parsed: unknown = parsedText;
      if (format === "json") {
        try {
          parsed = JSON.parse(parsedText);
        } catch {
          parsed = { text: parsedText };
        }
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          parsed,
          parsed_output: parsed,
          raw_output: outputText,
        },
        messages: ["LangChain output parser executed with interpreter."],
      };
    }

    if (nodeType === "langchain.embedding-generator") {
      const dimensions = Math.max(1, Number(properties.dimensions ?? 1536));
      const normalizeVectors = Boolean(properties["normalize-vectors"] ?? true);
      const text = normalizeText(inputs.text);
      const chunks = toChunkRecords(inputs.text);
      const sourceItems = chunks.length > 0 ? chunks.map((chunk) => chunk.text) : [text];
      const vectors = sourceItems
        .filter((item) => item.trim().length > 0)
        .map((item) => buildEmbeddingVector(item, dimensions, normalizeVectors));

      return {
        nodeId: context.node.id,
        status: vectors.length > 0 ? "completed" : "failed",
        outputs: {
          embedding: {
            dimensions,
            count: vectors.length,
            vectors,
          },
        },
        messages: [vectors.length > 0 ? `Generated ${vectors.length} embedding vector(s).` : "No text received for embedding generation."],
        errorMessage: vectors.length > 0 ? undefined : "No text received for embedding generation.",
      };
    }

    if (nodeType === "langchain.vector-store-upsert") {
      const embedding = inputs.embedding as Record<string, unknown> | undefined;
      const metadata = inputs.metadata;
      const namespace = String(properties.namespace ?? "default");
      const batchSize = Math.max(1, Number(properties["batch-size"] ?? 100));
      const vectors = Array.isArray(embedding?.vectors) ? embedding.vectors : [];
      const sourceChunks = toChunkRecords(metadata);
      const records = vectors.map((vector, index) => ({
        id: `${namespace}-${index + 1}`,
        namespace,
        vector,
        metadata: sourceChunks[index] ?? metadata ?? null,
      }));

      return {
        nodeId: context.node.id,
        status: records.length > 0 ? "completed" : "failed",
        outputs: {
          dataset: {
            namespace,
            batchSize,
            recordCount: records.length,
            records,
          },
        },
        messages: [records.length > 0 ? `Prepared ${records.length} vector store record(s).` : "No embeddings were available to store."],
        errorMessage: records.length > 0 ? undefined : "No embeddings were available to store.",
      };
    }

    if (nodeType === "langchain.retrieval-query") {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties["top-k"] ?? 5));
      const minimumScore = Number(properties["min-score"] ?? 0.2);
      const dataset = inputs.dataset as Record<string, unknown> | undefined;
      const candidateChunks = [
        ...toChunkRecords(dataset?.records),
        ...toChunkRecords(inputs.dataset),
      ];
      const scored = candidateChunks
        .map((chunk, index) => ({
          index: chunk.index ?? index,
          text: chunk.text,
          score: Number(scoreText(query, chunk.text).toFixed(3)),
        }))
        .filter((chunk) => chunk.score >= minimumScore)
        .sort((left, right) => right.score - left.score)
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          matches: scored,
          scores: scored.map(({ index, score }) => ({ index, score })),
        },
        messages: [`Retrieved ${scored.length} matching chunk(s).`],
      };
    }

    if (nodeType === "langchain.reranker") {
      const query = normalizeText(inputs.query);
      const topN = Math.max(1, Number(properties["top-n"] ?? 3));
      const candidates = toChunkRecords(inputs.candidates);
      const reranked = candidates
        .map((chunk, index) => ({
          index: chunk.index ?? index,
          text: chunk.text,
          score: Number(scoreText(query, chunk.text).toFixed(3)),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, topN);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          reranked,
          scores: reranked.map(({ index, score }) => ({ index, score })),
        },
        messages: [`Reranked ${reranked.length} candidate chunk(s).`],
      };
    }

    if (nodeType === "langchain.answer-synthesizer") {
      const question = normalizeText(inputs.question);
      const contextChunks = [
        ...toChunkRecords(inputs.context),
        ...toChunkRecords((inputs.context as Record<string, unknown> | undefined)?.matches),
      ];
      const contextText =
        contextChunks.length > 0
          ? contextChunks.map((chunk) => chunk.text).join("\n")
          : normalizeText(inputs.context);
      const style = String(properties["response-style"] ?? "concise");
      const maxSources = Math.max(1, Number(properties["max-sources"] ?? 4));
      const selectedSources = contextChunks.slice(0, maxSources);
      const answerPrefix =
        style === "bulleted" ? "- " : style === "detailed" ? "Detailed answer: " : "Answer: ";
      const answerBody = contextText
        ? `${question}\n\nBased on context: ${contextText.slice(0, 400)}`
        : question;

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          answer: `${answerPrefix}${answerBody}`,
          citations: selectedSources.map((chunk) => ({ index: chunk.index, text: chunk.text })),
        },
        messages: [`Synthesized an answer with ${selectedSources.length} citation source(s).`],
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

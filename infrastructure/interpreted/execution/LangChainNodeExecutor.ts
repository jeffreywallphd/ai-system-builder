import type { IModelExecutor } from "../../../application/ports/interfaces/IModelExecutor";
import type { INodeExecutor, INodeExecutionResult } from "../../../application/ports/interfaces/INodeExecutor";
import type { INodeExecutionContext } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { ChatMessage, Document } from "../../../domain/nodes/WorkflowDataTypes";

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

const messageHistoryStore = new Map<string, ChatMessage[]>();

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
          score: typeof record.score === "number" ? record.score : undefined,
        });
      }
    }
  });

  return chunks;
}

function toDocuments(value: unknown): Document[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item === "string") {
      return item.trim().length > 0
        ? [{ id: `doc-${index + 1}`, text: item, metadata: {} } satisfies Document]
        : [];
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : normalizeText(record);
    if (!text.trim()) {
      return [];
    }

    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : undefined;

    return [
      {
        id: typeof record.id === "string" ? record.id : `doc-${index + 1}`,
        text,
        metadata,
      } satisfies Document,
    ];
  });
}

function toChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = record.content;
    if (
      (role === "system" || role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      return [{ role, content } satisfies ChatMessage];
    }

    return [];
  });
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

function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const safeChunkSize = Math.max(1, chunkSize);
  const safeChunkOverlap = Math.max(0, Math.min(chunkOverlap, safeChunkSize - 1));
  const step = Math.max(1, safeChunkSize - safeChunkOverlap);
  const chunks: string[] = [];

  for (let cursor = 0; cursor < text.length; cursor += step) {
    const chunk = text.slice(cursor, cursor + safeChunkSize).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function supportsNodeType(nodeType: string, ...types: string[]): boolean {
  return types.includes(nodeType);
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

    if (supportsNodeType(nodeType, "langchain.document_loader")) {
      const source = normalizeText(inputs.source ?? properties.source);
      const sourceType = String(properties.type ?? "text");
      const encoding = String(properties.encoding ?? "utf-8");
      const document: Document = {
        id: `${sourceType}-document`,
        text: source,
        metadata: { type: sourceType, encoding },
      };

      return {
        nodeId: context.node.id,
        status: source ? "completed" : "failed",
        outputs: {
          documents: source ? [document] : [],
        },
        messages: [source ? "Document loader produced 1 document." : "Document loader received no source."],
        errorMessage: source ? undefined : "Document loader received no source.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.document-to-chunks")) {
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
      const chunks = splitTextIntoChunks(document.text, chunkSize, chunkOverlap).map((text, index) => ({
        index,
        text,
      }));

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

    if (supportsNodeType(nodeType, "langchain.text_splitter", "langchain.text-splitter")) {
      const text = normalizeText(inputs.text);
      const chunkSize = Math.max(
        1,
        Number(properties.chunkSize ?? properties["chunk-size"] ?? 500)
      );
      const chunkOverlap = Math.max(
        0,
        Number(properties.chunkOverlap ?? properties["chunk-overlap"] ?? 50)
      );
      const chunks = splitTextIntoChunks(text, chunkSize, chunkOverlap);

      return {
        nodeId: context.node.id,
        status: chunks.length > 0 ? "completed" : "failed",
        outputs: { chunks },
        messages: [chunks.length > 0 ? `Split text into ${chunks.length} chunk(s).` : "No text received for splitting."],
        errorMessage: chunks.length > 0 ? undefined : "No text received for splitting.",
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

    if (supportsNodeType(nodeType, "langchain.prompt_template", "langchain.prompt-template")) {
      const template = String(properties.template ?? "");
      const variablesInput = inputs.variables ?? inputs["template-input"] ?? {};
      const variables =
        variablesInput && typeof variablesInput === "object" && !Array.isArray(variablesInput)
          ? (variablesInput as Record<string, unknown>)
          : {};
      const prompt = template.replace(/\{([^}]+)\}/g, (_match, key) => {
        const value = variables[key.trim()];
        return value === undefined || value === null ? "" : normalizeText(value);
      });

      return {
        nodeId: context.node.id,
        status: prompt ? "completed" : "failed",
        outputs: {
          prompt,
          formatted_prompt: prompt,
        },
        messages: [prompt ? "Prompt template formatted successfully." : "Prompt template is empty."],
        errorMessage: prompt ? undefined : "Prompt template is empty.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.chat_prompt", "langchain.chat-prompt")) {
      const includeContext = Boolean(properties.includeContext ?? true);
      const includeHistory = Boolean(properties.includeHistory ?? properties["include-history"] ?? true);
      const history = includeHistory ? toChatMessages(inputs.history) : [];
      const system = normalizeText(inputs.system);
      const user = normalizeText(inputs.user);
      const contextText = includeContext ? normalizeText(inputs.context) : "";
      const messages: ChatMessage[] = [];

      if (system) {
        messages.push({ role: "system", content: system });
      }

      if (history.length > 0) {
        messages.push(...history);
      }

      if (contextText) {
        messages.push({ role: "system", content: `Context:\n${contextText}` });
      }

      if (user) {
        messages.push({ role: "user", content: user });
      }

      return {
        nodeId: context.node.id,
        status: user ? "completed" : "failed",
        outputs: {
          messages,
        },
        messages: [user ? `Chat prompt assembled ${messages.length} message(s).` : "Chat prompt requires a user message."],
        errorMessage: user ? undefined : "Chat prompt requires a user message.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.llm_chat")) {
      const prompt = normalizeText(inputs.prompt);
      const messages = toChatMessages(inputs.messages);
      const model = String(properties.model ?? "");
      const temperature = Number(properties.temperature ?? 0.7);
      const maxTokens = properties.maxTokens !== undefined ? Number(properties.maxTokens) : undefined;
      const topP = properties.topP !== undefined ? Number(properties.topP) : undefined;
      const renderedInput = messages.length > 0
        ? messages.map((message) => `${message.role}: ${message.content}`).join("\n")
        : prompt;
      const response = renderedInput
        ? `[${model || "deterministic-model"}] ${renderedInput}`
        : "";

      return {
        nodeId: context.node.id,
        status: response ? "completed" : "failed",
        outputs: {
          response,
          raw: {
            model,
            temperature,
            maxTokens,
            topP,
            inputMode: messages.length > 0 ? "messages" : "prompt",
            messageCount: messages.length,
          },
        },
        messages: [response ? "LLM chat node generated a deterministic response." : "LLM chat requires messages or prompt input."],
        errorMessage: response ? undefined : "LLM chat requires messages or prompt input.",
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

    if (supportsNodeType(nodeType, "langchain.output_parser", "langchain.output-parser")) {
      const format = String(properties.format ?? "json");
      const outputValue = inputs.text ?? inputs.output ?? inputs.output_text ?? properties.output_text ?? "";
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

    if (supportsNodeType(nodeType, "langchain.embeddings", "langchain.embedding-generator")) {
      const dimensions = Math.max(1, Number(properties.dimensions ?? 1536));
      const normalizeVectors = Boolean(properties.normalize ?? properties["normalize-vectors"] ?? true);
      const textItems = Array.isArray(inputs.texts)
        ? inputs.texts.map((item) => normalizeText(item)).filter(Boolean)
        : [];
      const legacyText = normalizeText(inputs.text);
      const legacyChunks = toChunkRecords(inputs.text).map((chunk) => chunk.text);
      const sourceItems = textItems.length > 0
        ? textItems
        : legacyChunks.length > 0
          ? legacyChunks
          : legacyText
            ? [legacyText]
            : [];
      const vectors = sourceItems.map((item) => buildEmbeddingVector(item, dimensions, normalizeVectors));

      return {
        nodeId: context.node.id,
        status: vectors.length > 0 ? "completed" : "failed",
        outputs: {
          embeddings: vectors,
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

    if (supportsNodeType(nodeType, "langchain.retriever", "langchain.retrieval-query")) {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.topK ?? properties["top-k"] ?? 5));
      const minimumScore = Number(properties["min-score"] ?? 0);
      const dataset = (inputs.vectorStore ?? inputs.dataset) as Record<string, unknown> | unknown[] | undefined;
      const candidateDocuments = [
        ...toDocuments((dataset as Record<string, unknown> | undefined)?.records),
        ...toDocuments(dataset),
        ...toDocuments(inputs.documents),
      ];
      const candidateChunks = candidateDocuments.length > 0
        ? candidateDocuments.map((document, index) => ({
            index,
            text: document.text,
            metadata: document.metadata,
          }))
        : [
            ...toChunkRecords((dataset as Record<string, unknown> | undefined)?.records),
            ...toChunkRecords(dataset),
          ];
      const scored = candidateChunks
        .map((chunk, index) => ({
          id: `doc-${index + 1}`,
          text: chunk.text,
          metadata: {
            ...(typeof chunk === "object" && "metadata" in chunk ? (chunk as Record<string, unknown>).metadata as Record<string, unknown> : {}),
            score: Number(scoreText(query, chunk.text).toFixed(3)),
          },
        }))
        .filter((document) => Number(document.metadata?.score ?? 0) >= minimumScore)
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          documents: scored,
          matches: scored.map((document, index) => ({ index, text: document.text, score: document.metadata?.score })),
          scores: scored.map((document, index) => ({ index, score: document.metadata?.score })),
        },
        messages: [`Retrieved ${scored.length} matching document(s).`],
      };
    }

    if (nodeType === "langchain.reranker") {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.topK ?? properties["top-n"] ?? 3));
      const documents = toDocuments(inputs.documents);
      const candidates = documents.length > 0
        ? documents.map((document) => ({ text: document.text, metadata: document.metadata }))
        : toChunkRecords(inputs.candidates);
      const rerankedDocuments = candidates
        .map((candidate, index) => ({
          id: `doc-${index + 1}`,
          text: candidate.text,
          metadata: {
            ...(typeof candidate === "object" && "metadata" in candidate ? (candidate as Record<string, unknown>).metadata as Record<string, unknown> : {}),
            score: Number(scoreText(query, candidate.text).toFixed(3)),
          },
        }))
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          documents: rerankedDocuments,
          reranked: rerankedDocuments.map((document, index) => ({ index, text: document.text, score: document.metadata?.score })),
          scores: rerankedDocuments.map((document, index) => ({ index, score: document.metadata?.score })),
        },
        messages: [`Reranked ${rerankedDocuments.length} candidate document(s).`],
      };
    }

    if (supportsNodeType(nodeType, "langchain.memory")) {
      const sessionId = normalizeText(inputs.sessionId);
      const newMessages = toChatMessages(inputs.messages);
      const maxMessages = Math.max(1, Number(properties.maxMessages ?? 10));
      const existingHistory = messageHistoryStore.get(sessionId) ?? [];
      const history = [...existingHistory, ...newMessages].slice(-maxMessages);
      if (sessionId) {
        messageHistoryStore.set(sessionId, history);
      }

      return {
        nodeId: context.node.id,
        status: sessionId ? "completed" : "failed",
        outputs: {
          history,
        },
        messages: [sessionId ? `Stored ${history.length} message(s) for session ${sessionId}.` : "Message history requires a session ID."],
        errorMessage: sessionId ? undefined : "Message history requires a session ID.",
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

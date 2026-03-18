import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { INodeDefinition } from "../../../domain/nodes/interfaces/INodeDefinition";
import type { NodePortValueType } from "../../../domain/nodes/interfaces/INodePort";

interface ILangChainNodeCatalogMetadata {
  readonly description: string;
  readonly inputPorts: INodeDefinition["inputPorts"];
  readonly outputPorts: INodeDefinition["outputPorts"];
  readonly properties: INodeDefinition["properties"];
}

function inputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>,
  isOptional = false
): NodePort {
  return new NodePort({
    id,
    name,
    direction: "input",
    compatibility: new NodePortCompatibilityProfile({
      valueTypes,
      isOptional,
    }),
  });
}

function outputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>
): NodePort {
  return new NodePort({
    id,
    name,
    direction: "output",
    compatibility: new NodePortCompatibilityProfile({ valueTypes }),
  });
}

export const LANGCHAIN_NODE_CATALOG_METADATA: Readonly<
  Record<string, ILangChainNodeCatalogMetadata>
> = Object.freeze({
  "langchain.prompt-template": Object.freeze({
    description: "Formats prompt text with template variables and emits a compiled prompt string.",
    inputPorts: Object.freeze([inputPort("template-input", "Template Input", ["text"], true)]),
    outputPorts: Object.freeze([outputPort("prompt", "Prompt", ["text"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "template",
        name: "Template",
        type: "multiline-text",
        value: "",
        constraints: { required: true },
      }),
    ]),
  }),
  "langchain.text-splitter": Object.freeze({
    description: "Splits incoming text into smaller chunks for embedding, retrieval, or prompt context.",
    inputPorts: Object.freeze([inputPort("text", "Text", ["text"])]),
    outputPorts: Object.freeze([outputPort("chunks", "Chunks", ["json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "chunk-size",
        name: "Chunk Size",
        description: "Maximum characters per chunk.",
        type: "integer",
        value: 1000,
        defaultValue: 1000,
        constraints: {
          required: true,
          range: { min: 100, max: 4000, step: 50, defaultValue: 1000 },
        },
      }),
    ]),
  }),
  "langchain.document-to-chunks": Object.freeze({
    description: "Converts a document payload into chunked text segments and document metadata.",
    inputPorts: Object.freeze([inputPort("document", "Document", ["document"])]),
    outputPorts: Object.freeze([outputPort("chunks", "Chunks", ["chunks"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "chunk-size",
        name: "Chunk Size",
        type: "integer",
        value: 1000,
        defaultValue: 1000,
        constraints: {
          required: true,
          range: { min: 100, max: 4000, step: 50, defaultValue: 1000 },
        },
      }),
      new NodeProperty({
        id: "chunk-overlap",
        name: "Chunk Overlap",
        description: "Number of characters shared between adjacent chunks.",
        type: "integer",
        value: 200,
        defaultValue: 200,
        constraints: {
          required: true,
          range: { min: 0, max: 500, step: 25, defaultValue: 200 },
        },
      }),
    ]),
  }),
  "langchain.chat-prompt": Object.freeze({
    description: "Builds a structured chat prompt from system instructions and user content.",
    inputPorts: Object.freeze([
      inputPort("system", "System Message", ["text"], true),
      inputPort("user", "User Message", ["text"]),
      inputPort("context", "Context", ["json"], true),
    ]),
    outputPorts: Object.freeze([outputPort("messages", "Messages", ["messages"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "include-history",
        name: "Include Conversation History",
        type: "boolean",
        value: true,
        defaultValue: true,
      }),
    ]),
  }),
  "langchain.simple-chain": Object.freeze({
    description: "Runs a prompt and context through a simple chain step and emits generated output.",
    inputPorts: Object.freeze([
      inputPort("prompt", "Prompt", ["text", "prompt"]),
      inputPort("context", "Context", ["json", "chunks", "text"], true),
    ]),
    outputPorts: Object.freeze([outputPort("result", "Result", ["text", "json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.7,
        defaultValue: 0.7,
        constraints: {
          range: { min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
        },
      }),
      new NodeProperty({
        id: "max-tokens",
        name: "Max Tokens",
        type: "integer",
        value: 512,
        defaultValue: 512,
        constraints: {
          range: { min: 64, max: 4096, step: 64, defaultValue: 512 },
        },
      }),
    ]),
  }),
  "langchain.output-parser": Object.freeze({
    description: "Parses model output text into structured data for downstream workflow nodes.",
    inputPorts: Object.freeze([inputPort("output", "Model Output", ["text", "json"])]),
    outputPorts: Object.freeze([outputPort("parsed", "Parsed Output", ["json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "format",
        name: "Expected Format",
        type: "select",
        value: "json",
        defaultValue: "json",
        options: [
          { label: "JSON", value: "json" },
          { label: "Text", value: "text" },
        ],
      }),
    ]),
  }),
  "langchain.context-merger": Object.freeze({
    description: "Merges multiple context sources into one structured context payload.",
    inputPorts: Object.freeze([
      inputPort("primary", "Primary Context", ["json", "text", "chunks"]),
      inputPort("secondary", "Secondary Context", ["json", "text", "chunks"], true),
    ]),
    outputPorts: Object.freeze([outputPort("merged", "Merged Context", ["json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "merge-strategy",
        name: "Merge Strategy",
        type: "select",
        value: "json-merge",
        defaultValue: "json-merge",
        options: [
          { label: "JSON Merge", value: "json-merge" },
          { label: "Concatenate Text", value: "concat-text" },
        ],
      }),
    ]),
  }),
  "langchain.embedding-generator": Object.freeze({
    description: "Generates embedding vectors from text or chunks for search and retrieval workflows.",
    inputPorts: Object.freeze([
      inputPort("text", "Text", ["text", "chunks"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("embedding", "Embedding", ["embedding"]),
    ]),
    properties: Object.freeze([
      new NodeProperty({
        id: "dimensions",
        name: "Dimensions",
        description: "Target embedding vector width.",
        type: "integer",
        value: 1536,
        defaultValue: 1536,
        constraints: {
          required: true,
          range: { min: 128, max: 3072, step: 128, defaultValue: 1536 },
        },
      }),
      new NodeProperty({
        id: "normalize-vectors",
        name: "Normalize Vectors",
        type: "boolean",
        value: true,
        defaultValue: true,
      }),
    ]),
  }),
  "langchain.vector-store-upsert": Object.freeze({
    description: "Stores embeddings and metadata into a vector-ready dataset for downstream retrieval steps.",
    inputPorts: Object.freeze([
      inputPort("embedding", "Embedding", ["embedding"]),
      inputPort("metadata", "Metadata", ["json", "chunks"], true),
    ]),
    outputPorts: Object.freeze([
      outputPort("dataset", "Dataset", ["dataset"]),
    ]),
    properties: Object.freeze([
      new NodeProperty({
        id: "namespace",
        name: "Namespace",
        type: "text",
        value: "default",
        defaultValue: "default",
        constraints: { required: true },
      }),
      new NodeProperty({
        id: "batch-size",
        name: "Batch Size",
        description: "How many embedding records to group per write batch.",
        type: "integer",
        value: 100,
        defaultValue: 100,
        constraints: {
          required: true,
          range: { min: 1, max: 512, step: 1, defaultValue: 100 },
        },
      }),
    ]),
  }),
  "langchain.retrieval-query": Object.freeze({
    description: "Queries a vector dataset and emits the top matching chunks for a user question.",
    inputPorts: Object.freeze([
      inputPort("query", "Query", ["text"]),
      inputPort("dataset", "Dataset", ["dataset", "embedding", "chunks"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("matches", "Matches", ["chunks"]),
      outputPort("scores", "Scores", ["json"]),
    ]),
    properties: Object.freeze([
      new NodeProperty({
        id: "top-k",
        name: "Top K",
        type: "integer",
        value: 5,
        defaultValue: 5,
        constraints: {
          required: true,
          range: { min: 1, max: 20, step: 1, defaultValue: 5 },
        },
      }),
      new NodeProperty({
        id: "min-score",
        name: "Minimum Score",
        description: "Filter out weak matches below this normalized score.",
        type: "slider",
        value: 0.2,
        defaultValue: 0.2,
        constraints: {
          range: { min: 0, max: 1, step: 0.05, defaultValue: 0.2 },
        },
      }),
    ]),
  }),
  "langchain.reranker": Object.freeze({
    description: "Re-scores candidate chunks against a query and keeps the most relevant results.",
    inputPorts: Object.freeze([
      inputPort("query", "Query", ["text"]),
      inputPort("candidates", "Candidates", ["chunks", "json"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("reranked", "Reranked", ["chunks"]),
      outputPort("scores", "Scores", ["json"]),
    ]),
    properties: Object.freeze([
      new NodeProperty({
        id: "top-n",
        name: "Top N",
        type: "integer",
        value: 3,
        defaultValue: 3,
        constraints: {
          required: true,
          range: { min: 1, max: 10, step: 1, defaultValue: 3 },
        },
      }),
    ]),
  }),
  "langchain.answer-synthesizer": Object.freeze({
    description: "Combines retrieved context with a user question and returns a composed answer plus citations.",
    inputPorts: Object.freeze([
      inputPort("question", "Question", ["text"]),
      inputPort("context", "Context", ["chunks", "json", "text"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("answer", "Answer", ["text"]),
      outputPort("citations", "Citations", ["json"]),
    ]),
    properties: Object.freeze([
      new NodeProperty({
        id: "response-style",
        name: "Response Style",
        type: "select",
        value: "concise",
        defaultValue: "concise",
        options: [
          { label: "Concise", value: "concise" },
          { label: "Detailed", value: "detailed" },
          { label: "Bulleted", value: "bulleted" },
        ],
      }),
      new NodeProperty({
        id: "max-sources",
        name: "Max Sources",
        type: "integer",
        value: 4,
        defaultValue: 4,
        constraints: {
          required: true,
          range: { min: 1, max: 10, step: 1, defaultValue: 4 },
        },
      }),
      new NodeProperty({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.2,
        defaultValue: 0.2,
        constraints: {
          range: { min: 0, max: 1, step: 0.1, defaultValue: 0.2 },
        },
      }),
    ]),
  }),
});

export function getLangChainNodeCatalogMetadata(
  nodeTypeId: string
): ILangChainNodeCatalogMetadata | undefined {
  return LANGCHAIN_NODE_CATALOG_METADATA[nodeTypeId];
}

import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { INodeDefinition } from "../../../domain/nodes/interfaces/INodeDefinition";
import type { NodePortValueType } from "../../../domain/nodes/interfaces/INodePort";
import type { NodePropertyType, NodePropertyValue } from "../../../domain/nodes/interfaces/INodeProperty";
import { COMBINE_SUMMARIES_NODE_DEFINITION } from "./CombineSummariesNodeDefinition";
import { CONTEXT_FORMATTER_NODE_DEFINITION } from "./ContextFormatterNodeDefinition";
import { SIMILARITY_SEARCH_NODE_DEFINITION } from "./SimilaritySearchNodeDefinition";
import { SUMMARIZATION_NODE_DEFINITION } from "./SummarizationNodeDefinition";
import { VECTOR_STORE_UPSERT_NODE_DEFINITION } from "./VectorStoreUpsertNodeDefinition";

interface ILangChainNodeProjectionMetadata {
  readonly group: string;
  readonly tags: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly supportsAuthoringView: boolean;
  readonly supportsToolView: boolean;
}

export interface ILangChainNodeCatalogMetadata {
  readonly technicalName: string;
  readonly nonTechnicalName: string;
  readonly technicalDescription: string;
  readonly description: string;
  readonly inputPorts: INodeDefinition["inputPorts"];
  readonly outputPorts: INodeDefinition["outputPorts"];
  readonly properties: INodeDefinition["properties"];
  readonly projection: ILangChainNodeProjectionMetadata;
}

function inputPort(
  id: string,
  name: string,
  valueTypes: ReadonlyArray<NodePortValueType>,
  isOptional = false,
  description?: string
): NodePort {
  return new NodePort({
    id,
    name,
    description,
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
  valueTypes: ReadonlyArray<NodePortValueType>,
  description?: string
): NodePort {
  return new NodePort({
    id,
    name,
    description,
    direction: "output",
    compatibility: new NodePortCompatibilityProfile({ valueTypes }),
  });
}

function property<TValue extends NodePropertyValue>(params: {
  id: string;
  name: string;
  type: NodePropertyType;
  value: TValue;
  defaultValue?: TValue;
  description: string;
  required?: boolean;
  isAdvanced?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ReadonlyArray<{ label: string; value: TValue; description?: string }>;
  projectionLabel?: string;
  projectionGroup?: string;
  fieldTypeHint?: string;
  order?: number;
}): NodeProperty<TValue> {
  return new NodeProperty<TValue>({
    id: params.id,
    name: params.name,
    description: params.description,
    type: params.type,
    value: params.value,
    defaultValue: params.defaultValue,
    isAdvanced: params.isAdvanced ?? false,
    order: params.order ?? 0,
    constraints:
      params.required || params.min !== undefined || params.max !== undefined
        ? {
            required: params.required,
            min: params.min,
            max: params.max,
            range:
              params.min !== undefined &&
              params.max !== undefined &&
              typeof params.value === "number"
                ? {
                    min: params.min,
                    max: params.max,
                    step: params.step,
                    defaultValue: Number(params.defaultValue ?? params.value),
                  }
                : undefined,
          }
        : undefined,
    options: params.options,
    projection: {
      label: params.projectionLabel ?? params.name,
      description: params.description,
      group: params.projectionGroup ?? "Configuration",
      order: params.order ?? 0,
      authorVisibility: params.isAdvanced ? "advanced" : "basic",
      toolVisibility: params.isAdvanced ? "advanced" : "basic",
      exposeInAuthorForm: true,
      exposeInTool: true,
      fieldTypeHint: params.fieldTypeHint ?? params.type,
    },
  });
}

function metadata(params: {
  technicalName: string;
  nonTechnicalName: string;
  technicalDescription: string;
  nonTechnicalDescription: string;
  inputPorts: INodeDefinition["inputPorts"];
  outputPorts: INodeDefinition["outputPorts"];
  properties: INodeDefinition["properties"];
  group: string;
  tags: ReadonlyArray<string>;
  keywords: ReadonlyArray<string>;
}): ILangChainNodeCatalogMetadata {
  return Object.freeze({
    technicalName: params.technicalName,
    nonTechnicalName: params.nonTechnicalName,
    technicalDescription: params.technicalDescription,
    description: params.nonTechnicalDescription,
    inputPorts: params.inputPorts,
    outputPorts: params.outputPorts,
    properties: params.properties,
    projection: Object.freeze({
      group: params.group,
      tags: Object.freeze([...params.tags]),
      keywords: Object.freeze([...params.keywords]),
      supportsAuthoringView: true,
      supportsToolView: true,
    }),
  });
}

const tierOneProjectionGroup = "Tier 1 LLM";
const tierTwoProjectionGroup = "Tier 2 LLM";

export const LANGCHAIN_NODE_CATALOG_METADATA: Readonly<
  Record<string, ILangChainNodeCatalogMetadata>
> = Object.freeze({
  "langchain.prompt_template": metadata({
    technicalName: "langchain.prompt_template",
    nonTechnicalName: "Build Prompt",
    technicalDescription:
      "Formats a string template using input variables to produce a final prompt string.",
    nonTechnicalDescription:
      "Turn your inputs into a well-structured prompt for the AI.",
    inputPorts: Object.freeze([
      inputPort(
        "variables",
        "Variables",
        ["json"],
        true,
        "Optional variable values used to fill placeholders in the template."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "prompt",
        "Prompt",
        ["text", "prompt"],
        "The final prompt text after template variables are resolved."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "template",
        name: "Template",
        type: "multiline-text",
        value: "",
        description: "Prompt template text with placeholders such as {topic} or {tone}.",
        required: true,
        projectionLabel: "Prompt template",
        fieldTypeHint: "textarea",
        order: 0,
      }),
      property({
        id: "inputVariables",
        name: "Input Variables",
        type: "multi-select",
        value: [],
        defaultValue: [],
        description:
          "Optional list of variable names the template expects so forms can ask for them explicitly.",
        projectionLabel: "Variables to collect",
        projectionGroup: "Template",
        fieldTypeHint: "token-list",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["prompting", "template", "llm"],
    keywords: ["prompt", "template", "variables", "instructions"],
  }),
  "langchain.chat_prompt": metadata({
    technicalName: "langchain.chat_prompt",
    nonTechnicalName: "Build Chat Input",
    technicalDescription:
      "Constructs structured chat messages from system, user, and context inputs.",
    nonTechnicalDescription:
      "Combine instructions, context, and your input into a message the AI understands.",
    inputPorts: Object.freeze([
      inputPort("system", "System", ["text"], true, "Optional system instructions."),
      inputPort("user", "User", ["text"], false, "The primary user request."),
      inputPort(
        "context",
        "Context",
        ["text", "json", "document"],
        true,
        "Optional supporting context, retrieved passages, or summaries."
      ),
      inputPort(
        "history",
        "History",
        ["messages", "json"],
        true,
        "Optional prior chat messages to include for continuity."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "messages",
        "Messages",
        ["messages", "json"],
        "Structured chat messages ready for a chat model call."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "includeContext",
        name: "Include Context",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Include the context input when building the final message set.",
        projectionLabel: "Use context",
        projectionGroup: "Assembly",
        order: 0,
      }),
      property({
        id: "includeHistory",
        name: "Include History",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Include prior conversation history when available.",
        projectionLabel: "Use conversation history",
        projectionGroup: "Assembly",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["chat", "messages", "prompting"],
    keywords: ["chat", "messages", "system", "user", "history"],
  }),
  "langchain.llm_chat": metadata({
    technicalName: "langchain.llm_chat",
    nonTechnicalName: "Generate AI Response",
    technicalDescription:
      "Invokes a language model using provided messages or prompt.",
    nonTechnicalDescription:
      "Ask the AI to generate a response based on your input.",
    inputPorts: Object.freeze([
      inputPort(
        "messages",
        "Messages",
        ["messages", "json"],
        true,
        "Structured chat messages for chat-style inference."
      ),
      inputPort(
        "prompt",
        "Prompt",
        ["text", "prompt"],
        true,
        "Plain prompt text for text-completion style inference."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort("response", "Response", ["text"], "The generated text response."),
      outputPort(
        "raw",
        "Raw Result",
        ["json"],
        "Optional provider-specific response payload for downstream inspection."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "model",
        name: "Model",
        type: "text",
        value: "",
        description: "The model identifier used for this generation step.",
        required: true,
        projectionLabel: "Model",
        projectionGroup: "Model",
        fieldTypeHint: "model",
        order: 0,
      }),
      property({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.7,
        defaultValue: 0.7,
        description: "Controls how creative or deterministic the response should be.",
        min: 0,
        max: 2,
        step: 0.1,
        projectionGroup: "Generation",
        order: 1,
      }),
      property({
        id: "maxTokens",
        name: "Max Tokens",
        type: "integer",
        value: 512,
        description: "Optional cap on generated output length.",
        min: 1,
        max: 8192,
        step: 1,
        isAdvanced: true,
        projectionGroup: "Generation",
        order: 2,
      }),
      property({
        id: "topP",
        name: "Top P",
        type: "number",
        value: 1,
        description: "Optional nucleus sampling value used by supported models.",
        min: 0,
        max: 1,
        step: 0.05,
        isAdvanced: true,
        projectionGroup: "Generation",
        order: 3,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["generation", "chat-model", "llm"],
    keywords: ["generate", "response", "llm", "chat", "model"],
  }),
  "langchain.text_splitter": metadata({
    technicalName: "langchain.text_splitter",
    nonTechnicalName: "Split Text into Chunks",
    technicalDescription:
      "Splits text into smaller overlapping chunks for embedding or processing.",
    nonTechnicalDescription:
      "Break large text into smaller pieces the AI can understand better.",
    inputPorts: Object.freeze([
      inputPort("text", "Text", ["text"], false, "Large source text to split into chunks."),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "chunks",
        "Chunks",
        ["json", "text"],
        "An ordered list of text chunks suitable for retrieval or downstream processing."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "chunkSize",
        name: "Chunk Size",
        type: "integer",
        value: 500,
        defaultValue: 500,
        description: "Maximum characters per chunk.",
        required: true,
        min: 1,
        max: 4000,
        step: 1,
        projectionGroup: "Splitting",
        order: 0,
      }),
      property({
        id: "chunkOverlap",
        name: "Chunk Overlap",
        type: "integer",
        value: 50,
        defaultValue: 50,
        description: "How many characters adjacent chunks share.",
        required: true,
        min: 0,
        max: 1000,
        step: 1,
        projectionGroup: "Splitting",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["documents", "chunking", "retrieval"],
    keywords: ["split", "chunks", "documents", "text"],
  }),
  "langchain.embeddings": metadata({
    technicalName: "langchain.embeddings",
    nonTechnicalName: "Convert Text to Meaning Vectors",
    technicalDescription:
      "Generates vector embeddings from text using a specified embedding model.",
    nonTechnicalDescription:
      "Convert text into a format that helps the system understand meaning and similarity.",
    inputPorts: Object.freeze([
      inputPort(
        "texts",
        "Texts",
        ["json", "text"],
        false,
        "One or more text items to embed."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "embeddings",
        "Embeddings",
        ["embedding", "json"],
        "Generated vector embeddings aligned with the input texts."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "model",
        name: "Model",
        type: "text",
        value: "",
        description: "Embedding model identifier.",
        required: true,
        projectionLabel: "Embedding model",
        projectionGroup: "Model",
        fieldTypeHint: "model",
        order: 0,
      }),
      property({
        id: "normalize",
        name: "Normalize",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Normalize output vectors when supported.",
        projectionLabel: "Normalize vectors",
        projectionGroup: "Model",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["embeddings", "vectors", "retrieval"],
    keywords: ["embed", "vectors", "meaning", "similarity"],
  }),
  "langchain.retriever": metadata({
    technicalName: "langchain.retriever",
    nonTechnicalName: "Find Relevant Information",
    technicalDescription:
      "Retrieves relevant documents based on semantic similarity.",
    nonTechnicalDescription:
      "Find the most relevant pieces of information for your question.",
    inputPorts: Object.freeze([
      inputPort("query", "Query", ["text"], false, "Search query or user question."),
      inputPort(
        "embeddings",
        "Embeddings",
        ["embedding", "json"],
        true,
        "Optional query embeddings or precomputed vector payloads."
      ),
      inputPort(
        "vectorStore",
        "Vector Store",
        ["dataset", "json"],
        false,
        "Vector store or retrieval-ready dataset to search."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "documents",
        "Documents",
        ["document", "json"],
        "Ranked documents retrieved from the vector store."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "topK",
        name: "Top K",
        type: "integer",
        value: 5,
        defaultValue: 5,
        description: "How many matching documents to return.",
        required: true,
        min: 1,
        max: 50,
        step: 1,
        projectionGroup: "Retrieval",
        order: 0,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["retrieval", "search", "rag"],
    keywords: ["retrieve", "search", "documents", "similarity"],
  }),
  "langchain.reranker": metadata({
    technicalName: "langchain.reranker",
    nonTechnicalName: "Improve Search Results",
    technicalDescription:
      "Reorders retrieved documents using a reranking model.",
    nonTechnicalDescription:
      "Sort results so the most useful ones appear first.",
    inputPorts: Object.freeze([
      inputPort("query", "Query", ["text"], false, "Query used to rerank results."),
      inputPort(
        "documents",
        "Documents",
        ["document", "json"],
        false,
        "Documents to reorder using a reranking model."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "documents",
        "Documents",
        ["document", "json"],
        "Documents reordered so the best matches appear first."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "model",
        name: "Model",
        type: "text",
        value: "",
        description: "Reranking model identifier.",
        required: true,
        projectionLabel: "Reranker model",
        projectionGroup: "Model",
        fieldTypeHint: "model",
        order: 0,
      }),
      property({
        id: "topK",
        name: "Top K",
        type: "integer",
        value: 5,
        description: "Optional limit for how many reranked results to keep.",
        min: 1,
        max: 50,
        step: 1,
        isAdvanced: true,
        projectionGroup: "Ranking",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["retrieval", "ranking", "rag"],
    keywords: ["rerank", "results", "search", "relevance"],
  }),
  "langchain.output_parser": metadata({
    technicalName: "langchain.output_parser",
    nonTechnicalName: "Format AI Output",
    technicalDescription:
      "Parses LLM output into structured data such as JSON, schema-aligned objects, or cleaned text.",
    nonTechnicalDescription:
      "Turn AI output into clean, structured, or easier-to-use results.",
    inputPorts: Object.freeze([
      inputPort("text", "Text", ["text", "json"], false, "Model output text to parse."),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "parsed",
        "Parsed Output",
        ["json", "text", "generic"],
        "Parsed output ready for downstream workflow nodes."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "format",
        name: "Format",
        type: "select",
        value: "json",
        defaultValue: "json",
        description: "Target output format expected from the parser.",
        options: [
          { label: "JSON", value: "json", description: "Parse structured JSON output." },
          { label: "Text", value: "text", description: "Return cleaned plain text." },
          { label: "Custom", value: "custom", description: "Apply a custom parsing strategy." },
        ],
        projectionGroup: "Parsing",
        order: 0,
      }),
      property({
        id: "schema",
        name: "Schema",
        type: "json",
        value: {},
        description: "Optional schema or shape guidance for structured parsing.",
        isAdvanced: true,
        projectionGroup: "Parsing",
        fieldTypeHint: "json-editor",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["parsing", "output", "formatting"],
    keywords: ["parse", "json", "output", "schema"],
  }),
  "langchain.memory": metadata({
    technicalName: "langchain.memory",
    nonTechnicalName: "Remember Conversation",
    technicalDescription:
      "Stores and retrieves chat history for conversational continuity.",
    nonTechnicalDescription:
      "Let the AI remember past messages in a conversation.",
    inputPorts: Object.freeze([
      inputPort(
        "messages",
        "Messages",
        ["messages", "json"],
        false,
        "New chat messages to append to history."
      ),
      inputPort(
        "sessionId",
        "Session ID",
        ["text"],
        false,
        "Conversation session identifier used to scope memory."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "history",
        "History",
        ["messages", "json"],
        "Conversation history returned after the latest messages are stored."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "maxMessages",
        name: "Max Messages",
        type: "integer",
        value: 10,
        defaultValue: 10,
        description: "Maximum number of messages to keep in memory.",
        required: true,
        min: 1,
        max: 100,
        step: 1,
        projectionGroup: "Memory",
        order: 0,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["memory", "chat", "history"],
    keywords: ["remember", "conversation", "history", "session"],
  }),
  "langchain.document_loader": metadata({
    technicalName: "langchain.document_loader",
    nonTechnicalName: "Load Document",
    technicalDescription:
      "Loads raw documents from file, text, or URL into structured document objects.",
    nonTechnicalDescription:
      "Bring in documents so the AI can read and use them.",
    inputPorts: Object.freeze([
      inputPort(
        "source",
        "Source",
        ["text"],
        false,
        "The raw text, file path, or URL to load into documents."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "documents",
        "Documents",
        ["document", "json"],
        "Structured documents loaded from the provided source."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "type",
        name: "Type",
        type: "select",
        value: "text",
        defaultValue: "text",
        description: "Where the source string should be interpreted from.",
        options: [
          { label: "Text", value: "text", description: "Treat the source as plain text." },
          { label: "File", value: "file", description: "Treat the source as a file path." },
          { label: "URL", value: "url", description: "Treat the source as a URL." },
        ],
        projectionLabel: "Source type",
        projectionGroup: "Source",
        order: 0,
      }),
      property({
        id: "encoding",
        name: "Encoding",
        type: "text",
        value: "utf-8",
        description: "Optional text encoding to use when reading file-based sources.",
        isAdvanced: true,
        projectionGroup: "Source",
        order: 1,
      }),
    ]),
    group: tierOneProjectionGroup,
    tags: ["documents", "loading", "ingestion"],
    keywords: ["load", "documents", "file", "url", "text"],
  }),
  "langchain.document_to_chunks": metadata({
    technicalName: "langchain.document_to_chunks",
    nonTechnicalName: "Prepare Document Chunks",
    technicalDescription:
      "Converts document objects into chunked document objects, preserving metadata where practical.",
    nonTechnicalDescription:
      "Break documents into smaller AI-ready pieces while keeping useful document details attached.",
    inputPorts: Object.freeze([
      inputPort(
        "documents",
        "Documents",
        ["document", "json"],
        false,
        "Structured documents to split into smaller document chunks."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "chunks",
        "Chunks",
        ["document", "json"],
        "Chunked document records that remain compatible with retrieval and summarization nodes."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "chunkSize",
        name: "Chunk Size",
        type: "integer",
        value: 500,
        defaultValue: 500,
        description: "Maximum characters or tokens targeted per chunked document.",
        required: true,
        min: 1,
        max: 4000,
        step: 1,
        projectionGroup: "Chunking",
        order: 0,
      }),
      property({
        id: "chunkOverlap",
        name: "Chunk Overlap",
        type: "integer",
        value: 50,
        defaultValue: 50,
        description: "How much neighboring content to repeat across chunk boundaries.",
        required: true,
        min: 0,
        max: 1000,
        step: 1,
        projectionGroup: "Chunking",
        order: 1,
      }),
      property({
        id: "preserveMetadata",
        name: "Preserve Metadata",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Carry document metadata forward onto each generated chunk when practical.",
        projectionLabel: "Keep document details",
        projectionGroup: "Chunking",
        order: 2,
      }),
    ]),
    group: tierTwoProjectionGroup,
    tags: ["documents", "chunking", "rag"],
    keywords: ["document chunks", "split documents", "metadata preservation"],
  }),
  "langchain.vector_store_upsert": VECTOR_STORE_UPSERT_NODE_DEFINITION,
  "langchain.similarity_search": SIMILARITY_SEARCH_NODE_DEFINITION,
  "langchain.context_formatter": CONTEXT_FORMATTER_NODE_DEFINITION,
  "langchain.tool_definition": metadata({
    technicalName: "langchain.tool_definition",
    nonTechnicalName: "Create AI Tool",
    technicalDescription:
      "Defines a callable tool with name, description, and input schema that can be supplied to an agent or tool-calling model.",
    nonTechnicalDescription:
      "Describe a tool the AI is allowed to use.",
    inputPorts: Object.freeze([
      inputPort(
        "inputSchema",
        "Input Schema",
        ["json", "generic"],
        true,
        "Optional schema object describing the arguments accepted by the tool."
      ),
      inputPort(
        "toolHandler",
        "Tool Handler",
        ["generic", "json"],
        true,
        "Optional runtime handler reference or implementation payload for the tool."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "tool",
        "Tool",
        ["generic", "json"],
        "A tool definition object that can be supplied to an agent or executor node."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "toolName",
        name: "Tool Name",
        type: "text",
        value: "",
        description: "Stable tool identifier exposed to the model.",
        required: true,
        projectionGroup: "Definition",
        order: 0,
      }),
      property({
        id: "description",
        name: "Description",
        type: "multiline-text",
        value: "",
        description: "Clear instruction telling the model what the tool does and when to use it.",
        required: true,
        projectionLabel: "Tool description",
        projectionGroup: "Definition",
        fieldTypeHint: "textarea",
        order: 1,
      }),
      property({
        id: "strictSchema",
        name: "Strict Schema",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Require tool calls to match the provided schema closely when the runtime supports it.",
        projectionGroup: "Definition",
        order: 2,
      }),
    ]),
    group: tierTwoProjectionGroup,
    tags: ["tools", "agent", "function calling"],
    keywords: ["tool definition", "tool schema", "callable tool"],
  }),
  "langchain.tool_call_executor": metadata({
    technicalName: "langchain.tool_call_executor",
    nonTechnicalName: "Run AI Tool",
    technicalDescription:
      "Executes a requested tool call using the provided tool definition and arguments.",
    nonTechnicalDescription:
      "Run a tool the AI selected and return the result.",
    inputPorts: Object.freeze([
      inputPort(
        "tool",
        "Tool",
        ["generic", "json"],
        false,
        "The tool definition or callable tool payload to execute."
      ),
      inputPort(
        "arguments",
        "Arguments",
        ["json", "generic"],
        false,
        "Structured arguments to pass into the selected tool."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "toolResult",
        "Tool Result",
        ["tool-result", "json", "generic"],
        "Structured result returned by the executed tool."
      ),
      outputPort(
        "resultText",
        "Result Text",
        ["text"],
        "Optional text form of the tool result for prompt assembly or display."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "failOnMissingArgs",
        name: "Fail On Missing Arguments",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Stop execution when required arguments are missing or the arguments payload is empty.",
        projectionGroup: "Execution",
        order: 0,
      }),
      property({
        id: "stringifyResult",
        name: "Stringify Result",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Also expose a text version of the tool result for downstream prompt-oriented nodes.",
        projectionGroup: "Execution",
        order: 1,
      }),
    ]),
    group: tierTwoProjectionGroup,
    tags: ["tools", "execution", "agent"],
    keywords: ["tool execution", "run tool", "tool result"],
  }),
  "langchain.agent": metadata({
    technicalName: "langchain.agent",
    nonTechnicalName: "AI Agent",
    technicalDescription:
      "Uses an LLM with tools and optional memory to reason over input and produce a response.",
    nonTechnicalDescription:
      "Give the AI tools and memory so it can solve more complex tasks.",
    inputPorts: Object.freeze([
      inputPort(
        "messages",
        "Messages",
        ["messages", "json"],
        true,
        "Optional structured chat messages to seed the agent turn."
      ),
      inputPort(
        "input",
        "Input",
        ["text"],
        true,
        "Optional plain text task or instruction for the agent."
      ),
      inputPort(
        "tools",
        "Tools",
        ["generic", "json"],
        true,
        "Optional tool definition list available to the agent."
      ),
      inputPort(
        "history",
        "History",
        ["messages", "json"],
        true,
        "Optional prior conversation history to provide memory or continuity."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort("response", "Response", ["text"], "The agent's final natural-language response."),
      outputPort(
        "messages",
        "Messages",
        ["messages", "json"],
        "Optional message trace produced by the bounded agent execution."
      ),
      outputPort(
        "toolCalls",
        "Tool Calls",
        ["tool-call", "json"],
        "Optional structured tool calls proposed or used by the agent."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "model",
        name: "Model",
        type: "text",
        value: "",
        description: "The model identifier used for agent reasoning and response generation.",
        required: true,
        projectionGroup: "Model",
        fieldTypeHint: "model",
        order: 0,
      }),
      property({
        id: "systemPrompt",
        name: "System Prompt",
        type: "multiline-text",
        value: "",
        description: "Optional agent instructions describing behavior, role, and constraints.",
        projectionGroup: "Behavior",
        fieldTypeHint: "textarea",
        order: 1,
      }),
      property({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.7,
        defaultValue: 0.7,
        description: "Controls how exploratory or deterministic the agent should be.",
        min: 0,
        max: 2,
        step: 0.1,
        projectionGroup: "Behavior",
        order: 2,
      }),
      property({
        id: "maxIterations",
        name: "Max Iterations",
        type: "integer",
        value: 5,
        defaultValue: 5,
        description: "Upper bound on the number of internal reasoning or tool-use iterations.",
        required: true,
        min: 1,
        max: 20,
        step: 1,
        projectionGroup: "Behavior",
        order: 3,
      }),
      property({
        id: "useMemory",
        name: "Use Memory",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Include the history input in the bounded agent run when it is available.",
        projectionGroup: "Behavior",
        order: 4,
      }),
      property({
        id: "verbose",
        name: "Verbose",
        type: "boolean",
        value: false,
        defaultValue: false,
        description: "Expose extra execution detail in the agent trace payload when supported.",
        isAdvanced: true,
        projectionGroup: "Behavior",
        order: 5,
      }),
    ]),
    group: tierTwoProjectionGroup,
    tags: ["agent", "tools", "memory"],
    keywords: ["agent", "tool use", "reasoning", "multi-step ai"],
  }),
  "langchain.summarization": SUMMARIZATION_NODE_DEFINITION,
  "langchain.combine_summaries": COMBINE_SUMMARIES_NODE_DEFINITION,
  "langchain.knowledge_base_retriever": metadata({
    technicalName: "langchain.knowledge_base_retriever",
    nonTechnicalName: "Search Knowledge Base",
    technicalDescription:
      "Retrieves relevant entries from an existing knowledge base or managed semantic store.",
    nonTechnicalDescription:
      "Search your saved knowledge for the most useful information.",
    inputPorts: Object.freeze([
      inputPort(
        "query",
        "Query",
        ["text"],
        false,
        "The search question or prompt used to retrieve knowledge base entries."
      ),
      inputPort(
        "knowledgeBase",
        "Knowledge Base",
        ["dataset", "json", "generic"],
        false,
        "Managed knowledge base connection or semantic store handle."
      ),
    ]),
    outputPorts: Object.freeze([
      outputPort(
        "documents",
        "Documents",
        ["document", "json"],
        "Relevant knowledge base entries returned as structured documents."
      ),
    ]),
    properties: Object.freeze([
      property({
        id: "topK",
        name: "Top K",
        type: "integer",
        value: 5,
        defaultValue: 5,
        description: "How many knowledge base results to return.",
        required: true,
        min: 1,
        max: 50,
        step: 1,
        projectionGroup: "Retrieval",
        order: 0,
      }),
      property({
        id: "scoreThreshold",
        name: "Score Threshold",
        type: "number",
        value: 0,
        description: "Optional minimum retrieval score required for a result to be included.",
        min: 0,
        max: 1,
        step: 0.01,
        isAdvanced: true,
        projectionGroup: "Retrieval",
        order: 1,
      }),
    ]),
    group: tierTwoProjectionGroup,
    tags: ["knowledge base", "retrieval", "rag"],
    keywords: ["knowledge base", "search knowledge", "managed retriever"],
  }),

  "langchain.prompt-template": metadata({
    technicalName: "langchain.prompt-template",
    nonTechnicalName: "Build Prompt",
    technicalDescription:
      "Legacy alias for prompt template formatting kept for backward compatibility.",
    nonTechnicalDescription:
      "Build a reusable AI prompt from your inputs.",
    inputPorts: Object.freeze([
      inputPort("template-input", "Variables", ["json", "text"], true, "Template values or freeform text."),
    ]),
    outputPorts: Object.freeze([
      outputPort("prompt", "Prompt", ["text", "prompt"], "Compiled prompt text."),
    ]),
    properties: Object.freeze([
      property({
        id: "template",
        name: "Template",
        type: "multiline-text",
        value: "",
        description: "Prompt template text.",
        required: true,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "prompting"],
    keywords: ["prompt-template"],
  }),
  "langchain.text-splitter": metadata({
    technicalName: "langchain.text-splitter",
    nonTechnicalName: "Split Text into Chunks",
    technicalDescription: "Legacy alias for text splitting kept for existing workflows.",
    nonTechnicalDescription: "Break text into smaller pieces.",
    inputPorts: Object.freeze([
      inputPort("text", "Text", ["text"], false, "Text to split into chunks."),
    ]),
    outputPorts: Object.freeze([
      outputPort("chunks", "Chunks", ["json", "text"], "Chunked text output."),
    ]),
    properties: Object.freeze([
      property({
        id: "chunk-size",
        name: "Chunk Size",
        type: "integer",
        value: 1000,
        defaultValue: 1000,
        description: "Maximum characters per chunk.",
        required: true,
        min: 100,
        max: 4000,
        step: 50,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "chunking"],
    keywords: ["text-splitter"],
  }),
  "langchain.document-to-chunks": metadata({
    technicalName: "langchain.document-to-chunks",
    nonTechnicalName: "Chunk Document",
    technicalDescription: "Legacy document chunker kept for existing sample workflows.",
    nonTechnicalDescription: "Split a loaded document into chunk records.",
    inputPorts: Object.freeze([
      inputPort("document", "Document", ["document"], false, "Loaded document payload."),
    ]),
    outputPorts: Object.freeze([
      outputPort("chunks", "Chunks", ["chunks", "json"], "Document chunks."),
    ]),
    properties: Object.freeze([
      property({
        id: "chunk-size",
        name: "Chunk Size",
        type: "integer",
        value: 1000,
        defaultValue: 1000,
        description: "Maximum characters per chunk.",
        required: true,
        min: 100,
        max: 4000,
        step: 50,
      }),
      property({
        id: "chunk-overlap",
        name: "Chunk Overlap",
        type: "integer",
        value: 200,
        defaultValue: 200,
        description: "Characters shared between chunks.",
        required: true,
        min: 0,
        max: 500,
        step: 25,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "documents"],
    keywords: ["document-to-chunks"],
  }),
  "langchain.chat-prompt": metadata({
    technicalName: "langchain.chat-prompt",
    nonTechnicalName: "Build Chat Prompt",
    technicalDescription: "Legacy chat prompt alias kept for existing workflows.",
    nonTechnicalDescription: "Assemble a chat-ready message payload.",
    inputPorts: Object.freeze([
      inputPort("system", "System Message", ["text"], true),
      inputPort("user", "User Message", ["text"]),
      inputPort("context", "Context", ["json", "text"], true),
    ]),
    outputPorts: Object.freeze([
      outputPort("messages", "Messages", ["messages", "json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "include-history",
        name: "Include Conversation History",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Include prior messages when available.",
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "chat"],
    keywords: ["chat-prompt"],
  }),
  "langchain.simple-chain": metadata({
    technicalName: "langchain.simple-chain",
    nonTechnicalName: "Run Simple Chain",
    technicalDescription: "Legacy simple chain node kept for sample prompt workflows.",
    nonTechnicalDescription: "Run a lightweight prompt transformation step.",
    inputPorts: Object.freeze([
      inputPort("prompt", "Prompt", ["text", "prompt"]),
      inputPort("context", "Context", ["json", "chunks", "text"], true),
    ]),
    outputPorts: Object.freeze([
      outputPort("result", "Result", ["text", "json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.7,
        defaultValue: 0.7,
        description: "Sampling temperature.",
        min: 0,
        max: 2,
        step: 0.1,
      }),
      property({
        id: "max-tokens",
        name: "Max Tokens",
        type: "integer",
        value: 512,
        defaultValue: 512,
        description: "Maximum generated tokens.",
        min: 64,
        max: 4096,
        step: 64,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "generation"],
    keywords: ["simple-chain"],
  }),
  "langchain.output-parser": metadata({
    technicalName: "langchain.output-parser",
    nonTechnicalName: "Format Output",
    technicalDescription: "Legacy output parser alias kept for existing workflows.",
    nonTechnicalDescription: "Convert generated output into a structured result.",
    inputPorts: Object.freeze([
      inputPort("output", "Model Output", ["text", "json"], false),
    ]),
    outputPorts: Object.freeze([
      outputPort("parsed", "Parsed Output", ["json", "text"]),
    ]),
    properties: Object.freeze([
      property({
        id: "format",
        name: "Expected Format",
        type: "select",
        value: "json",
        defaultValue: "json",
        description: "Parsing format.",
        options: [
          { label: "JSON", value: "json" },
          { label: "Text", value: "text" },
        ],
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "parsing"],
    keywords: ["output-parser"],
  }),
  "langchain.context-merger": metadata({
    technicalName: "langchain.context-merger",
    nonTechnicalName: "Merge Context",
    technicalDescription: "Legacy context merger kept for existing sample workflows.",
    nonTechnicalDescription: "Combine multiple context sources into one payload.",
    inputPorts: Object.freeze([
      inputPort("primary", "Primary Context", ["json", "text", "chunks"]),
      inputPort("secondary", "Secondary Context", ["json", "text", "chunks"], true),
    ]),
    outputPorts: Object.freeze([
      outputPort("merged", "Merged Context", ["json", "text"]),
    ]),
    properties: Object.freeze([
      property({
        id: "merge-strategy",
        name: "Merge Strategy",
        type: "select",
        value: "json-merge",
        defaultValue: "json-merge",
        description: "How to merge the incoming context values.",
        options: [
          { label: "JSON Merge", value: "json-merge" },
          { label: "Concatenate Text", value: "concat-text" },
        ],
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "context"],
    keywords: ["context-merger"],
  }),
  "langchain.embedding-generator": metadata({
    technicalName: "langchain.embedding-generator",
    nonTechnicalName: "Generate Embeddings",
    technicalDescription: "Legacy embedding generator kept for existing retrieval workflows.",
    nonTechnicalDescription: "Create embedding vectors from text or chunks.",
    inputPorts: Object.freeze([
      inputPort("text", "Text", ["text", "chunks"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("embedding", "Embedding", ["embedding", "json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "dimensions",
        name: "Dimensions",
        type: "integer",
        value: 1536,
        defaultValue: 1536,
        description: "Target embedding vector width.",
        required: true,
        min: 128,
        max: 3072,
        step: 128,
      }),
      property({
        id: "normalize-vectors",
        name: "Normalize Vectors",
        type: "boolean",
        value: true,
        defaultValue: true,
        description: "Normalize generated vectors.",
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "embeddings"],
    keywords: ["embedding-generator"],
  }),
  "langchain.vector-store-upsert": metadata({
    technicalName: "langchain.vector-store-upsert",
    nonTechnicalName: "Prepare Vector Store Records",
    technicalDescription: "Legacy vector store upsert node kept for retrieval workflows.",
    nonTechnicalDescription: "Store embeddings and metadata for later retrieval.",
    inputPorts: Object.freeze([
      inputPort("embedding", "Embedding", ["embedding", "json"]),
      inputPort("metadata", "Metadata", ["json", "chunks"], true),
    ]),
    outputPorts: Object.freeze([
      outputPort("dataset", "Dataset", ["dataset", "json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "namespace",
        name: "Namespace",
        type: "text",
        value: "default",
        defaultValue: "default",
        description: "Dataset namespace.",
        required: true,
      }),
      property({
        id: "batch-size",
        name: "Batch Size",
        type: "integer",
        value: 100,
        defaultValue: 100,
        description: "Records grouped per batch.",
        required: true,
        min: 1,
        max: 512,
        step: 1,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "vector-store"],
    keywords: ["vector-store-upsert"],
  }),
  "langchain.retrieval-query": metadata({
    technicalName: "langchain.retrieval-query",
    nonTechnicalName: "Retrieve Matches",
    technicalDescription: "Legacy retriever node kept for existing sample workflows.",
    nonTechnicalDescription: "Find the best matching chunks for a query.",
    inputPorts: Object.freeze([
      inputPort("query", "Query", ["text"]),
      inputPort("dataset", "Dataset", ["dataset", "embedding", "chunks"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("matches", "Matches", ["chunks", "json"]),
      outputPort("scores", "Scores", ["json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "top-k",
        name: "Top K",
        type: "integer",
        value: 5,
        defaultValue: 5,
        description: "How many matches to keep.",
        required: true,
        min: 1,
        max: 20,
        step: 1,
      }),
      property({
        id: "min-score",
        name: "Minimum Score",
        type: "slider",
        value: 0.2,
        defaultValue: 0.2,
        description: "Minimum normalized score.",
        min: 0,
        max: 1,
        step: 0.05,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "retrieval"],
    keywords: ["retrieval-query"],
  }),
  "langchain.answer-synthesizer": metadata({
    technicalName: "langchain.answer-synthesizer",
    nonTechnicalName: "Synthesize Answer",
    technicalDescription: "Legacy answer synthesizer kept for retrieval-answering workflows.",
    nonTechnicalDescription: "Combine question and context into an answer.",
    inputPorts: Object.freeze([
      inputPort("question", "Question", ["text"]),
      inputPort("context", "Context", ["chunks", "json", "text"]),
    ]),
    outputPorts: Object.freeze([
      outputPort("answer", "Answer", ["text"]),
      outputPort("citations", "Citations", ["json"]),
    ]),
    properties: Object.freeze([
      property({
        id: "response-style",
        name: "Response Style",
        type: "select",
        value: "concise",
        defaultValue: "concise",
        description: "Answer formatting style.",
        options: [
          { label: "Concise", value: "concise" },
          { label: "Detailed", value: "detailed" },
          { label: "Bulleted", value: "bulleted" },
        ],
      }),
      property({
        id: "max-sources",
        name: "Max Sources",
        type: "integer",
        value: 4,
        defaultValue: 4,
        description: "Maximum cited sources.",
        required: true,
        min: 1,
        max: 10,
        step: 1,
      }),
      property({
        id: "temperature",
        name: "Temperature",
        type: "slider",
        value: 0.2,
        defaultValue: 0.2,
        description: "Sampling temperature.",
        min: 0,
        max: 1,
        step: 0.1,
      }),
    ]),
    group: "Legacy LangChain",
    tags: ["legacy", "answering"],
    keywords: ["answer-synthesizer"],
  }),
});

export function getLangChainNodeCatalogMetadata(
  nodeTypeId: string
): ILangChainNodeCatalogMetadata | undefined {
  return LANGCHAIN_NODE_CATALOG_METADATA[nodeTypeId];
}

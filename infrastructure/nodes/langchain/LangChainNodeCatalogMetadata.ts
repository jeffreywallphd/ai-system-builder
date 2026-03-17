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
        value: 500,
        constraints: { required: true, min: 1 },
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
        value: 500,
        constraints: { required: true, min: 1 },
      }),
      new NodeProperty({
        id: "chunk-overlap",
        name: "Chunk Overlap",
        description: "Number of characters shared between adjacent chunks.",
        type: "integer",
        value: 50,
        constraints: { required: true, min: 0 },
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
    outputPorts: Object.freeze([outputPort("messages", "Messages", ["json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "include-history",
        name: "Include Conversation History",
        type: "boolean",
        value: true,
      }),
    ]),
  }),
  "langchain.simple-chain": Object.freeze({
    description: "Runs a prompt and context through a simple chain step and emits generated output.",
    inputPorts: Object.freeze([
      inputPort("prompt", "Prompt", ["text"]),
      inputPort("context", "Context", ["json"], true),
    ]),
    outputPorts: Object.freeze([outputPort("result", "Result", ["text", "json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "temperature",
        name: "Temperature",
        type: "number",
        value: 0.7,
        constraints: { min: 0, max: 2 },
      }),
      new NodeProperty({
        id: "max-tokens",
        name: "Max Tokens",
        type: "integer",
        value: 512,
        constraints: { min: 1 },
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
      inputPort("primary", "Primary Context", ["json", "text"]),
      inputPort("secondary", "Secondary Context", ["json", "text"], true),
    ]),
    outputPorts: Object.freeze([outputPort("merged", "Merged Context", ["json"])]),
    properties: Object.freeze([
      new NodeProperty({
        id: "merge-strategy",
        name: "Merge Strategy",
        type: "select",
        value: "json-merge",
        options: [
          { label: "JSON Merge", value: "json-merge" },
          { label: "Concatenate Text", value: "concat-text" },
        ],
      }),
    ]),
  }),
});

export function getLangChainNodeCatalogMetadata(
  nodeTypeId: string
): ILangChainNodeCatalogMetadata | undefined {
  return LANGCHAIN_NODE_CATALOG_METADATA[nodeTypeId];
}

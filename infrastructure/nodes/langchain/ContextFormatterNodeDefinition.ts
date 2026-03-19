import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["context", "documents", "prompting"]),
  keywords: Object.freeze(["prepare context", "format documents", "rag context"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const CONTEXT_FORMATTER_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.context_formatter",
  nonTechnicalName: "Prepare Context",
  technicalDescription:
    "Formats retrieved documents into a prompt-ready context string using a reusable template.",
  description:
    "Turn retrieved documents into a clean context block that another AI step can use.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "documents",
      name: "Documents",
      description: "Documents that should be rendered into a single context string.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["document"] }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "context",
      name: "Context",
      description: "The formatted context string.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "template",
      name: "Template",
      description: "Template used for each document. Supports {index}, {content}, and {metadata}.",
      type: "multiline-text",
      value: "[{index}] {content}",
      defaultValue: "[{index}] {content}",
      constraints: { required: true },
      projection: {
        label: "Template",
        description: "Template used for each document. Supports {index}, {content}, and {metadata}.",
        group: "Formatting",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "textarea",
      },
      order: 0,
    }),
    new NodeProperty({
      id: "maxLength",
      name: "Max Length",
      description: "Maximum number of characters to keep in the final context output.",
      type: "integer",
      value: 2000,
      defaultValue: 2000,
      constraints: {
        required: true,
        min: 1,
        max: 20000,
        range: { min: 1, max: 20000, step: 1, defaultValue: 2000, clamp: true },
      },
      projection: {
        label: "Max length",
        description: "Maximum number of characters to keep in the final context output.",
        group: "Formatting",
        order: 1,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "integer",
      },
      order: 1,
    }),
  ]),
  projection,
});

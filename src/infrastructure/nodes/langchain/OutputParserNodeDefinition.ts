import { NodePort, NodePortCompatibilityProfile } from "@domain/nodes/NodePort";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["parsing", "structured output", "schema"]),
  keywords: Object.freeze(["structured data", "json parser", "schema extraction", "output parser"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const OUTPUT_PARSER_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.output_parser",
  nonTechnicalName: "Extract Structured Data",
  technicalDescription:
    "Parses model output into structured workflow data using JSON extraction, schema guidance, and light validation metadata.",
  description:
    "Turn raw AI text into structured fields that later workflow nodes can use reliably.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "text",
      name: "Text",
      description: "Model output text or serialized content that should be parsed into structured data.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text", "json"] }),
    }),
    new NodePort({
      id: "schema",
      name: "Schema",
      description: "Optional schema payload that overrides or complements the configured parser schema.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["json", "generic"], isOptional: true }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "parsed",
      name: "Parsed Data",
      description: "Structured output extracted from the incoming text.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["json", "text", "generic"] }),
    }),
    new NodePort({
      id: "parseReport",
      name: "Parse Report",
      description: "Parsing metadata including the mode used, whether parsing succeeded cleanly, and any selected fields.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["json", "workflow-state"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "format",
      name: "Format",
      description: "Structured output mode to apply when parsing the incoming text.",
      type: "select",
      value: "json",
      defaultValue: "json",
      options: [
        { label: "JSON object", value: "json", description: "Parse the text as JSON, with a safe fallback object when parsing fails." },
        { label: "JSON with schema", value: "json_schema", description: "Parse JSON and report requested schema fields for downstream validation." },
        { label: "Key-value lines", value: "key_value", description: "Parse lines like key: value into a structured object." },
        { label: "Plain text", value: "text", description: "Return cleaned text without additional structure." },
      ],
      constraints: { required: true, allowedValues: ["json", "json_schema", "key_value", "text"] },
      projection: {
        label: "Extraction mode",
        description: "Structured output mode to apply when parsing the incoming text.",
        group: "Parsing",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      order: 0,
    }),
    new NodeProperty({
      id: "schema",
      name: "Schema",
      description: "Optional JSON schema or field definition used to document and lightly validate the expected structured output.",
      type: "json",
      value: {
        type: "object",
        properties: {},
        required: [],
      },
      defaultValue: {
        type: "object",
        properties: {},
        required: [],
      },
      projection: {
        label: "Expected schema",
        description: "Optional JSON schema or field definition used to document and lightly validate the expected structured output.",
        group: "Parsing",
        order: 1,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "json-editor",
      },
      order: 1,
    }),
    new NodeProperty({
      id: "trimCodeFence",
      name: "Trim Code Fence",
      description: "Remove surrounding markdown code fences before parsing.",
      type: "boolean",
      value: true,
      defaultValue: true,
      projection: {
        label: "Trim markdown fences",
        description: "Remove surrounding markdown code fences before parsing.",
        group: "Parsing",
        order: 2,
        authorVisibility: "basic",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "boolean",
      },
      order: 2,
    }),
    new NodeProperty({
      id: "coerceNumbers",
      name: "Coerce Numbers",
      description: "Convert numeric-looking string values into numbers when using key-value parsing.",
      type: "boolean",
      value: true,
      defaultValue: true,
      projection: {
        label: "Convert number strings",
        description: "Convert numeric-looking string values into numbers when using key-value parsing.",
        group: "Parsing",
        order: 3,
        authorVisibility: "advanced",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "boolean",
      },
      isAdvanced: true,
      order: 3,
    }),
  ]),
  projection,
});


import { NodePort, NodePortCompatibilityProfile } from "@domain/nodes/NodePort";
import { NodeProperty } from "@domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["summary", "documents", "llm"]),
  keywords: Object.freeze(["summarize", "document summary", "map reduce", "refine"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const SUMMARIZATION_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.summarization",
  nonTechnicalName: "Summarize Text",
  technicalDescription:
    "Runs a summarization chain over documents with an LLM using stuff, map-reduce, or refine strategies.",
  description:
    "Ask an AI model to summarize one or more documents into a shorter explanation.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "documents",
      name: "Documents",
      description: "Documents that should be summarized.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["document"] }),
    }),
    new NodePort({
      id: "model",
      name: "Model",
      description: "The language model used for summarization.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["model", "model-reference", "generic"] }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "summary",
      name: "Summary",
      description: "The generated summary text.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "strategy",
      name: "Strategy",
      description: "How the summarization chain should combine document content.",
      type: "select",
      value: "stuff",
      defaultValue: "stuff",
      options: [
        { label: "Stuff", value: "stuff", description: "Send the documents together in one summarization call." },
        { label: "Map Reduce", value: "map_reduce", description: "Summarize documents individually, then combine the results." },
        { label: "Refine", value: "refine", description: "Iteratively refine the summary as each document is processed." },
      ],
      constraints: { required: true, allowedValues: ["stuff", "map_reduce", "refine"] },
      projection: {
        label: "Strategy",
        description: "How the summarization chain should combine document content.",
        group: "Summary",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      order: 0,
    }),
  ]),
  projection,
});


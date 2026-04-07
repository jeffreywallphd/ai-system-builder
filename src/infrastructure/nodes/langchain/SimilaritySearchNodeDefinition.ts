import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["vector store", "knowledge", "retrieval"]),
  keywords: Object.freeze(["search knowledge base", "similarity", "retrieval", "rag"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const SIMILARITY_SEARCH_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.similarity_search",
  nonTechnicalName: "Search Knowledge Base",
  technicalDescription:
    "Queries a vector store handle for the documents most similar to the supplied text query.",
  description:
    "Search your saved knowledge base and return the most relevant documents for a question.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "query",
      name: "Query",
      description: "The search text used to retrieve similar documents.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
    new NodePort({
      id: "vectorStore",
      name: "Vector Store",
      description: "A vector store handle produced by a knowledge-base upsert step.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["vector-store"] as never }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "documents",
      name: "Documents",
      description: "The matching documents returned by the similarity search.",
      direction: "output",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["document"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "k",
      name: "Top Results",
      description: "Maximum number of matching documents to return.",
      type: "integer",
      value: 4,
      defaultValue: 4,
      constraints: {
        required: true,
        min: 1,
        max: 50,
        range: { min: 1, max: 50, step: 1, defaultValue: 4, clamp: true },
      },
      projection: {
        label: "Top K",
        description: "Maximum number of matching documents to return.",
        group: "Search",
        order: 0,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "integer",
      },
      order: 0,
    }),
    new NodeProperty({
      id: "scoreThreshold",
      name: "Score Threshold",
      description: "Optional minimum similarity score required for a document to be returned.",
      type: "number",
      value: 0,
      defaultValue: 0,
      isAdvanced: true,
      constraints: {
        min: 0,
        max: 1,
        range: { min: 0, max: 1, step: 0.01, defaultValue: 0, clamp: true },
      },
      projection: {
        label: "Score threshold",
        description: "Optional minimum similarity score required for a document to be returned.",
        group: "Search",
        order: 1,
        authorVisibility: "advanced",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "number",
      },
      order: 1,
    }),
  ]),
  projection,
});

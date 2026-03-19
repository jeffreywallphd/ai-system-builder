import { NodePort, NodePortCompatibilityProfile } from "../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../domain/nodes/NodeProperty";
import type { ILangChainNodeCatalogDefinition } from "./VectorStoreUpsertNodeDefinition";

const projection = Object.freeze({
  group: "Tier 2 LLM",
  tags: Object.freeze(["knowledge base", "retrieval", "rag"]),
  keywords: Object.freeze(["knowledge base", "retriever", "documents", "semantic search"]),
  supportsAuthoringView: true,
  supportsToolView: true,
});

export const KNOWLEDGE_BASE_RETRIEVER_NODE_DEFINITION: ILangChainNodeCatalogDefinition = Object.freeze({
  technicalName: "langchain.knowledge_base_retriever",
  nonTechnicalName: "Find Relevant Information",
  technicalDescription:
    "Retrieves relevant documents from a knowledge base or semantic store using a query.",
  description:
    "Find the most useful information from your saved knowledge for a question or request.",
  inputPorts: Object.freeze([
    new NodePort({
      id: "query",
      name: "Query",
      description: "The search question or request used to retrieve matching knowledge.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
    }),
    new NodePort({
      id: "knowledgeBase",
      name: "Knowledge Base",
      description: "A serializable knowledge base handle or semantic store connection.",
      direction: "input",
      compatibility: new NodePortCompatibilityProfile({
        valueTypes: ["dataset", "json", "generic"],
      }),
    }),
  ]),
  outputPorts: Object.freeze([
    new NodePort({
      id: "documents",
      name: "Documents",
      description: "Relevant documents returned from the knowledge base.",
      direction: "output",
      cardinality: "many",
      compatibility: new NodePortCompatibilityProfile({ valueTypes: ["document", "json"] }),
    }),
  ]),
  properties: Object.freeze([
    new NodeProperty({
      id: "topK",
      name: "Top K",
      description: "How many relevant documents to return.",
      type: "integer",
      value: 5,
      defaultValue: 5,
      constraints: {
        required: true,
        min: 1,
        max: 50,
        range: { min: 1, max: 50, step: 1, defaultValue: 5, clamp: true },
      },
      projection: {
        label: "Top results",
        description: "How many relevant documents to return.",
        group: "Retrieval",
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
      id: "searchType",
      name: "Search Type",
      description: "Choose the retrieval strategy for ranking knowledge base matches.",
      type: "select",
      value: "similarity",
      defaultValue: "similarity",
      options: [
        {
          label: "Similarity",
          value: "similarity",
          description: "Return the most semantically similar matches.",
        },
        {
          label: "MMR",
          value: "mmr",
          description: "Balance relevance with diversity across the returned matches.",
        },
      ],
      constraints: { required: true, allowedValues: ["similarity", "mmr"] },
      projection: {
        label: "Search strategy",
        description: "Choose whether to maximize similarity or diversify the returned matches.",
        group: "Retrieval",
        order: 1,
        authorVisibility: "basic",
        toolVisibility: "basic",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "select",
      },
      order: 1,
    }),
    new NodeProperty<number | null>({
      id: "scoreThreshold",
      name: "Score Threshold",
      description: "Optional minimum relevance score required for a document to be returned.",
      type: "number",
      value: null,
      defaultValue: null,
      constraints: {
        min: 0,
        max: 1,
        range: { min: 0, max: 1, step: 0.01, defaultValue: 0, clamp: true },
      },
      projection: {
        label: "Minimum score",
        description: "Only keep results that meet or exceed this relevance score when provided.",
        group: "Retrieval",
        order: 2,
        authorVisibility: "advanced",
        toolVisibility: "advanced",
        exposeInAuthorForm: true,
        exposeInTool: true,
        fieldTypeHint: "number",
      },
      isAdvanced: true,
      order: 2,
    }),
  ]),
  projection,
});
